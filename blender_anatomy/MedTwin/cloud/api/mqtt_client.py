import json
import asyncio
import logging
import paho.mqtt.client as mqtt
from .security import verify_signed_payload

logger = logging.getLogger("medtwin.mqtt")

class MedTwinMQTTClient:
    def __init__(self, broker_url="localhost", port=1883, broadcast_callback=None, imaging_callback=None):
        self.broker_url = broker_url
        self.port = port
        callback_api = getattr(getattr(mqtt, "CallbackAPIVersion", None), "VERSION2", None)
        self.client = mqtt.Client(callback_api) if callback_api else mqtt.Client()
        self.loop = None
        self.broadcast_callback = broadcast_callback
        self.imaging_callback = imaging_callback

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        logger.info("Connected to MQTT broker at %s (result=%s)", self.broker_url, reason_code)
        # The fog service verifies edge signatures and publishes clean payloads
        # only on these cloud topics.
        self.client.subscribe("medtwin/cloud/telemetry")
        self.client.subscribe("medtwin/cloud/imaging")

    def _on_message(self, client, userdata, msg):
        try:
            data = json.loads(msg.payload.decode('utf-8'))
            if msg.topic.startswith("medtwin/cloud/"):
                payload_dict = data
            else:
                payload_dict = verify_signed_payload(data.get("payload"), data.get("hmac", ""))
                if payload_dict is None:
                    logger.warning("Dropped invalid packet on topic %s", msg.topic)
                    return
            if not self.loop:
                logger.warning("Dropped MQTT packet because the API loop is not running")
                return
            patient_id = str(payload_dict.get("patient_id", ""))
            callback = self.imaging_callback if msg.topic.endswith("/imaging") else self.broadcast_callback
            if patient_id and callback:
                asyncio.run_coroutine_threadsafe(callback(patient_id, payload_dict), self.loop)
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError) as exc:
            logger.warning("Failed to decode MQTT message: %s", exc)

    def start(self):
        self.loop = asyncio.get_running_loop()
        self.client.connect(self.broker_url, self.port, 60)
        self.client.loop_start()

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()
