"""Local brain-MRI image-classification artifact loading and inference."""

from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from PIL import Image


class BrainTumorCNN(nn.Module):
    """Small CNN architecture used by the reproducible local trainer."""

    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Sequential(nn.Flatten(), nn.Dropout(0.25), nn.Linear(128, 1))

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(image)).squeeze(1)


def load_brain_tumor_classifier(model_path: str | Path) -> tuple[BrainTumorCNN, dict[str, Any]]:
    artifact = torch.load(model_path, map_location="cpu", weights_only=False)
    required = {"state_dict", "input_size", "threshold", "metrics"}
    if not isinstance(artifact, dict) or not required <= set(artifact):
        raise ValueError("Invalid brain-MRI model artifact")
    model = BrainTumorCNN()
    model.load_state_dict(artifact["state_dict"])
    model.eval()
    return model, artifact


def image_from_base64(encoded_image: str, input_size: int) -> torch.Tensor:
    """Decode a base64 image and produce a normalized RGB batch tensor."""
    if "," in encoded_image:
        encoded_image = encoded_image.split(",", 1)[1]
    try:
        binary = base64.b64decode(encoded_image, validate=True)
        image = Image.open(io.BytesIO(binary)).convert("RGB").resize((input_size, input_size))
    except Exception as exc:
        raise ValueError("image_base64 is not a valid image") from exc
    values = torch.from_numpy(np.asarray(image, dtype=np.float32).copy())
    return values.permute(2, 0, 1).div(255.0).unsqueeze(0)


def predict_brain_tumor_image(model: BrainTumorCNN, artifact: dict[str, Any], encoded_image: str) -> dict[str, Any]:
    image = image_from_base64(encoded_image, int(artifact["input_size"]))
    with torch.no_grad():
        probability = float(torch.sigmoid(model(image))[0])
    threshold = float(artifact["threshold"])
    positive = probability >= threshold
    return {
        "finding": "Tumor-positive image pattern" if positive else "No tumor-positive image pattern",
        "confidence": probability if positive else 1 - probability,
        "positive_probability": probability,
        "threshold": threshold,
        "metrics": artifact["metrics"],
        "model_type": "brain_mri_binary_cnn",
        "localization": "not_available_from_image_classification",
    }


_classifier = None
_classifier_artifact = None
_classifier_path = None


def get_configured_brain_tumor_classifier():
    global _classifier, _classifier_artifact, _classifier_path
    default_path = Path(__file__).resolve().parents[3] / "artifacts" / "brain_tumor_cnn.pt"
    path = os.getenv("MEDTWIN_VISION_MODEL_PATH") or (str(default_path) if default_path.is_file() else None)
    if not path:
        return None, None
    if _classifier is None or _classifier_path != path:
        _classifier, _classifier_artifact = load_brain_tumor_classifier(path)
        _classifier_path = path
    return _classifier, _classifier_artifact
