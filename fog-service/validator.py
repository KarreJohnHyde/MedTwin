import time
import json
import hmac
import hashlib
import paho.mqtt.client as mqtt

SECRET_KEY = b"medtwin_secure_edge_key_2026"
BROKER = "localhost"
PORT = 1883
TOPIC_EDGE_TELEMETRY = "medtwin/+/telemetry"
TOPIC_EDGE_IMAGING = "medtwin/+/imaging"
TOPIC_CLOUD_TELEMETRY = "medtwin/cloud/telemetry"
TOPIC_CLOUD_IMAGING = "medtwin/cloud/imaging"

MAX_CLOCK_SKEW_SECONDS = 5.0

def verify_packet(packet_json):
    """Verifies HMAC signature and timestamp."""
    try:
        data = json.loads(packet_json)
        payload_str = data.get("payload")
        received_hmac = data.get("hmac")
        
        if not payload_str or not received_hmac:
            return False, "Missing payload or HMAC"
            
        # 1. Verify HMAC
        calculated_hmac = hmac.new(SECRET_KEY, payload_str.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated_hmac, received_hmac):
            return False, "Invalid HMAC signature (Tamper/Impersonation detected)"
            
        # 2. Verify Timestamp (Replay protection)
        payload_dict = json.loads(payload_str)
        packet_time = payload_dict.get("timestamp", 0)
        current_time = time.time()
        
        if abs(current_time - packet_time) > MAX_CLOCK_SKEW_SECONDS:
            return False, f"Packet too old (Skew: {current_time - packet_time:.2f}s). Replay attack detected."
            
        return True, payload_dict
        
    except Exception as e:
        return False, f"Parse error: {e}"

def on_connect(client, userdata, flags, rc):
    print(f"Fog Validator connected with result code {rc}")
    client.subscribe(TOPIC_EDGE_TELEMETRY)
    client.subscribe(TOPIC_EDGE_IMAGING)

def on_message(client, userdata, msg):
    print(f"\n[Fog] Received packet on {msg.topic}")
    is_valid, result = verify_packet(msg.payload.decode())
    
    if is_valid:
        print(f"[Fog] Validation SUCCESS. Forwarding to cloud bus.")
        # Lightweight gating could be done here (e.g., check if HR > 200 before waking cloud)
        
        forward_topic = TOPIC_CLOUD_TELEMETRY if "telemetry" in msg.topic else TOPIC_CLOUD_IMAGING
        client.publish(forward_topic, json.dumps(result))
    else:
        print(f"[Fog] Validation FAILED: {result}")
        print("[Fog] Packet dropped.")

def start_validator():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(BROKER, PORT, 60)
        print("Starting Fog Validator Service...")
        client.loop_forever()
    except Exception as e:
        print(f"Failed to connect to broker: {e}")

if __name__ == "__main__":
    start_validator()
