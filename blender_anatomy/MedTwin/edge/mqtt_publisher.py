import time
import json
import hmac
import hashlib
import random
import csv
import os
import paho.mqtt.client as mqtt

class RealMQTTClient:
    def __init__(self, broker="localhost", port=1883):
        self.client = mqtt.Client()
        try:
            self.client.connect(broker, port, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"[MQTT] Failed to connect on init: {e}")

    def publish(self, topic, payload):
        self.client.publish(topic, payload)
        print(f"[MQTT] Publishing to {topic} ({len(payload)} bytes)")

class EdgeAcquisitionDaemon:
    """
    Main loop running on the Raspberry Pi.
    Acquires data via SPI from MCP3008, filters it, and publishes via MQTT.
    """
    def __init__(self, patient_id="PT-001", broker_url="localhost", sampling_rate=360):
        self.patient_id = patient_id
        self.sampling_rate = sampling_rate
        self.window_size = int(sampling_rate * 2.5) # 2.5 second window
        
        self.secret_key = b"medtwin_secure_edge_key_2026"
        
        try:
            from .adaptive_filter import NLMSFilter
        except ImportError:
            from adaptive_filter import NLMSFilter
            
        # Setup MQTT
        self.mqtt_client = RealMQTTClient()
        
        # Setup NLMS filter
        self.filter = NLMSFilter(num_taps=32, mu=0.1)
        self.buffer = []
        
        # Load heart.csv data
        self.heart_data = []
        csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "heart.csv"))
        try:
            with open(csv_path, "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    row_data = {k: float(v) if '.' in v else int(v) for k, v in row.items()}
                    self.heart_data.append(row_data)
        except Exception as e:
            print(f"Warning: could not load heart.csv: {e}")

    def sign_payload(self, payload_dict):
        """Appends a cryptographic HMAC signature."""
        payload_str = json.dumps(payload_dict, sort_keys=True, separators=(',', ':'), allow_nan=False)
        signature = hmac.new(self.secret_key, payload_str.encode('utf-8'), hashlib.sha256).hexdigest()
        return {
            "payload": payload_str,
            "hmac": signature
        }

    def simulate_adc_read(self):
        """Simulate reading from MCP3008 via SPI."""
        # Simulated ECG baseline + QRS spike
        if len(self.buffer) % int(self.sampling_rate * 0.8) == 0:
            return 800 + random.uniform(-10, 10) # QRS spike
        return 512 + random.uniform(-20, 20) # Baseline

    def run(self):
        print(f"Starting MedTwin Edge Daemon for patient {self.patient_id}")
        print(f"Sampling at {self.sampling_rate} Hz. Window size: {self.window_size}")
        
        try:
            while True:
                # 1. Acquire raw data
                raw_val = self.simulate_adc_read()
                
                # 2. Filter (assuming a 0 reference for mock)
                clean_val = self.filter.filter_step(raw_val, reference_input=0)
                
                self.buffer.append(clean_val)
                
                # 3. If window is full, package and send
                if len(self.buffer) >= self.window_size:
                    data = {
                        "patient_id": self.patient_id,
                        "timestamp": time.time(),
                        "ecg": self.buffer.copy()
                    }
                    if self.heart_data:
                        # Inject random tabular data
                        data.update(random.choice(self.heart_data))
                    
                    signed_package = self.sign_payload(data)
                    topic = "medtwin/cloud/telemetry"
                    
                    self.mqtt_client.publish(topic, json.dumps(signed_package))
                    
                    self.buffer.clear()
                    
                time.sleep(1.0 / self.sampling_rate)
                
        except KeyboardInterrupt:
            print("\nShutting down edge daemon.")

if __name__ == "__main__":
    daemon = EdgeAcquisitionDaemon()
    print("Starting continuous live telemetry simulation...")
    
    import urllib.request
    import urllib.error
    
    # Fast forward simulation
    while True:
        for _ in range(daemon.window_size):
            raw_val = daemon.simulate_adc_read()
            daemon.buffer.append(raw_val)
        
        data = {
            "patient_id": daemon.patient_id,
            "timestamp": time.time(),
            "ecg": daemon.buffer
        }
        if daemon.heart_data:
            data.update(random.choice(daemon.heart_data))
            
        package = daemon.sign_payload(data)
        
        # Try MQTT first, fallback to HTTP REST API
        try:
            daemon.mqtt_client.publish("medtwin/cloud/telemetry", json.dumps(package))
        except Exception as e:
            print(f"[Fallback] MQTT publish failed: {e}")
            
        try:
            req = urllib.request.Request(
                "http://localhost:8001/api/v1/ingest/telemetry",
                data=json.dumps(package).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            urllib.request.urlopen(req)
            print("[HTTP] Successfully posted telemetry to API Hub")
        except urllib.error.URLError as e:
            print(f"[HTTP] Failed to post telemetry: {e}")
            
        daemon.buffer.clear()
        time.sleep(1.0) # Send updates every second
