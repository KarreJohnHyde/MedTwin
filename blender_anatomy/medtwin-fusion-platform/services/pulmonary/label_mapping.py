"""
Raw model label -> standardized finding taxonomy (spec section 5).
One such table per domain model is the pattern to replicate for every
organ added in Phase 3 — this is the file most worth reviewing carefully
per model, since a wrong mapping here silently corrupts fusion output.
"""

LABEL_MAP = {
    "pneumonia": {
        "finding": "pneumonia",
        "system": "pulmonary",
        "severity_band": "moderate",
        "evidence": "opacity pattern consistent with pneumonia",
    },
    "normal": {
        "finding": "no_acute_finding",
        "system": "pulmonary",
        "severity_band": "none",
        "evidence": "no opacity detected",
    },
}


def map_to_finding(raw_label: str, confidence: float, model_id: str) -> dict:
    entry = LABEL_MAP.get(raw_label)
    if entry is None:
        # Unknown label from the model — do NOT guess a mapping. Surface it
        # so a human adds it to LABEL_MAP deliberately.
        return {
            "finding": "unmapped_label",
            "system": "pulmonary",
            "severity_band": "none",
            "confidence": 0.0,
            "source_models": [model_id],
            "evidence": f"model returned unmapped label '{raw_label}'",
        }
    return {**entry, "confidence": confidence, "source_models": [model_id]}
