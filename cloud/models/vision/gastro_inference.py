class GastroModel:
    def __init__(self):
        self.model_type = "vision"

    def predict(self, image_base64: str) -> dict:
        # Mock logic based on uwmgi-unet-train-pytorch.ipynb
        return {
            "prediction_class": "GI Tract Anomaly",
            "confidence": 0.85,
            "summary": "Segmented anomalous region in lower GI tract"
        }

_instance = None
def get_gastro_model():
    global _instance
    if _instance is None:
        _instance = GastroModel()
    return _instance
