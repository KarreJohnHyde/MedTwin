"""Reproducible XGBoost training for the UCI-style heart-disease table.

The implementation draws on the supplied heart-disease notebooks' model
comparison and ROC-AUC practices.  It intentionally removes duplicate rows
before splitting, because the supplied CSV contains repeated observations that
would otherwise leak into both validation sets.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

logger = logging.getLogger("cardio_ultra.models.xgboost")

HEART_FEATURES = (
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
    "thalach", "exang", "oldpeak", "slope", "ca", "thal",
)
TARGET_COLUMN = "target"

try:
    import joblib
    import xgboost as xgb
    from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, roc_auc_score
    from sklearn.model_selection import train_test_split
except ImportError:
    joblib = xgb = None
    accuracy_score = confusion_matrix = f1_score = roc_auc_score = train_test_split = None


def _require_dependencies() -> None:
    if xgb is None or joblib is None:
        raise RuntimeError("xgboost, scikit-learn, and joblib are required to train the heart model")


def validate_heart_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Validate the dataset schema and return a clean, deduplicated frame."""
    required = set(HEART_FEATURES) | {TARGET_COLUMN}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Heart dataset is missing columns: {sorted(missing)}")
    clean = df.loc[:, [*HEART_FEATURES, TARGET_COLUMN]].copy()
    clean = clean.apply(pd.to_numeric, errors="raise").dropna()
    if not clean[TARGET_COLUMN].isin((0, 1)).all() or clean[TARGET_COLUMN].nunique() != 2:
        raise ValueError("target must contain both binary labels 0 and 1")
    duplicates = len(clean) - len(clean.drop_duplicates())
    if duplicates:
        logger.warning("Removed %d duplicate heart-disease rows before validation split", duplicates)
        clean = clean.drop_duplicates().reset_index(drop=True)
    return clean


def train_xgboost_heart_model(
    df: pd.DataFrame,
    *,
    test_size: float = 0.2,
    random_state: int = 42,
) -> tuple[Any, dict[str, Any]]:
    """Fit an XGBoost model and return it with held-out evaluation metrics."""
    _require_dependencies()
    clean = validate_heart_dataframe(df)
    features = clean.loc[:, HEART_FEATURES]
    target = clean[TARGET_COLUMN].astype(int)
    x_train, x_test, y_train, y_test = train_test_split(
        features, target, test_size=test_size, random_state=random_state, stratify=target
    )
    model = xgb.XGBClassifier(
        n_estimators=250,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="logloss",
        random_state=random_state,
    )
    model.fit(x_train, y_train)
    probabilities = model.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    metrics = {
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
        "f1": float(f1_score(y_test, predictions, zero_division=0)),
        "accuracy": float(accuracy_score(y_test, predictions)),
        "confusion_matrix": confusion_matrix(y_test, predictions).tolist(),
        "train_rows": int(len(x_train)),
        "validation_rows": int(len(x_test)),
        "unique_rows": int(len(clean)),
        "feature_names": list(HEART_FEATURES),
    }
    logger.info("XGBoost validation: ROC-AUC %.4f, F1 %.4f, accuracy %.4f", metrics["roc_auc"], metrics["f1"], metrics["accuracy"])
    return model, metrics


def save_heart_model(model: Any, metrics: dict[str, Any], output_path: str | Path) -> Path:
    """Persist a versioned local artifact that the API can load explicitly."""
    _require_dependencies()
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "metrics": metrics, "feature_names": list(HEART_FEATURES)}, destination)
    return destination


def load_heart_model(model_path: str | Path) -> dict[str, Any]:
    _require_dependencies()
    artifact = joblib.load(model_path)
    if not isinstance(artifact, dict) or set(artifact.get("feature_names", ())) != set(HEART_FEATURES):
        raise ValueError("Invalid heart model artifact or feature schema")
    return artifact
