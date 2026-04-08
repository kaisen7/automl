from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import shutil
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor, Future
import threading

from model import train_model, predict_model, _infer_column_types

app = FastAPI(title="AutoML API", version="2.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ────────────────────────────────────────────────────────────────────
UPLOAD_DIR = "data"
DATASET_DIR = "data/datasets"
ALLOWED_EXTENSIONS = {".csv"}

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DATASET_DIR, exist_ok=True)

# ── State ─────────────────────────────────────────────────────────────────────
global_df = None
global_model = None
global_columns = None

# ── Training cancellation state ───────────────────────────────────────────────
_training_executor = ThreadPoolExecutor(max_workers=1)
_current_training_future: Future | None = None
_training_cancel_event = threading.Event()
_training_lock = threading.Lock()


# ── Helpers ───────────────────────────────────────────────────────────────────
def _require_dataset():
    if global_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload or select one first.")


def _require_model():
    if global_model is None:
        raise HTTPException(status_code=400, detail="No trained model found. Train a model first.")


def _safe_read_csv(path: str) -> pd.DataFrame:
    try:
        return pd.read_csv(path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")


def _cancel_current_training():
    """Signal any in-progress training to stop and wait briefly."""
    global _current_training_future
    with _training_lock:
        _training_cancel_event.set()
        future = _current_training_future
    if future and not future.done():
        # Give it up to 2 seconds to notice the cancel signal
        future.cancel()


def _compute_outliers(df: pd.DataFrame, numeric_cols: list) -> dict:
    """IQR-based outlier count per numeric column."""
    outliers = {}
    for col in numeric_cols:
        series = df[col].dropna()
        if series.empty:
            outliers[col] = 0
            continue
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        count = int(((series < Q1 - 1.5 * IQR) | (series > Q3 + 1.5 * IQR)).sum())
        outliers[col] = count
    return outliers


def _compute_scatter_data(df: pd.DataFrame, corr: dict, numeric_cols: list, n_pairs: int = 6, sample_size: int = 200) -> dict:
    pairs = []
    seen = set()
    cols = list(numeric_cols)
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            col_a, col_b = cols[i], cols[j]
            key = f"{col_a}__{col_b}"
            if key in seen:
                continue
            seen.add(key)
            val = corr.get(col_a, {}).get(col_b, None)
            if val is not None and not np.isnan(val):
                pairs.append((col_a, col_b, abs(val)))

    pairs.sort(key=lambda x: x[2], reverse=True)
    top_pairs = pairs[:n_pairs]

    scatter_data = {}
    for col_a, col_b, _ in top_pairs:
        key = f"{col_a}__{col_b}"
        subset = df[[col_a, col_b]].dropna()
        if len(subset) > sample_size:
            subset = subset.sample(sample_size, random_state=42)
        scatter_data[key] = [
            {"x": round(float(row[col_a]), 6), "y": round(float(row[col_b]), 6)}
            for _, row in subset.iterrows()
        ]

    return scatter_data


# ── Datasets ──────────────────────────────────────────────────────────────────
@app.get("/datasets")
async def get_datasets():
    try:
        files = [f for f in os.listdir(DATASET_DIR) if f.endswith(".csv")]
        return {"datasets": sorted(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/load_dataset")
async def load_dataset(name: str = Form(...)):
    global global_df
    path = os.path.join(DATASET_DIR, name)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    global_df = _safe_read_csv(path)
    return {"columns": list(global_df.columns), "rows": len(global_df)}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global global_df

    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Only CSV files are supported. Got: '{ext}'")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")

    global_df = _safe_read_csv(file_path)
    return {"columns": list(global_df.columns), "rows": len(global_df)}


# ── Train ─────────────────────────────────────────────────────────────────────
@app.post("/train")
async def train(request: Request, target: str):
    global global_model, global_columns, _current_training_future

    _require_dataset()

    col_map = {col.lower(): col for col in global_df.columns}
    target_lower = target.strip().lower()
    if target_lower not in col_map:
        raise HTTPException(
            status_code=422,
            detail=f"Target column '{target}' not found. Available: {', '.join(global_df.columns)}"
        )

    target = col_map[target_lower]
    if global_df[target].isnull().any():
        raise HTTPException(status_code=422, detail="Target column contains missing values.")

    # Cancel any previous training job
    _cancel_current_training()

    # Reset cancel event for new training run
    _training_cancel_event.clear()

    loop = asyncio.get_event_loop()

    def run_training():
        return train_model(global_df, target, cancel_event=_training_cancel_event)

    # Submit training to thread pool
    with _training_lock:
        future = _training_executor.submit(run_training)
        _current_training_future = future

    try:
        # Poll: run training while checking for client disconnect
        while not future.done():
            # Check if client disconnected
            if await request.is_disconnected():
                print("⚠️  Client disconnected — cancelling training.")
                _training_cancel_event.set()
                future.cancel()
                raise HTTPException(status_code=499, detail="Client disconnected. Training cancelled.")

            await asyncio.sleep(0.5)  # Check every 500ms

        # Retrieve result (raises if training raised)
        model, scores, columns = future.result()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")
    finally:
        with _training_lock:
            _current_training_future = None

    global_model = model
    global_columns = columns

    meta = getattr(model, "_automl_meta", {})
    column_types = {}

    input_df = global_df.drop(columns=[target])
    numeric_cols, categorical_cols = _infer_column_types(input_df)

    for col in input_df.columns:
        if col in categorical_cols:
            column_types[col] = {
                "type": "categorical",
                "values": global_df[col].dropna().unique().tolist()
            }
        else:
            column_types[col] = {
                "type": "numeric"
            }

    return {
        "scores": scores,
        "target": target,
        "problem_type": meta.get("problem_type"),
        "best_model": meta.get("best_model_name"),
        "best_cv_score": meta.get("best_cv_score"),
        "column_types": column_types
    }


# ── EDA ───────────────────────────────────────────────────────────────────────
@app.get("/eda")
async def eda():
    _require_dataset()

    df = global_df.copy()
    numeric_df = df.select_dtypes(include=["number"])
    numeric_cols = list(numeric_df.columns)

    summary = df.describe(include="all").replace({np.nan: None}).to_dict()
    corr = numeric_df.corr().replace({np.nan: 0}).to_dict() if not numeric_df.empty else {}

    histograms = {}
    for col in numeric_cols:
        counts, bins = np.histogram(df[col].dropna(), bins=10)
        histograms[col] = [
            {"bin": f"{round(bins[i], 2)}–{round(bins[i+1], 2)}", "count": int(counts[i])}
            for i in range(len(counts))
        ]

    categorical = {}
    for col in df.select_dtypes(include=["object"]).columns:
        categorical[col] = df[col].value_counts().head(10).to_dict()

    missing = df.isnull().sum().to_dict()

    importance = {}
    if global_model is not None:
        estimator = global_model
        if hasattr(global_model, "named_steps"):
            estimator = global_model.named_steps.get("clf") or global_model.named_steps.get("reg")
        if estimator is not None and hasattr(estimator, "feature_importances_"):
            importance = dict(zip(global_columns, estimator.feature_importances_.tolist()))

    duplicate_rows = int(df.duplicated().sum())
    outliers = _compute_outliers(df, numeric_cols)
    scatter_data = _compute_scatter_data(df, corr, numeric_cols)

    meta = getattr(global_model, "_automl_meta", {}) if global_model else {}

    return {
        "columns": list(df.columns),
        "sample": df.head(5).replace({np.nan: None}).to_dict(orient="records"),
        "summary": summary,
        "correlation": corr,
        "histograms": histograms,
        "categorical": categorical,
        "missing": missing,
        "importance": importance,
        "num_rows": len(df),
        "num_columns": len(df.columns),
        "numeric_columns": meta.get("numeric_columns", numeric_cols),
        "categorical_columns": meta.get("categorical_columns", list(df.select_dtypes("object").columns)),
        "missing_total": int(df.isnull().sum().sum()),
        "has_model": global_model is not None,
        "duplicate_rows": duplicate_rows,
        "outliers": outliers,
        "scatter_data": scatter_data,
    }


# ── Model info ────────────────────────────────────────────────────────────────
@app.get("/model_info")
async def model_info():
    _require_model()
    meta = getattr(global_model, "_automl_meta", {})
    return {
        "model_type": meta.get("best_model_name", type(global_model).__name__),
        "problem_type": meta.get("problem_type"),
        "target": meta.get("target"),
        "num_features": meta.get("num_features"),
        "best_cv_score": meta.get("best_cv_score"),
        "label_classes": meta.get("label_classes"),
        "feature_columns": list(global_columns) if global_columns is not None else [],
    }


# ── Predict ───────────────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(data: dict):
    _require_model()

    if not data:
        raise HTTPException(status_code=422, detail="Request body must be a non-empty JSON object.")

    try:
        result = predict_model(global_model, data, global_columns, global_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    return result


# ── Reset ─────────────────────────────────────────────────────────────────────
@app.post("/reset")
async def reset():
    global global_df, global_model, global_columns

    # Cancel any in-progress training
    _cancel_current_training()

    global_df = None
    global_model = None
    global_columns = None

    return {"message": "State reset successful"}