from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import (
    RandomForestRegressor, RandomForestClassifier,
    GradientBoostingClassifier, GradientBoostingRegressor,
    AdaBoostClassifier, AdaBoostRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
    HistGradientBoostingClassifier, HistGradientBoostingRegressor,
)
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import r2_score, accuracy_score, f1_score, mean_absolute_error
import pandas as pd
import numpy as np
import threading


class TrainingCancelledError(Exception):
    """thrown when someone cancels training mid-way"""
    pass


def _detect_problem_type(y):
    """figure out if we're doing classification or regression
    - strings / booleans -> classification
    - low cardinality ints -> also classification  
    - everything else -> regression
    """
    if y.dtype == "object" or pd.api.types.is_bool_dtype(y):
        return "classification"
    n_unique = y.nunique()
    ratio = n_unique / len(y)
    if n_unique <= 20 and ratio < 0.05:
        return "classification"
    return "regression"


def _infer_column_types(df: pd.DataFrame):
    """split columns into numeric vs categorical
    also handles the case where a column looks like numbers
    but pandas reads it as object type
    """
    numeric = []
    categorical = []

    for col in df.columns:
        s = df[col]
        if pd.api.types.is_numeric_dtype(s) or pd.api.types.is_bool_dtype(s):
            numeric.append(col)
            continue

        non_null = s.dropna().astype(str).str.strip()
        if non_null.empty:
            categorical.append(col)
            continue

        # try converting to numbers - if most values convert ok, treat as numeric
        coerced = pd.to_numeric(non_null, errors="coerce")
        pct_numeric = coerced.notna().mean()
        if pct_numeric >= 0.9 and coerced.notna().sum() >= 3:
            numeric.append(col)
        else:
            categorical.append(col)

    return numeric, categorical


def _find_redundant_features(df: pd.DataFrame, threshold: int = 15):
    """find string columns with too many unique values
    these are probably IDs or names, not useful features
    numeric columns are kept regardless of cardinality
    """
    if df.empty:
        return []

    redundant = []
    for col in df.columns:
        if not pd.api.types.is_string_dtype(df[col]):
            continue
        n_unique = df[col].nunique(dropna=False)
        if n_unique > threshold:
            redundant.append(col)
    return redundant


def _check_cancel(cancel_event: threading.Event | None):
    """raises error if user triggered cancel"""
    if cancel_event is not None and cancel_event.is_set():
        raise TrainingCancelledError("Training was cancelled by client disconnect.")


def _prepare_predict_input(df: pd.DataFrame, numeric_cols: list, fill_vals: dict, columns: list, known_categorical_values: dict = None):
    """clean up raw input data so it matches what the model expects"""
    X = df.copy()
    for col in X.columns:
        if col in numeric_cols:
            X[col] = pd.to_numeric(X[col], errors="coerce")
            X[col] = X[col].fillna(fill_vals.get(col, 0.0))
        else:
            X[col] = X[col].astype(str).fillna("missing")
            # only allow values the model has seen before
            if known_categorical_values and col in known_categorical_values:
                known_vals = set(known_categorical_values[col])
                X[col] = X[col].where(X[col].isin(known_vals), "missing")

    X = pd.get_dummies(X)
    X = X.reindex(columns=columns, fill_value=0)
    return X


def train_model(df, target, cancel_event: threading.Event | None = None):
    # match column name case-insensitively
    col_map = {c.lower(): c for c in df.columns}
    tgt_lower = target.strip().lower()
    if tgt_lower not in col_map:
        raise ValueError(f"Target column '{target}' not found in dataset.")
    target = col_map[tgt_lower]

    _check_cancel(cancel_event)

    # drop columns that are basically useless (high cardinality strings)
    redundant = _find_redundant_features(df.drop(columns=[target]))
    if target in redundant:
        raise ValueError(
            f"Target column '{target}' has extremely high cardinality and cannot be used for training."
        )

    X = df.drop(columns=[target] + redundant)
    y = df[target].copy()

    prob_type = _detect_problem_type(y)

    # encode string labels to numbers for classification
    le = None
    if prob_type == "classification" and y.dtype == "object":
        le = LabelEncoder()
        y = pd.Series(le.fit_transform(y), index=y.index)

    _check_cancel(cancel_event)

    # figure out original column types before one-hot encoding
    num_cols, cat_cols = _infer_column_types(X)
    fill_vals = {}

    # handle missing values
    for col in X.columns:
        if col in num_cols:
            X[col] = pd.to_numeric(X[col], errors="coerce")
            # fill NAs with median, or 0 if column is all NaN
            med = float(X[col].median()) if not X[col].dropna().empty else 0.0
            X[col] = X[col].fillna(med)
            fill_vals[col] = med
        else:
            X[col] = X[col].astype(str).fillna("missing")

    _check_cancel(cancel_event)

    # one-hot encode categoricals
    X = pd.get_dummies(X, drop_first=True)
    columns = list(X.columns)

    # clean up infinities and constant columns
    X = X.replace([np.inf, -np.inf], np.nan)
    ok_idx = X.dropna().index
    X = X.loc[ok_idx]
    y = y.loc[ok_idx]
    X = X.loc[:, X.nunique() > 1]

    _check_cancel(cancel_event)

    # stratify for classification if possible
    strat = None
    if prob_type == "classification" and y.value_counts().min() >= 2:
        strat = y

    # split into train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=strat
    )

    # all the models we want to try
    if prob_type == "classification":
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
            "ExtraTreesClassifier": ExtraTreesClassifier(
                n_estimators=200, max_depth=None, random_state=42, n_jobs=-1
            ),
            "HistGradientBoostingClassifier": HistGradientBoostingClassifier(
                learning_rate=0.1, max_iter=100, random_state=42
            ),
            "KNeighborsClassifier": KNeighborsClassifier(n_neighbors=5),
            "AdaBoostClassifier": AdaBoostClassifier(
                n_estimators=100, learning_rate=0.5, random_state=42
            ),
        }
        scoring = "f1_weighted"
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
            "ExtraTreesRegressor": ExtraTreesRegressor(
                n_estimators=200, random_state=42, n_jobs=-1
            ),
            "HistGradientBoostingRegressor": HistGradientBoostingRegressor(
                learning_rate=0.1, max_iter=100, random_state=42
            ),
            "KNeighborsRegressor": KNeighborsRegressor(n_neighbors=5),
            "AdaBoostRegressor": AdaBoostRegressor(
                n_estimators=100, learning_rate=0.5, random_state=42
            ),
        }
        scoring = "r2"

    best_model = None
    best_score = -np.inf
    scores = {}

    for name, model in candidates.items():
        _check_cancel(cancel_event)

        try:
            # figure out how many CV folds we can do
            cv = min(5, len(y_train))

            if prob_type == "classification":
                min_class_count = y_train.value_counts().min()
                if min_class_count < 2:
                    cv = 2
                else:
                    cv = min(cv, min_class_count)

            # safety net
            if cv < 2:
                cv = 2

            cv_scores = cross_val_score(
                model, X_train, y_train,
                cv=cv, scoring=scoring,
                n_jobs=1,  # keep at 1 so cancel check works
                error_score=np.nan
            )

            _check_cancel(cancel_event)

            good_scores = cv_scores[~np.isnan(cv_scores)]
            if len(good_scores) == 0:
                raise ValueError("All CV folds failed")

            cv_mean = float(np.mean(good_scores))
            cv_std = float(np.std(good_scores))

            if len(good_scores) < len(cv_scores):
                print(f"(!) {name}: {len(cv_scores)-len(good_scores)} folds failed, using remaining {len(good_scores)}")

            # train on full training set
            model.fit(X_train, y_train)
            _check_cancel(cancel_event)

            preds = model.predict(X_test)

            # record scores - cv_mean is what we use to pick the winner
            if prob_type == "classification":
                acc = float(accuracy_score(y_test, preds))
                f1 = float(f1_score(y_test, preds, average="weighted", zero_division=0))
                scores[name] = {
                    "cv_mean": round(cv_mean, 4),
                    "cv_std": round(cv_std, 4),
                    "test_accuracy": round(acc, 4),
                    "test_f1_weighted": round(f1, 4),
                }
                sel_score = cv_mean
            else:
                r2 = float(r2_score(y_test, preds))
                mae = float(mean_absolute_error(y_test, preds))
                scores[name] = {
                    "cv_mean_r2": round(cv_mean, 4),
                    "cv_std": round(cv_std, 4),
                    "test_r2": round(r2, 4),
                    "test_mae": round(mae, 4),
                }
                sel_score = cv_mean

            if sel_score > best_score:
                best_score = sel_score
                best_model = model

        except TrainingCancelledError:
            print(f"[STOP] Training cancelled during {name}.")
            raise
        except Exception as e:
            print(f"{name} failed:", e)
            scores[name] = {"error": str(e)}

    if best_model is None:
        raise RuntimeError("All models failed to train.")

    # Collect unique categorical values for future prediction validation
    known_values = {}
    for col in cat_cols:
        if col in df.columns:
            known_values[col] = df[col].dropna().astype(str).unique().tolist()

    # stash metadata on the model object so we can use it later
    best_model._automl_meta = {
        "problem_type": prob_type,
        "target": target,
        "num_rows": len(df),
        "num_features": len(columns),
        "numeric_columns": num_cols,
        "categorical_columns": cat_cols,
        "known_categorical_values": known_values, # for prediction validation
        "numeric_fill_values": fill_vals,
        "original_columns": df.drop(columns=[target]).columns.tolist(),
        "redundant_features": redundant,
        "best_model_name": type(best_model.named_steps.get("clf") or best_model.named_steps.get("reg") if hasattr(best_model, "named_steps") else best_model).__name__,
        "best_cv_score": round(float(best_score), 4),
        "label_classes": le.classes_.tolist() if le else None,
    }

    return best_model, scores, columns


def predict_model(model, data, columns, global_df=None):
    """run prediction on a single row or a dataframe"""
    if isinstance(data, pd.DataFrame):
        df = data.copy()
    else:
        df = pd.DataFrame([data])

    meta = getattr(model, "_automl_meta", {})
    num_cols = set(meta.get("numeric_columns", []))
    fill_vals = meta.get("numeric_fill_values", {})
    known_cats = meta.get("known_categorical_values")

    df = _prepare_predict_input(df, num_cols, fill_vals, columns, known_cats)

    preds = model.predict(df)

    label_classes = meta.get("label_classes")
    decoded = preds.tolist()
    if label_classes and all(isinstance(p, (int, np.integer)) for p in preds):
        decoded = [label_classes[int(p)] for p in preds]

    result = {
        "prediction": decoded,
        "model_type": meta.get("best_model_name", type(model).__name__),
        "problem_type": meta.get("problem_type"),
        "target": meta.get("target"),
    }

    # also return probabilities if the model supports it
    if hasattr(model, "predict_proba") and len(df) == 1:
        try:
            proba = model.predict_proba(df)[0].tolist()
            result["probabilities"] = {
                (label_classes[i] if label_classes else str(i)): round(p, 4)
                for i, p in enumerate(proba)
            }
        except Exception:
            pass

    return result


def predict_dataset(model, file_df, columns, global_df=None):
    """run predictions on a whole csv file"""
    if file_df.empty:
        return []

    meta = getattr(model, "_automl_meta", {})
    orig_cols = meta.get("original_columns", [])
    if not orig_cols and global_df is not None:
        orig_cols = list(global_df.columns)
        
    missing = [c for c in orig_cols if c not in file_df.columns]
    if missing:
        raise ValueError(f"Uploaded dataset is missing columns: {', '.join(missing)}")

    input_df = file_df[orig_cols].copy()
    num_cols = set(meta.get("numeric_columns", []))
    fill_vals = meta.get("numeric_fill_values", {})
    known_cats = meta.get("known_categorical_values")

    input_df = _prepare_predict_input(input_df, num_cols, fill_vals, columns, known_cats)
    preds = model.predict(input_df)

    label_classes = meta.get("label_classes")
    decoded = preds.tolist()
    if label_classes and all(isinstance(p, (int, np.integer)) for p in preds):
        decoded = [label_classes[int(p)] for p in preds]

    return decoded