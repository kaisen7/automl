from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import r2_score, accuracy_score, f1_score, mean_absolute_error
import pandas as pd
import numpy as np
import threading


class TrainingCancelledError(Exception):
    """Raised when training is interrupted by a cancel signal."""
    pass


def _detect_problem_type(y):
    """Heuristic: classification if target is string or low-cardinality int."""
    if y.dtype == "object" or pd.api.types.is_bool_dtype(y):
        return "classification"
    unique_ratio = y.nunique() / len(y)
    if y.nunique() <= 20 and unique_ratio < 0.05:
        return "classification"
    return "regression"


def _infer_column_types(df: pd.DataFrame):
    """Infer numeric vs categorical columns, including numeric-like object columns."""
    numeric_cols = []
    categorical_cols = []

    for col in df.columns:
        series = df[col]
        if pd.api.types.is_numeric_dtype(series) or pd.api.types.is_bool_dtype(series):
            numeric_cols.append(col)
            continue

        non_null = series.dropna().astype(str).str.strip()
        if non_null.empty:
            categorical_cols.append(col)
            continue

        coerced = pd.to_numeric(non_null, errors="coerce")
        converted_ratio = coerced.notna().mean()
        if converted_ratio >= 0.9 and coerced.notna().sum() >= 3:
            numeric_cols.append(col)
        else:
            categorical_cols.append(col)

    return numeric_cols, categorical_cols


def _check_cancel(cancel_event: threading.Event | None):
    """Raise TrainingCancelledError if the cancel signal has been set."""
    if cancel_event is not None and cancel_event.is_set():
        raise TrainingCancelledError("Training was cancelled by client disconnect.")


def train_model(df, target, cancel_event: threading.Event | None = None):
    col_map = {col.lower(): col for col in df.columns}
    target_lower = target.strip().lower()
    if target_lower not in col_map:
        raise ValueError(f"Target column '{target}' not found in dataset.")
    target = col_map[target_lower]

    _check_cancel(cancel_event)

    X = df.drop(columns=[target])
    y = df[target].copy()

    problem_type = _detect_problem_type(y)

    # --- Encode classification target ---
    label_encoder = None
    if problem_type == "classification" and y.dtype == "object":
        label_encoder = LabelEncoder()
        y = pd.Series(label_encoder.fit_transform(y), index=y.index)

    _check_cancel(cancel_event)

    # --- Detect and normalize original column types before encoding ---
    numeric_cols_orig, categorical_cols_orig = _infer_column_types(X)
    numeric_fill_values = {}

    for col in X.columns:
        if col in numeric_cols_orig:
            X[col] = pd.to_numeric(X[col], errors="coerce")
            fill_value = float(X[col].median()) if not X[col].dropna().empty else 0.0
            X[col] = X[col].fillna(fill_value)
            numeric_fill_values[col] = fill_value
        else:
            X[col] = X[col].astype(str).fillna("missing")

    _check_cancel(cancel_event)

    # --- One-hot encode ---
    X = pd.get_dummies(X, drop_first=True)
    columns = list(X.columns)

    # --- Remove problematic values ---
    X = X.replace([np.inf, -np.inf], np.nan)
    valid_idx = X.dropna().index
    X = X.loc[valid_idx]
    y = y.loc[valid_idx]
    X = X.loc[:, X.nunique() > 1]

    _check_cancel(cancel_event)

    stratify = None
    if problem_type == "classification" and y.value_counts().min() >= 2:
        stratify = y

    # --- Train / test split ---
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=stratify
    )

    # --- Define candidate models ---
    if problem_type == "classification":
        candidates = {
            "LogisticRegression": Pipeline([
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(max_iter=1000, random_state=42)),
            ]),
            "RandomForestClassifier": RandomForestClassifier(
                n_estimators=200, max_depth=None, random_state=42, n_jobs=-1
            ),
            "GradientBoostingClassifier": GradientBoostingClassifier(
                n_estimators=100, learning_rate=0.1, random_state=42
            ),
        }
        cv_scoring = "f1_weighted"
    else:
        candidates = {
            "LinearRegression": Pipeline([
                ("scaler", StandardScaler()),
                ("reg", LinearRegression()),
            ]),
            "RandomForestRegressor": RandomForestRegressor(
                n_estimators=200, random_state=42, n_jobs=-1
            ),
            "GradientBoostingRegressor": GradientBoostingRegressor(
                n_estimators=100, learning_rate=0.1, random_state=42
            ),
        }
        cv_scoring = "r2"

    best_model = None
    best_score = -np.inf
    scores = {}

    for name, model in candidates.items():
        # ── Check for cancellation before each model ──────────────────────────
        _check_cancel(cancel_event)

        try:
            cv = min(5, len(y_train))
            if problem_type == "classification":
                cv = min(cv, y_train.value_counts().min())

            cv_scores = cross_val_score(
                model, X_train, y_train,
                cv=cv, scoring=cv_scoring,
                n_jobs=1,          # keep as 1 so the cancel check isn't bypassed
                error_score=np.nan
            )

            # ── Check again after potentially long CV step ────────────────────
            _check_cancel(cancel_event)

            valid_scores = cv_scores[~np.isnan(cv_scores)]
            if len(valid_scores) == 0:
                raise ValueError("All CV folds failed")

            cv_mean = float(np.mean(valid_scores))
            cv_std = float(np.std(valid_scores))

            if len(valid_scores) < len(cv_scores):
                print(f"⚠️ {name}: {len(cv_scores)-len(valid_scores)} folds failed, using remaining {len(valid_scores)}")

            # Final fit on full train set
            model.fit(X_train, y_train)

            # ── Check after fit ───────────────────────────────────────────────
            _check_cancel(cancel_event)

            preds = model.predict(X_test)

            if problem_type == "classification":
                test_score = float(accuracy_score(y_test, preds))
                f1 = float(f1_score(y_test, preds, average="weighted", zero_division=0))
                scores[name] = {
                    "cv_mean": round(cv_mean, 4),
                    "cv_std": round(cv_std, 4),
                    "test_accuracy": round(test_score, 4),
                    "test_f1_weighted": round(f1, 4),
                }
                selection_score = cv_mean
            else:
                test_r2 = float(r2_score(y_test, preds))
                test_mae = float(mean_absolute_error(y_test, preds))
                scores[name] = {
                    "cv_mean_r2": round(cv_mean, 4),
                    "cv_std": round(cv_std, 4),
                    "test_r2": round(test_r2, 4),
                    "test_mae": round(test_mae, 4),
                }
                selection_score = cv_mean

            if selection_score > best_score:
                best_score = selection_score
                best_model = model

        except TrainingCancelledError:
            # Bubble up immediately — do not swallow cancellation
            print(f"🛑 Training cancelled during {name}.")
            raise
        except Exception as e:
            print(f"{name} failed:", e)
            scores[name] = {"error": str(e)}

    if best_model is None:
        raise RuntimeError("All models failed to train.")

    best_model._automl_meta = {
        "problem_type": problem_type,
        "target": target,
        "num_rows": len(df),
        "num_features": len(columns),
        "numeric_columns": numeric_cols_orig,
        "categorical_columns": categorical_cols_orig,
        "numeric_fill_values": numeric_fill_values,
        "best_model_name": type(best_model.named_steps.get("clf") or best_model.named_steps.get("reg") if hasattr(best_model, "named_steps") else best_model).__name__,
        "best_cv_score": round(float(best_score), 4),
        "label_classes": label_encoder.classes_.tolist() if label_encoder else None,
    }

    return best_model, scores, columns


def predict_model(model, data, columns, global_df):
    df = pd.DataFrame([data])
    meta = getattr(model, "_automl_meta", {})
    numeric_cols = set(meta.get("numeric_columns", []))
    numeric_fill_values = meta.get("numeric_fill_values", {})

    for col in df.columns:
        if col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            df[col] = df[col].fillna(numeric_fill_values.get(col, 0.0))
        else:
            df[col] = df[col].fillna("missing").astype(str)
            if col in global_df.columns:
                valid_values = global_df[col].dropna().astype(str).unique()
                df[col] = df[col].where(df[col].isin(valid_values), "missing")

    df = pd.get_dummies(df)
    df = df.reindex(columns=columns, fill_value=0)

    preds = model.predict(df)

    label_classes = meta.get("label_classes")
    decoded_preds = preds.tolist()
    if label_classes and all(isinstance(p, (int, np.integer)) for p in preds):
        decoded_preds = [label_classes[int(p)] for p in preds]

    result = {
        "prediction": decoded_preds,
        "model_type": meta.get("best_model_name", type(model).__name__),
        "problem_type": meta.get("problem_type"),
        "target": meta.get("target"),
    }

    if hasattr(model, "predict_proba"):
        try:
            proba = model.predict_proba(df)[0].tolist()
            result["probabilities"] = {
                (label_classes[i] if label_classes else str(i)): round(p, 4)
                for i, p in enumerate(proba)
            }
        except Exception:
            pass

    return result