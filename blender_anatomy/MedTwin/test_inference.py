import asyncio
from fastapi.testclient import TestClient
from cloud.api.main import app

client = TestClient(app)

def test_inference():
    tests = [
        {"organ": "lungs", "model_id": "pulmo-pneumonia-cnn", "patient_id": "PT-001"},
        {"organ": "lungs", "model_id": "pulmo-cancer-xgb", "patient_id": "PT-001"},
        {"organ": "brain", "model_id": "neuro-dcgan", "patient_id": "PT-001"}
    ]
    
    for payload in tests:
        print(f"Testing {payload['model_id']}...")
        response = client.post("/api/v1/inference/run", json=payload)
        if response.status_code == 200:
            print(f"SUCCESS: {response.json()['result']['finding']}")
        else:
            print(f"FAILED {response.status_code}: {response.text}")

if __name__ == "__main__":
    test_inference()
