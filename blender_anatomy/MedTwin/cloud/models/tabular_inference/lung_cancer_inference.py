import joblib
from pathlib import Path

class LungCancerModel:
    def __init__(self):
        self.model_type = "tabular"
        self.model = None
        self.features = []
        
        # Try loading artifact
        artifact_path = Path(__file__).resolve().parents[3] / "artifacts" / "lung_cancer_xgb.joblib"
        if artifact_path.exists():
            try:
                artifact = joblib.load(artifact_path)
                self.model = artifact.get("model")
                self.features = artifact.get("features", [])
            except Exception as e:
                print(f"Warning: Failed to load lung cancer artifact: {e}")

    def predict(self, features: dict) -> dict:
        if self.model is None:
            # Fallback mock logic
            smoking = features.get("smoking", 1)
            risk = 0.8 if smoking else 0.2
            return {
                "prediction_class": "Positive" if risk > 0.5 else "Negative",
                "confidence": risk,
                "risk_score": risk
            }
            
        try:
            import pandas as pd
            # Prepare feature dictionary, defaulting missing to 0
            row = {feat: features.get(feat, features.get(feat.lower(), 0)) for feat in self.features}
            df = pd.DataFrame([row])
            
            prob = float(self.model.predict_proba(df)[:, 1][0])
            
            return {
                "prediction_class": "High Risk" if prob >= 0.5 else "Low Risk",
                "confidence": prob,
                "risk_score": prob
            }
        except Exception as e:
            return {
                "prediction_class": "Error",
                "confidence": 0.0,
                "risk_score": 0.0,
                "summary": f"Inference failed: {e}"
            }

_instance = None
def get_lung_cancer_model():
    global _instance
    if _instance is None:
        _instance = LungCancerModel()
    return _instance
