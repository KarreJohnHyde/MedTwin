import os
import time
import json
import hmac
import hashlib
import argparse
import paho.mqtt.client as mqtt
import wfdb

SECRET_KEY = b"medtwin_secure_edge_key_2026"
BROKER = "localhost"
PORT = 1883
TOPIC_TELEMETRY = "medtwin/edge/telemetry"
TOPIC_IMAGING = "medtwin/edge/imaging"

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

def sign_payload(payload_dict):
    """Appends a cryptographic HMAC signature."""
    payload_str = json.dumps(payload_dict, sort_keys=True, separators=(',', ':'), allow_nan=False)
    signature = hmac.new(SECRET_KEY, payload_str.encode('utf-8'), hashlib.sha256).hexdigest()
    return {
        "payload": payload_str,
        "hmac": signature
    }

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker with result code {rc}")

def replay_patient(record_id="100", patient_id="PT-001"):
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    
    # Ideally TLS is used, but for local dev testing without mounting certs locally to python:
    # client.tls_set(ca_certs="../infra/mosquitto/certs/ca.crt")
    
    try:
        client.connect(BROKER, PORT, 60)
    except Exception as e:
        print(f"Failed to connect to broker: {e}")
        return

    client.loop_start()
    
    print(f"Loading WFDB record {record_id} for MedTwin patient {patient_id} from {DATA_DIR}/mit_bih...")
    record_path = os.path.join(DATA_DIR, "mit_bih", record_id)
    if not os.path.exists(record_path + ".dat"):
        print(f"Record {record_id} not found. Did you run scripts/prepare_datasets.py?")
        return

    record = wfdb.rdrecord(record_path, sampto=3000) # Read first 3000 samples
    signal = record.p_signal[:, 0] # Lead I
    fs = record.fs
    
    window_size = int(fs * 2.5) # 2.5 second window
    
    print(f"Publishing mock image event for {patient_id}...")
    img_payload = sign_payload({
        "patient_id": patient_id,
        "timestamp": time.time(),
        "event_type": "xray_capture",
        "image_ref": f"mock_fracture_{record_id}.png"
    })
    client.publish(TOPIC_IMAGING, json.dumps(img_payload))
    
    print(f"Starting ECG telemetry replay (fs={fs} Hz)...")
    
    for i in range(0, len(signal), window_size):
        window = signal[i:i+window_size].tolist()
        if len(window) < window_size:
            break
            
        payload = sign_payload({
            "patient_id": patient_id,
            "timestamp": time.time(),
            "ecg_window": window,
            "heart_rate": 75 # Mock heart rate
        })
        
        client.publish(TOPIC_TELEMETRY, json.dumps(payload))
        print(f"Published window {i//window_size}")
        time.sleep(2.5) # Simulate real-time
        
    client.loop_stop()
    print("Replay finished.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--record", type=str, default="100", help="MIT-BIH record ID (e.g., 100 or 106)")
    parser.add_argument("--patient-id", type=str, default="PT-001", help="MedTwin patient ID displayed by the dashboard")
    args = parser.parse_args()
    replay_patient(args.record, args.patient_id)
