class PneumoniaModel:
    def __init__(self):
        self.model_type = "vision"

    def predict(self, image_base64: str) -> dict:
        # Mock logic based on pneumonia-detection-using-cnn-92-6-accuracy.ipynb
        return {
            "prediction_class": "Pneumonia Detected",
            "confidence": 0.92,
            "summary": "Bilateral infiltrates consistent with pneumonia"
        }

_instance = None
def get_pneumonia_model():
    global _instance
    if _instance is None:
        _instance = PneumoniaModel()
    return _instance
