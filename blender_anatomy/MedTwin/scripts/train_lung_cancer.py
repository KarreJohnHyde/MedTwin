"""Train a local, versioned XGBoost lung cancer risk artifact.

Uses synthetic tabular data to establish the model pipeline.
The model predicts the likelihood of lung cancer based on lifestyle/demographics.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

try:
    from xgboost import XGBClassifier
except ImportError:
    print("Warning: xgboost not installed. Please install it to train this model.")
    sys.exit(1)

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score


def generate_synthetic_tabular_data(n_samples: int = 500) -> pd.DataFrame:
    """Generate synthetic patient data for lung cancer prediction."""
    np.random.seed(42)
    
    # Features commonly found in lung cancer datasets
    age = np.random.randint(30, 85, n_samples)
    smoking = np.random.choice([0, 1], n_samples, p=[0.6, 0.4])
    yellow_fingers = np.where(smoking == 1, np.random.choice([0, 1], n_samples, p=[0.7, 0.3]), 0)
    anxiety = np.random.choice([0, 1], n_samples, p=[0.8, 0.2])
    peer_pressure = np.random.choice([0, 1], n_samples, p=[0.8, 0.2])
    chronic_disease = np.random.choice([0, 1], n_samples, p=[0.85, 0.15])
    fatigue = np.random.choice([0, 1], n_samples, p=[0.7, 0.3])
    allergy = np.random.choice([0, 1], n_samples, p=[0.6, 0.4])
    wheezing = np.random.choice([0, 1], n_samples, p=[0.75, 0.25])
    alcohol = np.random.choice([0, 1], n_samples, p=[0.5, 0.5])
    coughing = np.random.choice([0, 1], n_samples, p=[0.7, 0.3])
    shortness_of_breath = np.where(smoking == 1, np.random.choice([0, 1], n_samples, p=[0.6, 0.4]), np.random.choice([0, 1], n_samples, p=[0.9, 0.1]))
    swallowing_difficulty = np.random.choice([0, 1], n_samples, p=[0.9, 0.1])
    chest_pain = np.random.choice([0, 1], n_samples, p=[0.8, 0.2])

    # Simple logic to determine target variable (LUNG_CANCER)
    # Higher probability if smoking, chronic disease, old age, shortness of breath
    risk_score = (
        (age / 100) * 0.2 + 
        smoking * 0.4 + 
        chronic_disease * 0.15 + 
        shortness_of_breath * 0.15 + 
        chest_pain * 0.1
    )
    
    # Add some noise
    risk_score += np.random.normal(0, 0.1, n_samples)
    target = (risk_score > 0.5).astype(int)

    df = pd.DataFrame({
        "AGE": age,
        "SMOKING": smoking,
        "YELLOW_FINGERS": yellow_fingers,
        "ANXIETY": anxiety,
        "PEER_PRESSURE": peer_pressure,
        "CHRONIC_DISEASE": chronic_disease,
        "FATIGUE": fatigue,
        "ALLERGY": allergy,
        "WHEEZING": wheezing,
        "ALCOHOL_CONSUMING": alcohol,
        "COUGHING": coughing,
        "SHORTNESS_OF_BREATH": shortness_of_breath,
        "SWALLOWING_DIFFICULTY": swallowing_difficulty,
        "CHEST_PAIN": chest_pain,
        "LUNG_CANCER": target
    })
    return df


def main() -> None:
    print("--- MedTwin: Training Lung Cancer XGBoost Model (Synthetic Data) ---")
    
    output_path = Path(__file__).resolve().parents[1] / "artifacts" / "lung_cancer_xgb.joblib"
    output_path.parent.mkdir(exist_ok=True, parents=True)
    
    # 1. Generate data
    df = generate_synthetic_tabular_data(n_samples=1000)
    X = df.drop(columns=["LUNG_CANCER"])
    y = df["LUNG_CANCER"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 2. Train model
    model = XGBClassifier(
        n_estimators=100, 
        max_depth=4, 
        learning_rate=0.1, 
        use_label_encoder=False, 
        eval_metric='logloss',
        random_state=42
    )
    model.fit(X_train, y_train)
    
    # 3. Evaluate
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_pred_proba))
    }
    
    print(f"Validation Accuracy: {metrics['accuracy']:.4f}")
    print(f"Validation ROC-AUC: {metrics['roc_auc']:.4f}")
    
    # 4. Save Artifact
    artifact = {
        "model": model,
        "features": list(X.columns),
        "metrics": metrics
    }
    
    joblib.dump(artifact, output_path)
    print(json.dumps({"artifact": str(output_path), "metrics": metrics}, indent=2))

if __name__ == "__main__":
    main()
