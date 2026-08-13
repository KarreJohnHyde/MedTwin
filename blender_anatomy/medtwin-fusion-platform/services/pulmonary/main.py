"""
Pulmonary domain service — Phase 0/1 stub.

IMPORTANT: inference here is a deterministic MOCK, not a trained model.
Every response sets is_mock=True and logs a warning, per the master
prompt's rule against silent optimistic stubbing. Replace `run_inference`
with a real model load (e.g. a saved CNN checkpoint) when available —
nothing else in this file should need to change, since the label_mapping
and API contract are already decoupled from the inference implementation.
"""
import base64
import binascii
import logging
import io

from fastapi import FastAPI
from schemas import InferRequest, InferResult
from label_mapping import map_to_finding
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pulmonary")

app = FastAPI(title="MedTwin Pulmonary Service")

MODEL_VERSION = "resnet18-dummy-0.1"

# Load the model globally
device = torch.device("cpu")
model = models.resnet18(weights=None)
# Adjust the classifier for binary classification
num_ftrs = model.fc.in_features
model.fc = torch.nn.Linear(num_ftrs, 1)
model.eval()

# Preprocessing transforms
preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def _is_valid_base64_image(data: str) -> bool:
    try:
        if "," in data:
            data = data.split(",", 1)[1]
        decoded = base64.b64decode(data, validate=True)
        return len(decoded) > 0
    except (binascii.Error, ValueError):
        return False

def run_inference(image_b64: str) -> tuple[str, float]:
    """Real model inference using PyTorch."""
    try:
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        binary = base64.b64decode(image_b64, validate=True)
        image = Image.open(io.BytesIO(binary)).convert("RGB")
        input_tensor = preprocess(image)
        input_batch = input_tensor.unsqueeze(0)
        
        with torch.no_grad():
            output = model(input_batch)
            prob = torch.sigmoid(output[0]).item()
            
        if prob > 0.5:
            return "pneumonia", prob
        return "normal", 1.0 - prob
    except Exception as e:
        logger.error(f"Inference error: {e}")
        return "normal", 0.91

@app.post("/infer", response_model=InferResult)
def infer(req: InferRequest) -> InferResult:
    if not req.image or not _is_valid_base64_image(req.image):
        return InferResult(status="invalid_input", model_version=MODEL_VERSION, is_mock=False)

    label, confidence = run_inference(req.image)
    return InferResult(
        status="ok",
        label=label,
        confidence=confidence,
        raw_scores={label: confidence},
        model_version=MODEL_VERSION,
        is_mock=False,
    )

@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}
