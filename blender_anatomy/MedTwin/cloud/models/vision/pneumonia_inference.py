import torch
from pathlib import Path
import base64
import io
import numpy as np
from PIL import Image

try:
    # Need the model definition to load the state dict
    # We can either import it or just let it fail gracefully
    import sys
    sys.path.append(str(Path(__file__).resolve().parents[3] / "scripts"))
    from train_lung_classifier import PneumoniaCNN
except ImportError:
    PneumoniaCNN = None


class PneumoniaModel:
    def __init__(self):
        self.model_type = "vision"
        self.model = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Try loading artifact
        artifact_path = Path(__file__).resolve().parents[3] / "artifacts" / "pneumonia_cnn.pt"
        if artifact_path.exists() and PneumoniaCNN is not None:
            try:
                artifact = torch.load(artifact_path, map_location=self.device)
                self.model = PneumoniaCNN()
                self.model.load_state_dict(artifact["state_dict"])
                self.model.to(self.device)
                self.model.eval()
                self.img_size = artifact.get("input_size", 128)
            except Exception as e:
                print(f"Warning: Failed to load pneumonia artifact: {e}")

    def predict(self, image_base64: str) -> dict:
        if self.model is None:
            # Fallback mock logic
            return {
                "prediction_class": "Pneumonia Detected",
                "confidence": 0.92,
                "summary": "Bilateral infiltrates consistent with pneumonia (Mock)"
            }
            
        # Inference using trained artifact
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
            
        try:
            binary = base64.b64decode(image_base64, validate=True)
            image = Image.open(io.BytesIO(binary)).convert("L").resize((self.img_size, self.img_size))
            img_tensor = torch.from_numpy(np.asarray(image, dtype=np.float32).copy())
            img_tensor = img_tensor.unsqueeze(0).unsqueeze(0).div(255.0).to(self.device)
            
            with torch.no_grad():
                output = self.model(img_tensor)
                prob = torch.sigmoid(output).item()
                
            return {
                "prediction_class": "Pneumonia Detected" if prob >= 0.5 else "Normal",
                "confidence": prob if prob >= 0.5 else 1.0 - prob,
                "summary": "AI detected signs of pneumonia" if prob >= 0.5 else "Clear lungs"
            }
        except Exception as e:
            return {
                "prediction_class": "Error",
                "confidence": 0.0,
                "summary": f"Inference failed: {e}"
            }

_instance = None
def get_pneumonia_model():
    global _instance
    if _instance is None:
        _instance = PneumoniaModel()
    return _instance
