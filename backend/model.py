from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import r2_score, accuracy_score, f1_score, mean_absolute_error
import pandas as pd
import numpy as np


def _detect_problem_type(y):
    """Heuristic: classification if target is string or low-cardinality int."""
    if y.dtype == "object" or pd.api.types.is_bool_dtype(y):
        return "classification"
    unique_ratio = y.nunique() / len(y)
    if y.nunique() <= 20 and unique_ratio < 0.05:
        return "classification"
    return "regression"


def train_model(df, target):
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found in dataset.")

    X = df.drop(columns=[target])
    y = df[target].copy()

    problem_type = _detect_problem_type(y)

    # --- Encode classification target ---
    label_encoder = None
    if problem_type == "classification" and y.dtype == "object":
        label_encoder = LabelEncoder()
        y = pd.Series(label_encoder.fit_transform(y), index=y.index)

    # --- Track original column types before encoding ---
    numeric_cols_orig = list(X.select_dtypes(include=["number"]).columns)
    categorical_cols_orig = list(X.select_dtypes(include=["object"]).columns)

    # --- Fill missing values ---
    for col in X.columns:
        if X[col].dtype == "object":
            X[col] = X[col].fillna("missing")
        else:
            X[col] = X[col].fillna(X[col].median())

    # --- One-hot encode ---
    X = pd.get_dummies(X)
    columns = list(X.columns)

    # --- Train / test split ---
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if problem_type == "classification" else None
    )

    # --- Define candidate models (pipelines with optional scaling) ---
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
        try:
            # Dynamic cross-validation on training set
            cv = min(5, len(y_train))
            if problem_type == "classification":
                cv = min(cv, y_train.value_counts().min())
            cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring=cv_scoring, n_jobs=-1)
            cv_mean = float(np.mean(cv_scores))
            cv_std = float(np.std(cv_scores))

            # Final fit on full train set
            model.fit(X_train, y_train)
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

        except Exception as e:
            scores[name] = {"error": str(e)}

    if best_model is None:
        raise RuntimeError("All models failed to train.")

    # Attach metadata for downstream use
    best_model._automl_meta = {
        "problem_type": problem_type,
        "target": target,
        "num_rows": len(df),
        "num_features": len(columns),
        "numeric_columns": numeric_cols_orig,
        "categorical_columns": categorical_cols_orig,
        "best_model_name": type(best_model.named_steps.get("clf") or best_model.named_steps.get("reg") if hasattr(best_model, "named_steps") else best_model).__name__,
        "best_cv_score": round(float(best_score), 4),
        "label_classes": label_encoder.classes_.tolist() if label_encoder else None,
    }

    return best_model, scores, columns


def predict_model(model, data, columns):
    df = pd.DataFrame([data])

    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].fillna("missing")
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df = pd.get_dummies(df)
    df = df.reindex(columns=columns, fill_value=0)

    preds = model.predict(df)
    meta = getattr(model, "_automl_meta", {})

    # Decode label if classifier used LabelEncoder
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

    # Include predicted probabilities for classifiers
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