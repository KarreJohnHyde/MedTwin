# MedTwin Framework

**Research prototype - not for clinical use.**

MedTwin is a real-time, three-modality digital-twin prototype. It fuses signed IoT telemetry (ECG/heart rate), imaging findings, and clinical-report text into an interactive GLB anatomical overlay.

## Working data path

```text
Raspberry Pi / edge simulator
  -> MQTT topic medtwin/{patient}/telemetry
  -> fog-service HMAC + replay validation
  -> MQTT topic medtwin/cloud/telemetry
  -> FastAPI compute hub (ECG, vision, NLP, fusion)
  -> WebSocket -> three.js GLB dashboard
```

The hub also exposes signed REST ingestion, so the complete application can be tested without a running MQTT broker.

## Run the dashboard

```powershell
cd C:\blender_anatomy\MedTwin
python -m pip install -r requirements.txt
python -m uvicorn cloud.api.main:app --reload --port 8001
```

Open `http://127.0.0.1:8001/`. The root URL redirects to the dashboard automatically.

## API contracts

| Route | Purpose |
|---|---|
| `POST /api/v1/ingest/telemetry` | HMAC-signed Raspberry Pi telemetry packet; rejected if tampered or stale. |
| `POST /api/v1/ingest/imaging` | R-CNN/vision result: finding, confidence, and optional bounding box. |
| `POST /api/v1/intake/document` | Dropbox/EHR/manual report intake followed by NLP extraction and fusion. |
| `POST /api/v1/inference/run` | Dashboard-selected adapter invocation. |
| `GET /api/v1/patients/{patient_id}/state` | Current fused patient state. |
| `WS /ws/patient/{patient_id}` | Real-time GLB viewer updates. |

Use the dashboard's **Clinical report intake** field to test the NLP/fusion branch. To test production-style transport, start Mosquitto and `fog-service/validator.py`; the hub subscribes to `medtwin/cloud/telemetry` and `medtwin/cloud/imaging` automatically.

## Project modules

- `edge/`: Raspberry Pi acquisition, NLMS preprocessing, and signed MQTT publishing.
- `fog-service/`: HMAC/timestamp validation and the edge-to-cloud topic bridge.
- `cloud/models/`: R-CNN vision, CNN-LSTM ECG, ClinicalBERT NLP, fusion transformer, and forecast models.
- `cloud/api/`: local compute hub, modality orchestration, REST/WebSocket API, MQTT bus subscriber.
- `frontend/`: interactive three.js GLB anatomy viewer.

The API adapters are explicitly development fallbacks until trained weights and governed datasets are connected. Do not interpret dashboard output as a clinical result. The server will not download or train models at startup: configure a versioned ECG checkpoint with `MEDTWIN_ECG_MODEL_PATH`; a compatible NLP NER model may be enabled with `MEDTWIN_ENABLE_REMOTE_NLP=1` and `MEDTWIN_NLP_MODEL`.

## Included local research artifacts

The application now loads the following locally trained research artifacts by
default when they are present under `artifacts/`:

- `brain_tumor_cnn.pt` - binary MRI image classifier. Upload a PNG/JPEG in the
  dashboard's **Brain MRI image** control; its result updates the Brain GLB's
  non-localized finding marker. The dataset has image-level labels only, so it
  is not a detector, R-CNN, segmentation map, or anatomical localization.
- `heart_xgboost.joblib` - 13-feature tabular heart-risk baseline used by
  `POST /api/v1/heart-disease/predict`.

Forecasts use each patient's observed risk history through the statistical
forecast fallback. They remain unavailable until history exists and are never
derived from random neural-network weights.
