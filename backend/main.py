from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import shutil
import os
import io
import asyncio
from concurrent.futures import ThreadPoolExecutor, Future
import threading
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from model import train_model, predict_model, predict_dataset as predict_dataset_model, _infer_column_types, _find_redundant_features

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


class Feedback(BaseModel):
    name: str
    email: str
    query: str


def send_feedback_email(fb: Feedback):
    target_email = "automlquery@gmail.com"
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    try:
        smtp_port = int(str(os.getenv("SMTP_PORT", "587")).strip())
    except:
        smtp_port = 587
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()

    if not smtp_user or not smtp_pass:
        print("⚠️ SMTP credentials not set. Check your (.env) file.")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = target_email
        msg["Subject"] = f"AutoML Feedback: {fb.name}"

        body = f"Name: {fb.name}\nEmail: {fb.email}\n\nQuery:\n{fb.query}"
        msg.attach(MIMEText(body, "plain"))

        print(f"📧 Attempting to send email to {target_email} via {smtp_host}...")
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.set_debuglevel(0) # Set to 1 for verbose SMTP logs
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print("✅ Email sent successfully!")
        return True
    except smtplib.SMTPAuthenticationError:
        print("❌ SMTP Authentication Failed. Check your email and App Password.")
        return False
    except Exception as e:
        print(f"❌ Failed to send email: {type(e).__name__} - {e}")
        return False


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
    redundant = _find_redundant_features(global_df)
    return {
        "columns": list(global_df.columns),
        "rows": len(global_df),
        "redundant_features": redundant,
    }


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
    redundant = _find_redundant_features(global_df)
    return {
        "columns": list(global_df.columns),
        "rows": len(global_df),
        "redundant_features": redundant,
    }


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
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")
    finally:
        with _training_lock:
            _current_training_future = None

    global_model = model
    global_columns = columns

    meta = getattr(model, "_automl_meta", {})
    redundant = meta.get("redundant_features", [])
    column_types = {}

    input_df = global_df.drop(columns=[target] + redundant, errors="ignore")
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
        "column_types": column_types,
        "redundant_features": redundant,
    }


# ── EDA ───────────────────────────────────────────────────────────────────────
@app.get("/eda")
async def eda():
    _require_dataset()

    meta = getattr(global_model, "_automl_meta", {}) if global_model else {}
    redundant = meta.get("redundant_features") or _find_redundant_features(global_df)
    display_df = global_df.drop(columns=redundant, errors="ignore")

    numeric_df = display_df.select_dtypes(include=["number"])
    numeric_cols = list(numeric_df.columns)

    summary = display_df.describe(include="all").replace({np.nan: None}).to_dict()
    corr = numeric_df.corr().replace({np.nan: 0}).to_dict() if not numeric_df.empty else {}

    histograms = {}
    for col in numeric_cols:
        counts, bins = np.histogram(display_df[col].dropna(), bins=6)
        histograms[col] = [
            {"bin": f"{round(bins[i], 2)}–{round(bins[i+1], 2)}", "count": int(counts[i])}
            for i in range(len(counts))
        ]

    box_plots = {}
    for col in numeric_cols:
        series = display_df[col].dropna().astype(float)
        if series.empty:
            continue
        q1 = float(series.quantile(0.25))
        q2 = float(series.quantile(0.5))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        lower_whisker = float(series[series >= q1 - 1.5 * iqr].min())
        upper_whisker = float(series[series <= q3 + 1.5 * iqr].max())
        outlier_values = series[(series < lower_whisker) | (series > upper_whisker)].tolist()
        box_plots[col] = {
            "min": float(series.min()),
            "q1": q1,
            "median": q2,
            "q3": q3,
            "max": float(series.max()),
            "iqr": iqr,
            "lower_whisker": lower_whisker,
            "upper_whisker": upper_whisker,
            "outliers": [float(v) for v in outlier_values[:20]],
            "outlier_count": int(len(outlier_values)),
        }

    categorical = {}
    for col in display_df.select_dtypes(include=["object", "category"]).columns:
        values = display_df[col].fillna("<missing>").astype(str)
        categorical[col] = values.value_counts().head(10).to_dict()

    missing = display_df.isnull().sum().to_dict()

    importance = {}
    if global_model is not None:
        estimator = global_model
        if hasattr(global_model, "named_steps"):
            estimator = global_model.named_steps.get("clf") or global_model.named_steps.get("reg")
        if estimator is not None:
            if hasattr(estimator, "feature_importances_"):
                importance = dict(zip(global_columns, estimator.feature_importances_.tolist()))
            elif hasattr(estimator, "coef_"):
                coefs = estimator.coef_
                if coefs.ndim == 2:
                    coefs = np.mean(np.abs(coefs), axis=0)
                else:
                    coefs = np.abs(coefs)
                importance = dict(zip(global_columns, coefs.tolist()))

    duplicate_rows = int(display_df.duplicated().sum())
    outliers = _compute_outliers(display_df, numeric_cols)
    scatter_data = _compute_scatter_data(display_df, corr, numeric_cols)

    target_column = meta.get("target")
    target_distribution = {}
    categorical_target_distribution = {}
    if (
        target_column
        and target_column in global_df.columns
        and meta.get("problem_type") == "classification"
    ):
        target_series = global_df[target_column].dropna().astype(str)
        target_distribution = target_series.value_counts().to_dict()

        cat_cols = [
            col
            for col in display_df.select_dtypes(include=["object"]).columns
            if col != target_column
        ]
        top_categorical = []
        if importance:
            cat_scores = {}
            for feature, score in importance.items():
                if feature == target_column:
                    continue
                normalized = feature
                for col in cat_cols:
                    if feature == col or feature.startswith(f"{col}_") or feature.startswith(f"{col}__"):
                        normalized = col
                        break
                if normalized in cat_cols:
                    cat_scores[normalized] = max(cat_scores.get(normalized, 0), score)
            top_categorical = sorted(cat_scores, key=lambda c: cat_scores[c], reverse=True)[:3]
        if not top_categorical:
            top_categorical = cat_cols[:3]

        for col in top_categorical:
            values = global_df[col].astype(str).fillna("<missing>")
            top_values = values.value_counts().nlargest(5).index.tolist()
            safe_col = global_df[col].astype(str).fillna("<missing>")
            safe_target = global_df[target_column].astype(str).fillna("<missing>")
            subset = global_df[safe_col.isin(top_values)].copy()
            subset[col] = safe_col
            subset[target_column] = safe_target
            grouped = subset.groupby([col, target_column]).size().unstack(fill_value=0)
            categorical_target_distribution[col] = {
                "categories": top_values,
                "target_labels": [str(v) for v in grouped.columns.tolist()],
                "data": [
                    {
                        "category": str(category),
                        **{str(label): int(grouped.get(label, {}).get(category, 0)) for label in grouped.columns},
                    }
                    for category in top_values
                ],
            }

    return {
        "columns": list(display_df.columns),
        "sample": display_df.head(5).replace({np.nan: None}).to_dict(orient="records"),
        "summary": summary,
        "correlation": corr,
        "histograms": histograms,
        "categorical": categorical,
        "missing": missing,
        "importance": importance,
        "num_rows": len(display_df),
        "num_columns": len(display_df.columns),
        "numeric_columns": meta.get("numeric_columns", numeric_cols),
        "categorical_columns": meta.get("categorical_columns", list(display_df.select_dtypes("object").columns)),
        "missing_total": int(display_df.isnull().sum().sum()),
        "has_model": global_model is not None,
        "duplicate_rows": duplicate_rows,
        "outliers": outliers,
        "scatter_data": scatter_data,
        "box_plots": box_plots,
        "redundant_features": redundant,
        "target_column": target_column,
        "target_type": meta.get("problem_type"),
        "target_distribution": target_distribution,
        "categorical_target_distribution": categorical_target_distribution,
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


@app.post("/predict_dataset")
async def predict_dataset(file: UploadFile = File(...)):
    _require_model()

    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Only CSV files are supported. Got: '{ext}'")

    try:
        contents = await file.read()
        dataset = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse uploaded CSV: {e}")

    try:
        predictions = predict_dataset_model(global_model, dataset, global_columns, global_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk prediction failed: {e}")

    output = dataset.copy()
    output["prediction"] = predictions

    csv_bytes = output.to_csv(index=False).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=predictions_{file.filename}" 
        },
    )


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




@app.post("/feedback")
async def receive_feedback(fb: Feedback):
    success = send_feedback_email(fb)
    if not success:
        return {"status": "error", "message": "Feedback received but email failed to send."}
    return {"status": "success", "message": "Feedback sent successfully."}