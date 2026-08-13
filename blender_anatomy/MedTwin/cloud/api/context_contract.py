"""Lightweight, side-effect-free context validation for inference routing."""

from datetime import datetime, timezone
from typing import Any, Dict
from uuid import uuid4


ALLOWED_MODELS: Dict[str, set[str]] = {
    "heart": {"cardio-xgb", "cardio-resnet"},
    "brain": {"neuro-resnet", "neuro-transformer", "neuro-dcgan"},
    "lungs": {"pulmo-densenet", "pulmo-pneumonia-cnn", "pulmo-cancer-xgb"},
    "intestine": {"gastro-unet"},
    "skeleton": {"skeletal-bmd"},
}


def validate_context_pair(organ: str, model_id: str) -> bool:
    """Return true only for an explicitly registered organ/model pair."""
    return model_id in ALLOWED_MODELS.get(organ, set())


def allowed_registry_message() -> str:
    return ", ".join(
        f"{organ}/{model_id}"
        for organ in sorted(ALLOWED_MODELS)
        for model_id in sorted(ALLOWED_MODELS[organ])
    )


def response_envelope(
    *, patient_id: str, organ: str, model_id: str, config: Dict[str, Any]
) -> Dict[str, Any]:
    """Wrap an organ-specific result in the leak-safe API envelope."""
    return {
        "patient_id": patient_id,
        "organ": organ,
        "model_id": model_id,
        "context_key": f"{patient_id}:{organ}:{model_id}",
        "marker_type": config["marker_type"],
        "inference_id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "synthetic": True,
        "result": {
            "finding": config["finding"],
            "confidence": config["confidence"],
            "detail": config["detail"],
            "anchor_region_or_coords": config.get("anchor"),
        },
        "fusion": {
            "risk": config["risk"],
            "concordance": 0.92 if organ == "heart" else 0.86,
            "certainty": 0.89 if organ == "heart" else 0.82,
            "attributions": config["attributions"],
        },
    }
