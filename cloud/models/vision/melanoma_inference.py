class MelanomaModel:
    def __init__(self):
        self.model_type = "vision"

    def predict(self, image_base64: str) -> dict:
        # Mock logic based on isic-pytorch-training-baseline-image-only.ipynb
        return {
            "prediction_class": "Malignant Melanoma",
            "confidence": 0.88,
            "summary": "Asymmetrical lesion with irregular borders"
        }

_instance = None
def get_melanoma_model():
    global _instance
    if _instance is None:
        _instance = MelanomaModel()
    return _instance
