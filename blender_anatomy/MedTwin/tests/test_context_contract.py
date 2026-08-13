from cloud.api.context_contract import response_envelope, validate_context_pair
from pathlib import Path


def test_context_pair_validation_fails_closed():
    assert validate_context_pair("lungs", "pulmo-densenet") is True
    assert validate_context_pair("lungs", "cardio-xgb") is False
    assert validate_context_pair("liver", "hepatic-placeholder") is False


def test_response_envelope_preserves_full_context():
    payload = response_envelope(
        patient_id="P-TEST",
        organ="lungs",
        model_id="pulmo-densenet",
        config={
            "marker_type": "organ_level",
            "finding": "No pneumonia-positive image pattern",
            "confidence": 0.92,
            "detail": "Pulmonary-only result",
            "risk": 0.18,
            "attributions": [],
        },
    )

    assert payload["context_key"] == "P-TEST:lungs:pulmo-densenet"
    assert payload["patient_id"] == "P-TEST"
    assert payload["organ"] == "lungs"
    assert payload["model_id"] == "pulmo-densenet"
    assert payload["synthetic"] is True


def test_strict_inference_route_has_no_legacy_collision():
    source = (Path(__file__).parents[1] / "cloud" / "api" / "main.py").read_text(encoding="utf-8")
    assert source.count('@app.post("/api/v1/inference/run"') == 1
    assert '@app.post("/api/v1/inference/legacy-run"' in source
