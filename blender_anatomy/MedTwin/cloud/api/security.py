import hmac
import hashlib
import time
import os
import json
import logging

# MUST match the secret used by the edge simulator and fog validator.  The
# default is only suitable for local development; deployments must set it.
SHARED_SECRET = os.getenv("MEDTWIN_SECRET_KEY", "medtwin_secure_edge_key_2026").encode()

# Maximum allowed time difference (in seconds) between edge timestamp and cloud timestamp
TIME_TOLERANCE_SECONDS = 5.0
logger = logging.getLogger("medtwin.security")


def canonical_json(payload: dict) -> str:
    """Return the stable JSON representation used for newly signed packets."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)

def generate_hmac(payload_string: str) -> str:
    """
    Generates a SHA256 HMAC for a given payload string.
    """
    return hmac.new(SHARED_SECRET, payload_string.encode(), hashlib.sha256).hexdigest()

def verify_hmac(payload_dict: dict, provided_mac: str) -> bool:
    """
    Verifies the HMAC signature and timestamp of an incoming edge telemetry packet.
    """
    try:
        # Support the legacy ``time`` field and the edge protocol's
        # ``timestamp`` field while enforcing replay protection for both.
        packet_time = float(payload_dict.get("timestamp", payload_dict.get("time", 0)))
        current_time = time.time()
        
        if abs(current_time - packet_time) > TIME_TOLERANCE_SECONDS:
            logger.warning("Rejected stale telemetry packet (clock skew %.2fs)", abs(current_time - packet_time))
            return False

        # 2. Verify MAC
        payload_str = canonical_json(payload_dict)
        expected_mac = generate_hmac(payload_str)
        
        if hmac.compare_digest(expected_mac, provided_mac):
            return True
        else:
            logger.warning("Rejected telemetry packet with an invalid HMAC")
            return False
            
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Could not validate telemetry packet: %s", exc)
        return False


def verify_signed_payload(payload: str | dict, provided_mac: str) -> dict | None:
    """Verify a signed packet and return its decoded payload.

    String payloads are checked byte-for-byte so legacy edge packets retain
    their original signature.  Dictionary payloads use ``canonical_json``.
    """
    try:
        if isinstance(payload, str):
            payload_dict = json.loads(payload)
            signed_text = payload
        elif isinstance(payload, dict):
            payload_dict = payload
            signed_text = canonical_json(payload_dict)
        else:
            return None
        if not hmac.compare_digest(generate_hmac(signed_text), provided_mac):
            logger.warning("Rejected telemetry packet with an invalid HMAC")
            return None
        packet_time = float(payload_dict.get("timestamp", payload_dict.get("time", 0)))
        if abs(time.time() - packet_time) > TIME_TOLERANCE_SECONDS:
            logger.warning("Rejected stale telemetry packet")
            return None
        return payload_dict
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Could not decode signed telemetry packet: %s", exc)
        return None
