class StrokeModel:
    def __init__(self):
        self.model_type = "tabular"

    def predict(self, features: dict) -> dict:
        # Mock logic based on brain-stroke-analysis-accuracy-96-03.ipynb
        age = features.get("age", 50)
        risk = min(0.95, max(0.05, age / 100.0 + 0.1))
        return {
            "prediction_class": "High Risk" if risk > 0.6 else "Low Risk",
            "confidence": risk,
            "risk_score": risk
        }

_instance = None
def get_stroke_model():
    global _instance
    if _instance is None:
        _instance = StrokeModel()
    return _instance
