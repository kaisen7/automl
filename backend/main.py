from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import os, io, asyncio, pickle, json
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, Future
import threading
import requests
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from model import train_model, predict_model, predict_dataset as predict_dataset_model, _infer_column_types, _find_redundant_features

app = FastAPI(title="AutoML API", version="2.0.0")

# allow any origin for now (dev mode)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# where datasets and history are stored
DATASET_DIR = "data/datasets"
HISTORY_DIR = "data/history"
ALLOWED_EXTENSIONS = {".csv"}

os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)

# global state - keeps track of whats loaded right now
global_df = None
global_model = None
global_columns = None
global_dataset_name = None  # tracks the current dataset name for history

# training thread stuff
_training_executor = ThreadPoolExecutor(max_workers=1)
_current_training_future: Future | None = None
_training_cancel_event = threading.Event()
_training_lock = threading.Lock()


# ── history helpers ──────────────────────────────────────────────────────────

def _session_dir(name: str) -> str:
    """returns path to this dataset's history folder, creates it if needed"""
    safe = name.replace("/", "_").replace("\\", "_").strip()
    d = os.path.join(HISTORY_DIR, safe)
    os.makedirs(d, exist_ok=True)
    return d


def _save_session(
    dataset_name: str,
    df: pd.DataFrame,
    model,
    columns: list,
    scores: dict,
    train_response: dict,
    eda_payload: dict,
):
    """persist the full training session to data/history/<dataset_name>/"""
    try:
        d = _session_dir(dataset_name)

        # 1. dataset CSV
        df.to_csv(os.path.join(d, "dataset.csv"), index=False)

        # 2. best model pickle
        with open(os.path.join(d, "model.pkl"), "wb") as f:
            pickle.dump(model, f)

        # 3. columns list pickle (needed for predictions)
        with open(os.path.join(d, "columns.pkl"), "wb") as f:
            pickle.dump(columns, f)

        # 4. metadata — all scores + train response fields + timestamp
        meta = {
            "dataset_name": dataset_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scores": scores,                              # ALL models' metrics
            "target": train_response.get("target"),
            "problem_type": train_response.get("problem_type"),
            "best_model": train_response.get("best_model"),
            "best_cv_score": train_response.get("best_cv_score"),
            "column_types": train_response.get("column_types", {}),
            "redundant_features": train_response.get("redundant_features", []),
            "feature_columns": columns,           # post-one-hot model columns
            "original_columns": list(df.columns), # raw CSV columns (for Predictor UI)
        }
        with open(os.path.join(d, "metadata.json"), "w") as f:
            json.dump(meta, f, indent=2)

        # 5. EDA snapshot
        with open(os.path.join(d, "eda.json"), "w") as f:
            json.dump(eda_payload, f)

        print(f"✅ Session saved → {d}")
    except Exception as e:
        # never crash the main response because of history saving
        print(f"⚠️  Failed to save history session: {e}")


def _load_metadata(name: str) -> dict | None:
    """loads metadata.json for a session, returns None if missing/corrupt"""
    path = os.path.join(HISTORY_DIR, name, "metadata.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


class Feedback(BaseModel):
    name: str
    email: str
    query: str


def send_feedback_email(fb: Feedback):
    """tries to send the feedback via resend api, falls back to console print"""
    target_email = "automlquery@gmail.com"
    api_key = os.getenv("RESEND_API_KEY", "").strip()

    if not api_key:
        print("RESEND_API_KEY not set. Check your (.env) file.")
        print(f"Feedback from {fb.name} ({fb.email}): {fb.query}")
        return False

    try:
        print(f"Attempting to send email via Resend API...")
        
        # resend free tier only lets you send from onboarding@resend.dev
        # until you verify your own domain
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": "AutoML <onboarding@resend.dev>",
                "to": [target_email],
                "subject": f"AutoML Feedback: {fb.name}",
                "text": f"Name: {fb.name}\nEmail: {fb.email}\n\nQuery:\n{fb.query}",
            }
        )
        
        if resp.status_code in [200, 201]:
            print("Email sent successfully via Resend!")
            return True
        else:
            print(f"Resend API Error: {resp.status_code} - {resp.text}")
            return False
            
    except Exception as e:
        print(f"Failed to send email via Resend: {type(e).__name__} - {e}")
        return False


# quick checks so we dont crash randomly
def _require_dataset():
    if global_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload or select one first.")

def _require_model():
    if global_model is None:
        raise HTTPException(status_code=400, detail="No trained model found. Train a model first.")


def _safe_read_csv(path: str) -> pd.DataFrame:
    """just wraps pd.read_csv with a nicer error"""
    try:
        return pd.read_csv(path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")


def _cancel_current_training():
    """tells any running training to stop"""
    global _current_training_future
    with _training_lock:
        _training_cancel_event.set()
        fut = _current_training_future
    if fut and not fut.done():
        fut.cancel()


def _compute_outliers(df: pd.DataFrame, num_cols: list) -> dict:
    """counts outliers per column using IQR method"""
    outliers = {}
    for c in num_cols:
        s = df[c].dropna()
        if s.empty:
            outliers[c] = 0
            continue
        q1 = s.quantile(0.25)
        q3 = s.quantile(0.75)
        iqr = q3 - q1
        cnt = int(((s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)).sum())
        outliers[c] = cnt
    return outliers


def _compute_scatter_data(df: pd.DataFrame, corr: dict, num_cols: list, n_pairs: int = 6, sample_size: int = 200) -> dict:
    """grabs the top correlated pairs and returns scatter plot data for them"""
    pairs = []
    seen = set()
    cols = list(num_cols)
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            a, b = cols[i], cols[j]
            k = f"{a}__{b}"
            if k in seen:
                continue
            seen.add(k)
            val = corr.get(a, {}).get(b, None)
            if val is not None and not np.isnan(val):
                pairs.append((a, b, abs(val)))

    pairs.sort(key=lambda x: x[2], reverse=True)
    top = pairs[:n_pairs]

    scatter = {}
    for a, b, _ in top:
        k = f"{a}__{b}"
        subset = df[[a, b]].dropna()
        if len(subset) > sample_size:
            subset = subset.sample(sample_size, random_state=42)
        scatter[k] = [
            {"x": round(float(row[a]), 6), "y": round(float(row[b]), 6)}
            for _, row in subset.iterrows()
        ]

    return scatter


# --- dataset endpoints ---

@app.get("/datasets")
async def get_datasets():
    try:
        files = [f for f in os.listdir(DATASET_DIR) if f.endswith(".csv")]
        return {"datasets": sorted(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/load_dataset")
async def load_dataset(name: str = Form(...)):
    global global_df, global_dataset_name
    path = os.path.join(DATASET_DIR, name)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    global_df = _safe_read_csv(path)
    global_dataset_name = os.path.splitext(name)[0]
    redundant = _find_redundant_features(global_df)
    return {
        "columns": list(global_df.columns),
        "rows": len(global_df),
        "redundant_features": redundant,
    }


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global global_df, global_dataset_name

    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Only CSV files are supported. Got: '{ext}'")

    # read entirely into memory — never write to disk
    try:
        contents = await file.read()
        global_df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")

    global_dataset_name = os.path.splitext(file.filename)[0]
    redundant = _find_redundant_features(global_df)
    return {
        "columns": list(global_df.columns),
        "rows": len(global_df),
        "redundant_features": redundant,
    }


# --- training ---

@app.post("/train")
async def train(request: Request, target: str):
    global global_model, global_columns, _current_training_future

    _require_dataset()

    # case insensitive column matching
    col_map = {c.lower(): c for c in global_df.columns}
    tgt_lower = target.strip().lower()
    if tgt_lower not in col_map:
        raise HTTPException(
            status_code=422,
            detail=f"Target column '{target}' not found. Available: {', '.join(global_df.columns)}"
        )

    target = col_map[tgt_lower]
    if global_df[target].isnull().any():
        raise HTTPException(status_code=422, detail="Target column contains missing values.")

    # kill previous training if its still going
    _cancel_current_training()
    _training_cancel_event.clear()

    loop = asyncio.get_event_loop()

    def do_train():
        return train_model(global_df, target, cancel_event=_training_cancel_event)

    # submit to thread pool
    with _training_lock:
        future = _training_executor.submit(do_train)
        _current_training_future = future

    try:
        # keep checking if client disconnected while training runs
        while not future.done():
            if await request.is_disconnected():
                print("⚠️  Client disconnected — cancelling training.")
                _training_cancel_event.set()
                future.cancel()
                raise HTTPException(status_code=499, detail="Client disconnected. Training cancelled.")
            await asyncio.sleep(0.5)

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
    col_types = {}

    input_df = global_df.drop(columns=[target] + redundant, errors="ignore")
    num_cols, cat_cols = _infer_column_types(input_df)

    for c in input_df.columns:
        if c in cat_cols:
            col_types[c] = {
                "type": "categorical",
                "values": global_df[c].dropna().unique().tolist()
            }
        else:
            col_types[c] = {"type": "numeric"}

    train_response = {
        "scores": scores,
        "target": target,
        "problem_type": meta.get("problem_type"),
        "best_model": meta.get("best_model_name"),
        "best_cv_score": meta.get("best_cv_score"),
        "column_types": col_types,
        "redundant_features": redundant,
    }

    # ── persist session to history asynchronously ─────────────────────
    # compute eda now (same logic as /eda endpoint) so we cache it
    try:
        eda_payload = _compute_eda_payload()
    except Exception as e:
        print(f"⚠️  EDA snapshot failed: {e}")
        eda_payload = {}

    dataset_name = global_dataset_name or "dataset"
    loop.run_in_executor(
        None,
        _save_session,
        dataset_name,
        global_df.copy(),
        model,
        columns,
        scores,
        train_response,
        eda_payload,
    )
    # ──────────────────────────────────────────────────────────────────

    return train_response


# --- eda stuff ---

def _compute_eda_payload() -> dict:
    """shared EDA computation used by both /eda endpoint and history snapshot"""
    meta = getattr(global_model, "_automl_meta", {}) if global_model else {}
    redundant = meta.get("redundant_features") or _find_redundant_features(global_df)
    display_df = global_df.drop(columns=redundant, errors="ignore")

    numeric_df = display_df.select_dtypes(include=["number"])
    num_cols = list(numeric_df.columns)

    summary = display_df.describe(include="all").replace({np.nan: None}).to_dict()
    corr = numeric_df.corr().replace({np.nan: 0}).to_dict() if not numeric_df.empty else {}

    # build histogram data
    histograms = {}
    for col in num_cols:
        counts, bins = np.histogram(display_df[col].dropna(), bins=6)
        histograms[col] = [
            {"bin": f"{round(bins[i], 2)}–{round(bins[i+1], 2)}", "count": int(counts[i])}
            for i in range(len(counts))
        ]

    # box plot stats
    box_plots = {}
    for col in num_cols:
        s = display_df[col].dropna().astype(float)
        if s.empty:
            continue
        q1 = float(s.quantile(0.25))
        q2 = float(s.quantile(0.5))
        q3 = float(s.quantile(0.75))
        iqr = q3 - q1
        lo = float(s[s >= q1 - 1.5 * iqr].min())
        hi = float(s[s <= q3 + 1.5 * iqr].max())
        outlier_vals = s[(s < lo) | (s > hi)].tolist()
        box_plots[col] = {
            "min": float(s.min()),
            "q1": q1,
            "median": q2,
            "q3": q3,
            "max": float(s.max()),
            "iqr": iqr,
            "lower_whisker": lo,
            "upper_whisker": hi,
            "outliers": [float(v) for v in outlier_vals[:20]],
            "outlier_count": int(len(outlier_vals)),
        }

    # categorical value counts
    categorical = {}
    for col in display_df.select_dtypes(include=["object", "category"]).columns:
        vals = display_df[col].fillna("<missing>").astype(str)
        categorical[col] = vals.value_counts().head(10).to_dict()

    missing = display_df.isnull().sum().to_dict()

    # feature importance from the model if we have one
    importance = {}
    if global_model is not None:
        est = global_model
        if hasattr(global_model, "named_steps"):
            est = global_model.named_steps.get("clf") or global_model.named_steps.get("reg")
        if est is not None:
            if hasattr(est, "feature_importances_"):
                importance = dict(zip(global_columns, est.feature_importances_.tolist()))
            elif hasattr(est, "coef_"):
                coefs = est.coef_
                if coefs.ndim == 2:
                    coefs = np.mean(np.abs(coefs), axis=0)
                else:
                    coefs = np.abs(coefs)
                importance = dict(zip(global_columns, coefs.tolist()))

    dup_rows = int(display_df.duplicated().sum())
    outliers = _compute_outliers(display_df, num_cols)
    scatter = _compute_scatter_data(display_df, corr, num_cols)

    target_col = meta.get("target")
    target_dist = {}
    cat_target_dist = {}
    if (
        target_col
        and target_col in global_df.columns
        and meta.get("problem_type") == "classification"
    ):
        tgt_series = global_df[target_col].dropna().astype(str)
        target_dist = tgt_series.value_counts().to_dict()

        # figure out which categorical cols matter most
        cat_cols_list = [
            c
            for c in display_df.select_dtypes(include=["object"]).columns
            if c != target_col
        ]
        top_cats = []
        if importance:
            cat_scores = {}
            for feat, score in importance.items():
                if feat == target_col:
                    continue
                normalized = feat
                for c in cat_cols_list:
                    if feat == c or feat.startswith(f"{c}_") or feat.startswith(f"{c}__"):
                        normalized = c
                        break
                if normalized in cat_cols_list:
                    cat_scores[normalized] = max(cat_scores.get(normalized, 0), score)
            top_cats = sorted(cat_scores, key=lambda c: cat_scores[c], reverse=True)[:3]
        if not top_cats:
            top_cats = cat_cols_list[:3]

        for col in top_cats:
            values = global_df[col].astype(str).fillna("<missing>")
            top_values = values.value_counts().nlargest(5).index.tolist()
            safe_col = global_df[col].astype(str).fillna("<missing>")
            safe_tgt = global_df[target_col].astype(str).fillna("<missing>")
            subset = global_df[safe_col.isin(top_values)].copy()
            subset[col] = safe_col
            subset[target_col] = safe_tgt
            grouped = subset.groupby([col, target_col]).size().unstack(fill_value=0)
            cat_target_dist[col] = {
                "categories": top_values,
                "target_labels": [str(v) for v in grouped.columns.tolist()],
                "data": [
                    {
                        "category": str(cat),
                        **{str(lbl): int(grouped.get(lbl, {}).get(cat, 0)) for lbl in grouped.columns},
                    }
                    for cat in top_values
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
        "numeric_columns": meta.get("numeric_columns", num_cols),
        "categorical_columns": meta.get("categorical_columns", list(display_df.select_dtypes("object").columns)),
        "missing_total": int(display_df.isnull().sum().sum()),
        "has_model": global_model is not None,
        "duplicate_rows": dup_rows,
        "outliers": outliers,
        "scatter_data": scatter,
        "box_plots": box_plots,
        "redundant_features": redundant,
        "target_column": target_col,
        "target_type": meta.get("problem_type"),
        "target_distribution": target_dist,
        "categorical_target_distribution": cat_target_dist,
    }


@app.get("/eda")
async def eda():
    _require_dataset()
    return _compute_eda_payload()


# --- model info ---


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


# --- prediction ---

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
        preds = predict_dataset_model(global_model, dataset, global_columns, global_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk prediction failed: {e}")

    output = dataset.copy()
    output["prediction"] = preds

    csv_bytes = output.to_csv(index=False).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=predictions_{file.filename}" 
        },
    )


# --- history ---

@app.get("/history")
async def list_history():
    """list all saved training sessions"""
    sessions = []
    if not os.path.isdir(HISTORY_DIR):
        return {"sessions": []}
    for name in sorted(os.listdir(HISTORY_DIR)):
        meta = _load_metadata(name)
        if meta is None:
            continue
        sessions.append({
            "name": name,
            "dataset_name": meta.get("dataset_name", name),
            "timestamp": meta.get("timestamp"),
            "best_model": meta.get("best_model"),
            "best_cv_score": meta.get("best_cv_score"),
            "problem_type": meta.get("problem_type"),
            "target": meta.get("target"),
        })
    # most recent first
    sessions.sort(key=lambda s: s.get("timestamp", ""), reverse=True)
    return {"sessions": sessions}


@app.post("/history/{name}/load")
async def load_history_session(name: str):
    """restore a saved session into global state (no re-training)"""
    global global_df, global_model, global_columns, global_dataset_name

    d = os.path.join(HISTORY_DIR, name)
    if not os.path.isdir(d):
        raise HTTPException(status_code=404, detail=f"History session '{name}' not found.")

    meta = _load_metadata(name)
    if meta is None:
        raise HTTPException(status_code=500, detail="Session metadata is missing or corrupt.")

    # load dataset
    ds_path = os.path.join(d, "dataset.csv")
    if not os.path.exists(ds_path):
        raise HTTPException(status_code=500, detail="Session dataset file is missing.")
    global_df = _safe_read_csv(ds_path)

    # load model
    model_path = os.path.join(d, "model.pkl")
    if not os.path.exists(model_path):
        raise HTTPException(status_code=500, detail="Session model file is missing.")
    with open(model_path, "rb") as f:
        global_model = pickle.load(f)

    # load columns
    col_path = os.path.join(d, "columns.pkl")
    if os.path.exists(col_path):
        with open(col_path, "rb") as f:
            global_columns = pickle.load(f)
    else:
        global_columns = meta.get("feature_columns", meta.get("columns", []))

    global_dataset_name = meta.get("dataset_name", name)

    # original_columns = raw CSV column names (what Predictor/Upload pages use)
    # feature_columns  = post-one-hot model input columns (used only for prediction)
    original_columns = meta.get("original_columns", list(global_df.columns))

    return {
        "scores": meta.get("scores", {}),
        "target": meta.get("target"),
        "problem_type": meta.get("problem_type"),
        "best_model": meta.get("best_model"),
        "best_cv_score": meta.get("best_cv_score"),
        "column_types": meta.get("column_types", {}),
        "redundant_features": meta.get("redundant_features", []),
        "original_columns": original_columns,   # for automl_columns in localStorage
        "feature_columns": global_columns,       # model columns (not used by UI directly)
        "dataset_name": global_dataset_name,
    }


# --- reset everything ---

@app.post("/reset")
async def reset():
    global global_df, global_model, global_columns, global_dataset_name

    _cancel_current_training()

    global_df = None
    global_model = None
    global_columns = None
    global_dataset_name = None

    return {"message": "State reset successful"}


# --- feedback ---

@app.post("/feedback")
async def receive_feedback(fb: Feedback):
    success = send_feedback_email(fb)
    if not success:
        return {"status": "error", "message": "Feedback received but email failed to send."}
    return {"status": "success", "message": "Feedback sent successfully."}