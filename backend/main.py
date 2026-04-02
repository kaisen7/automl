from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import shutil
import os

from model import train_model, predict_model

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
async def train(target: str):
    global global_model, global_columns
    _require_dataset()

    if target not in global_df.columns:
        raise HTTPException(
            status_code=422,
            detail=f"Target column '{target}' not found. Available: {list(global_df.columns)}"
        )

    if global_df[target].isnull().any():
        raise HTTPException(status_code=422, detail="Target column contains missing values.")

    try:
        model, scores, columns = train_model(global_df, target)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")

    global_model = model
    global_columns = columns

    meta = getattr(model, "_automl_meta", {})
    return {
        "scores": scores,
        "target": target,
        "problem_type": meta.get("problem_type"),
        "best_model": meta.get("best_model_name"),
        "best_cv_score": meta.get("best_cv_score"),
    }


# ── EDA ───────────────────────────────────────────────────────────────────────
@app.get("/eda")
async def eda():
    _require_dataset()

    df = global_df.copy()
    numeric_df = df.select_dtypes(include=["number"])

    # Summary stats
    summary = df.describe(include="all").replace({np.nan: None}).to_dict()

    # Correlation
    corr = numeric_df.corr().replace({np.nan: 0}).to_dict() if not numeric_df.empty else {}

    # Histograms
    histograms = {}
    for col in numeric_df.columns:
        counts, bins = np.histogram(df[col].dropna(), bins=10)
        histograms[col] = [
            {"bin": f"{round(bins[i], 2)}–{round(bins[i+1], 2)}", "count": int(counts[i])}
            for i in range(len(counts))
        ]

    # Categorical distributions
    categorical = {}
    for col in df.select_dtypes(include=["object"]).columns:
        categorical[col] = df[col].value_counts().head(10).to_dict()

    # Missing values
    missing = df.isnull().sum().to_dict()

    # Feature importance (if model trained)
    importance = {}
    if global_model is not None:
        estimator = global_model
        # Unwrap Pipeline
        if hasattr(global_model, "named_steps"):
            estimator = global_model.named_steps.get("clf") or global_model.named_steps.get("reg")
        if estimator is not None and hasattr(estimator, "feature_importances_"):
            importance = dict(zip(global_columns, estimator.feature_importances_.tolist()))

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
        "numeric_columns": meta.get("numeric_columns", list(numeric_df.columns)),
        "categorical_columns": meta.get("categorical_columns", list(df.select_dtypes("object").columns)),
        "missing_total": int(df.isnull().sum().sum()),
        "has_model": global_model is not None,
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
        result = predict_model(global_model, data, global_columns)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    return result

@app.post("/reset")
async def reset():
    global global_df, global_model, global_columns

    global_df = None
    global_model = None
    global_columns = None

    return {"message": "State reset successful"}