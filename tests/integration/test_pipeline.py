import sys
import os
import json
import time
import pytest

# Add fog-service and edge-sim to path to import their functions
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "fog-service")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "edge-sim")))

from validator import verify_packet
from replay import sign_payload

def test_valid_packet():
    """Test that a correctly signed and timestamped packet is accepted."""
    payload = {
        "patient_id": "test_01",
        "timestamp": time.time(),
        "ecg_window": [1.0, 2.0, 3.0]
    }
    signed_packet = sign_payload(payload)
    
    is_valid, result = verify_packet(json.dumps(signed_packet))
    assert is_valid is True
    assert result["patient_id"] == "test_01"

def test_tampered_packet():
    """Test that a packet with modified payload (but original signature) is rejected."""
    payload = {
        "patient_id": "test_01",
        "timestamp": time.time(),
        "ecg_window": [1.0, 2.0, 3.0]
    }
    signed_packet = sign_payload(payload)
    
    # Tamper with the payload string
    tampered_payload_str = signed_packet["payload"].replace("3.0", "999.0")
    signed_packet["payload"] = tampered_payload_str
    
    is_valid, result = verify_packet(json.dumps(signed_packet))
    assert is_valid is False
    assert "Invalid HMAC" in result

def test_replay_attack():
    """Test that a correctly signed packet with an old timestamp is rejected."""
    old_time = time.time() - 10.0 # 10 seconds old
    payload = {
        "patient_id": "test_01",
        "timestamp": old_time,
        "ecg_window": [1.0, 2.0, 3.0]
    }
    signed_packet = sign_payload(payload)
    
    is_valid, result = verify_packet(json.dumps(signed_packet))
    assert is_valid is False
    assert "Replay attack detected" in result
