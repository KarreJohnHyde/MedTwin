class LungCancerModel:
    def __init__(self):
        self.model_type = "tabular"

    def predict(self, features: dict) -> dict:
        # Mock logic based on lung-cancer-prediction.ipynb
        smoking = features.get("smoking", 1)
        risk = 0.8 if smoking else 0.2
        return {
            "prediction_class": "Positive" if risk > 0.5 else "Negative",
            "confidence": risk,
            "risk_score": risk
        }

_instance = None
def get_lung_cancer_model():
    global _instance
    if _instance is None:
        _instance = LungCancerModel()
    return _instance
