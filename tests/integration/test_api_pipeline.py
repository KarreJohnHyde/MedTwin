"""Fast API-path regression tests that avoid optional external services."""

import time

from fastapi.testclient import TestClient

from cloud.api.main import app, patient_context
from cloud.api.security import canonical_json, generate_hmac


def signed_packet(payload):
    encoded = canonical_json(payload)
    return {"payload": encoded, "hmac": generate_hmac(encoded)}


def test_signed_telemetry_ingestion_and_documented_state_route():
    patient_context.clear()
    payload = {
        "patient_id": "api-test-01",
        "timestamp": time.time(),
        "heart_rate": 76,
        "ecg_window": [0.1 * (i % 7) for i in range(32)],
    }
    with TestClient(app, raise_server_exceptions=True) as client:
        response = client.post("/api/v1/ingest/telemetry", json=signed_packet(payload))
        assert response.status_code == 200
        assert response.json()["fusion_update"]["heart_rate"] == 76
        state = client.get("/api/v1/patients/api-test-01/state")
        assert state.status_code == 200
        assert state.json()["patient_id"] == "api-test-01"


def test_tampered_telemetry_is_rejected():
    payload = {"patient_id": "api-test-02", "timestamp": time.time(), "ecg_window": [0.1] * 10}
    packet = signed_packet(payload)
    packet["payload"] = packet["payload"].replace("api-test-02", "tampered")
    with TestClient(app, raise_server_exceptions=True) as client:
        response = client.post("/api/v1/ingest/telemetry", json=packet)
    assert response.status_code == 401


def test_imaging_result_updates_fusion_state():
    patient_context.clear()
    with TestClient(app, raise_server_exceptions=True) as client:
        response = client.post(
            "/api/v1/ingest/imaging",
            json={"patient_id": "api-test-03", "finding": "lesion", "confidence": 0.91, "bounding_box": [1, 2, 3, 4]},
        )
    assert response.status_code == 200
    assert response.json()["fusion_update"]["vision_prediction"] == "lesion"
