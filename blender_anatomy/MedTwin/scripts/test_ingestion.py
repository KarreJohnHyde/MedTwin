import urllib.request
import json
import hmac
import hashlib
import time

SECRET_KEY = b"medtwin_secure_edge_key_2026"

def sign_payload(payload: dict) -> dict:
    payload_str = json.dumps(payload)
    signature = hmac.new(SECRET_KEY, payload_str.encode("utf-8"), hashlib.sha256).hexdigest()
    return {"payload": payload_str, "hmac": signature}

def post_json(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req)
        return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode()}")
        return None

if __name__ == "__main__":
    patient_id = "PT-MOCK-001"
    
    # 1. Send Telemetry
    print("--- 1. Sending Mock Telemetry ---")
    telemetry_payload = {
        "patient_id": patient_id,
        "timestamp": time.time(),
        "sampling_rate": 360,
        "ecg": [0.0] * 720, # Dummy data
        "heart_rate": 75,
        "blood_pressure": "120/80"
    }
    
    signed_telemetry = sign_payload(telemetry_payload)
    res_tel = post_json("http://127.0.0.1:8000/api/v1/ingest/telemetry", signed_telemetry)
    print("Telemetry Response:", json.dumps(res_tel, indent=2))
    
    # 2. Send NLP Report
    print("\n--- 2. Sending Mock NLP Report ---")
    nlp_report = {
        "patient_id": patient_id,
        "report_text": "Patient presents with severe chest pain and shortness of breath. EKG shows signs of afib. No pneumonia or fracture.",
        "source": "mock_ehr"
    }
    res_nlp = post_json("http://127.0.0.1:8000/api/v1/intake/document", nlp_report)
    print("NLP Response:", json.dumps(res_nlp, indent=2))
    
    # 3. Check State
    print("\n--- 3. Fetching Fusion State ---")
    req = urllib.request.Request(f"http://127.0.0.1:8000/api/v1/patients/{patient_id}/state")
    try:
        response = urllib.request.urlopen(req)
        state = json.loads(response.read().decode())
        print("Fusion State:", json.dumps(state, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode()}")
