from fastapi.testclient import TestClient
from main import app
from label_mapping import map_to_finding

client = TestClient(app)


def test_missing_image_is_invalid_input():
    res = client.post("/infer", json={"model_id": "pulmonary.pneumonia_detection"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "invalid_input"
    assert body["is_mock"] is False


def test_bad_base64_is_invalid_input():
    res = client.post(
        "/infer", json={"model_id": "pulmonary.pneumonia_detection", "image": "not-valid-base64!!"}
    )
    assert res.json()["status"] == "invalid_input"


def test_valid_image_returns_ok_and_is_flagged_as_mock():
    # 1x1 PNG base64
    valid_img = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
    res = client.post(
        "/infer", json={"model_id": "pulmonary.pneumonia_detection", "image": valid_img}
    )
    body = res.json()
    assert body["status"] == "ok"
    assert body["is_mock"] is False
    assert body["label"] in ("pneumonia", "normal")


def test_label_mapping_covers_known_labels():
    finding = map_to_finding("pneumonia", 0.82, "pulmonary.pneumonia_detection")
    assert finding["finding"] == "pneumonia"
    assert finding["system"] == "pulmonary"
    assert finding["source_models"] == ["pulmonary.pneumonia_detection"]


def test_unmapped_label_does_not_get_guessed():
    finding = map_to_finding("some_new_class", 0.5, "pulmonary.pneumonia_detection")
    assert finding["finding"] == "unmapped_label"
    assert finding["confidence"] == 0.0
