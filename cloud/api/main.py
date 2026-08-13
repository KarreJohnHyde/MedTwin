"""
MedTwin Centralized Compute Hub — Production API Gateway
Wires all AI models (ECG LSTM, NLP ClinicalBERT, Vision R-CNN, Fusion Engine,
Forecasting, Tabular Risk) into a single FastAPI server with WebSocket egress.
"""

import sys
import os
import json
import time
import logging
import asyncio
import hashlib
import numbers
from typing import Dict, List, Optional, Union, Any, Tuple
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ── Ensure MedTwin root and its parent are on sys.path ──
MEDTWIN_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PARENT_ROOT = os.path.abspath(os.path.join(MEDTWIN_ROOT, ".."))
if MEDTWIN_ROOT not in sys.path:
    sys.path.insert(0, MEDTWIN_ROOT)
if PARENT_ROOT not in sys.path:
    sys.path.insert(0, PARENT_ROOT)

# ── Advanced Modular Imports ──
from cloud.models.ecg.lstm_model import predict_arrhythmia, get_lstm_model
from cloud.models.nlp import run_clinical_nlp
from cloud.models.tabular import assign_risk_cluster
from cloud.models.fusion.fusion_engine import ProbabilisticEnsembleEngine
from cloud.models.fusion.forecasting import TemporalForecastingEngine
from cloud.models.forecasting.arima_hybrid import HybridForecaster
from cloud.api.security import verify_signed_payload
from cloud.models.vision.classifier import get_configured_brain_tumor_classifier, predict_brain_tumor_image
from cloud.models.tabular_inference.heart_disease_inference import get_heart_disease_model
from cloud.models.explainability import SHAPExplainer
from cloud.models.cdss_engine import CDSSEngine
from cloud.api.telemetry_simulator import TelemetrySimulator

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from cloud.api.mqtt_client import MedTwinMQTTClient
except ImportError:
    MedTwinMQTTClient = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("medtwin.api")

# ── Pydantic request/response models ──
class InferenceRequest(BaseModel):
    patient_id: str
    model: str = "ecg-lstm"
    payload: Dict[str, Any] = Field(default_factory=dict)

class GenericInferenceRequest(BaseModel):
    patient_id: str
    model: str
    payload: dict

class BatchInferenceRequest(BaseModel):
    items: List[GenericInferenceRequest] = Field(..., max_length=1000, description="Batch of up to 1000 inference items")

class DocumentIntakeRequest(BaseModel):
    patient_id: str
    report_text: str
    source: str = "api"
    generate_shap: bool = True


class SignedTelemetryRequest(BaseModel):
    payload: Union[str, Dict]
    hmac: str


class ImagingIngestRequest(BaseModel):
    patient_id: str
    finding: str
    confidence: float = 0.0
    bounding_box: Optional[List[float]] = None


class ECGAnalysisRequest(BaseModel):
    patient_id: str
    samples: List[float]


class VisionInferenceRequest(BaseModel):
    patient_id: str
    image_base64: str

class HeartDiseaseRequest(BaseModel):
    patient_id: str = "anonymous"
    age: int
    sex: int
    cp: int
    trestbps: int
    chol: int
    fbs: int
    restecg: int
    thalach: int
    exang: int
    oldpeak: float
    slope: int
    ca: int
    thal: int

class ForecastRequest(BaseModel):
    patient_id: str
    forecast_day: int

# ── In-memory patient context store ──
patient_context: Dict[str, dict] = {}


def json_safe(value: Any) -> Any:
    """Convert NumPy scalar/array values nested in model outputs into JSON primitives."""
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]
    if isinstance(value, numbers.Number) and type(value).__module__.startswith("numpy"):
        return value.item()
    if type(value).__module__.startswith("numpy") and hasattr(value, "tolist"):
        return json_safe(value.tolist())
    return value

def get_patient(pid: str) -> dict:
    if pid not in patient_context:
        patient_context[pid] = {
            "nlp": {"diagnoses": [], "symptoms": [], "engine": "none"},
            "ecg": {"label": "Normal", "heart_rate": 72, "trace": [], "risk_prob": 0.0},
            "vision": {"labels": [], "boxes": [], "heatmap": None},
            "risk_cluster": 0,
            "history": [],
        }
    return patient_context[pid]

# ── High-Throughput Infrastructure ──
inference_queue: asyncio.Queue = asyncio.Queue(maxsize=5000)
response_cache: Dict[str, Tuple[float, Any]] = {}  # key -> (timestamp, data)
CACHE_TTL_SECONDS = 300

def get_cache_key(model: str, payload: dict) -> str:
    """Generate a deterministic hash for caching model inputs."""
    payload_str = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(f"{model}:{payload_str}".encode()).hexdigest()

def check_cache(key: str) -> Optional[Any]:
    if key in response_cache:
        timestamp, data = response_cache[key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return data
        else:
            del response_cache[key]
    return None

def set_cache(key: str, data: Any):
    response_cache[key] = (time.time(), data)

# ── Global singletons ──
agreement_engine = ProbabilisticEnsembleEngine()
shap_explainer = SHAPExplainer(base_value=0.5)
cdss_engine = CDSSEngine()
simulator = None
forecaster = None
mqtt_hub = None
xgb_heart_model = None
xgb_heart_metrics = None
bg_worker_tasks = []

# ── Connection Manager ──
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, patient_id: str):
        await websocket.accept()
        if patient_id not in self.active_connections:
            self.active_connections[patient_id] = []
        self.active_connections[patient_id].append(websocket)
        logger.info(f"WebSocket connected for patient {patient_id}")

    def disconnect(self, websocket: WebSocket, patient_id: str):
        if patient_id in self.active_connections:
            self.active_connections[patient_id] = [
                c for c in self.active_connections[patient_id] if c != websocket
            ]

    async def broadcast(self, patient_id: str, message: dict):
        if patient_id in self.active_connections:
            dead = []
            for connection in self.active_connections[patient_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead.append(connection)
            for d in dead:
                self.active_connections[patient_id].remove(d)

manager = ConnectionManager()

# ── Fusion orchestrator — the heart of the system ──
def run_fusion(patient_id: str) -> dict:
    """Runs the full multi-modal fusion pipeline and returns a dashboard-ready dict."""
    ctx = get_patient(patient_id)
    ecg = ctx["ecg"]
    nlp = ctx["nlp"]
    vision = ctx["vision"]

    # 1. Agreement Engine (Late Fusion)
    agreement_score, conflict = agreement_engine.calculate_agreement(
        vision.get("labels", []),
        ecg.get("label", "Normal"),
        nlp,
    )

    # 2. Forecasting
    forecast_values = []
    if forecaster and ctx.get("history"):
        try:
            history = ctx.get("history", [])
            res = forecaster.forecast(history, steps=15)
            forecast_values = res.get("ensemble_forecast", [])
            ctx["last_forecast"] = forecast_values
        except Exception as e:
            logger.warning(f"Forecasting error: {e}")

    # 3. Explainability (SHAP)
    fusion_state_dict = {
        "fusion_confidence": agreement_score,
        "report_text": " ".join([d.get("entity", "") for d in nlp.get("diagnoses", [])])
    }
    explanation = shap_explainer.generate_multimodal_explanation(fusion_state_dict)

    # 4. Clinical Decision Support System (CDSS)
    fusion_payload = {
        "heart_rate": ecg.get("heart_rate", 72),
        "ecg_prediction": ecg.get("label", "Normal"),
        "vision_prediction": ", ".join(vision.get("labels", [])) or "No finding",
        "nlp_entities": nlp,
        "agreement_score": agreement_score
    }
    cdss_results = cdss_engine.evaluate_patient(fusion_payload, ctx)

    # 5. Build the fusion update payload
    return json_safe({
        "type": "fusion_update",
        "patient_id": patient_id,
        "heart_rate": ecg.get("heart_rate", 72),
        "risk_score": ecg.get("risk_prob", 0.0),
        "ecg_prediction": ecg.get("label", "Normal"),
        "ecg_trace": ecg.get("trace", []),
        "vision_prediction": ", ".join(vision.get("labels", [])) or "No finding",
        "agreement_score": agreement_score,
        "conflict": conflict,
        "nlp_entities": nlp,
        "risk_cluster": ctx.get("risk_cluster", 0),
        "forecast": forecast_values,
        "forecast_available": bool(forecast_values),
        "vision_analysis": {
            "confidence": vision.get("confidence"),
            "positive_probability": vision.get("positive_probability"),
            "metrics": vision.get("metrics"),
            "localization": vision.get("localization", "not_provided"),
        },
        "explainability": explanation,
        "cdss_analysis": cdss_results,
        "cardio_ultra_report": {
            "real_time_forecast": {
                "arrhythmia_risk_24h": f"{ecg.get('risk_prob', 0)*100:.1f}%",
                "anomaly_alerts": (
                    [f"ECG: {ecg['label']}"] if "risk" in ecg.get("label", "").lower() else []
                ),
            },
            "recommended_interventions": _generate_interventions(ecg, nlp, agreement_score),
        },
        "patient_demographics": {
            "age": "55",
            "sex": "M",
            "baseline_risk": f"Cluster {ctx.get('risk_cluster', 0)}",
        },
        "sensor_metadata": {
            "device_id": "AD8232-Edge-01",
            "signal_quality": 94,
        },
        "timestamp": time.time(),
    })

def _generate_interventions(ecg: dict, nlp: dict, agreement: float) -> list:
    interventions = []
    if "risk" in ecg.get("label", "").lower():
        interventions.append("Consider continuous telemetry monitoring")
    if agreement < 0.85:
        interventions.append("Clinical review recommended — AI modality conflict detected")
    for dx in nlp.get("diagnoses", []):
        if dx.get("assertion") == "present" and dx.get("entity") in ("afib", "pvc"):
            interventions.append(f"Cardiology consult for {dx['entity'].upper()}")
    for sx in nlp.get("symptoms", []):
        if sx.get("entity") == "chest pain":
            interventions.append("Stat 12-lead ECG and troponin panel")
    return interventions or ["No acute interventions recommended"]


# ── MQTT callback — processes edge telemetry through real ECG model ──
async def on_telemetry(patient_id: str, payload: dict):
    """Called by MQTTClient when a verified telemetry packet arrives."""
    ctx = get_patient(patient_id)

    ecg_window = payload.get("ecg_window", payload.get("ecg", []))
    if ecg_window:
        result = predict_arrhythmia(ecg_window)
        # A device-provided heart rate is useful metadata, but only accept a
        # finite, physiologically plausible value.
        reported_hr = payload.get("heart_rate")
        if isinstance(reported_hr, (int, float)) and 20 <= reported_hr <= 300:
            result["heart_rate"] = round(reported_hr)
        ctx["ecg"] = result
        ctx["history"].append(result.get("risk_prob", 0.0))
        # Keep history bounded
        ctx["history"] = ctx["history"][-50:]

    # Check for tabular heart disease features
    if xgb_heart_model is not None:
        try:
            from cardio_ultra.models.train_heart_model import HEART_FEATURES
            if all(feature in payload for feature in HEART_FEATURES):
                import pandas as pd
                features = pd.DataFrame([{feature: payload[feature] for feature in HEART_FEATURES}])
                tabular_risk = float(xgb_heart_model.predict_proba(features)[:, 1][0])
                ctx["ecg"]["risk_prob"] = max(ctx["ecg"].get("risk_prob", 0.0), tabular_risk)
                if tabular_risk >= 0.5:
                    ctx["ecg"]["label"] = "Elevated tabular risk"
        except Exception as e:
            logger.warning(f"Failed to run tabular model on telemetry: {e}")

    fusion_update = run_fusion(patient_id)
    await manager.broadcast(patient_id, fusion_update)


async def on_imaging(patient_id: str, payload: dict):
    """Process fog-validated imaging metadata without claiming image inference."""
    finding = str(payload.get("finding", payload.get("label", "Imaging received"))).strip()
    confidence = payload.get("confidence", 0.0)
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0.0
    ctx = get_patient(patient_id)
    ctx["vision"] = {
        "labels": [finding] if finding else [],
        "boxes": payload.get("bounding_box", payload.get("box", [])),
        "heatmap": None,
        "confidence": min(1.0, max(0.0, confidence)),
        "source": "ingested_result",
        "metrics": payload.get("metrics"),
        "positive_probability": payload.get("positive_probability"),
        "localization": payload.get("localization", "not_provided"),
    }
    await manager.broadcast(patient_id, run_fusion(patient_id))


# ── Background Queue Worker ──
async def inference_worker():
    """Consumes tasks from the asyncio queue and processes them in batches."""
    logger.info("Started inference background worker.")
    while True:
        try:
            batch = []
            # Wait for at least one item
            item = await inference_queue.get()
            batch.append(item)
            
            # Non-blocking fetch of up to 50 items for batch processing
            while len(batch) < 50:
                try:
                    next_item = inference_queue.get_nowait()
                    batch.append(next_item)
                except asyncio.QueueEmpty:
                    break
                    
            logger.debug(f"Processing batch of {len(batch)} inferences...")
            
            for req in batch:
                # We would normally route to a batched tensor model here
                # For now, process sequentially in the background worker
                patient_id = req.get("patient_id")
                model_name = req.get("model")
                payload = req.get("payload")
                
                # Mock heavy computation
                await asyncio.sleep(0.01)
                
                # Update patient context (simplified for background)
                ctx = get_patient(patient_id)
                ctx["history"].append(0.85) # Example result
                
                # Trigger broadcast
                fusion_update = run_fusion(patient_id)
                await manager.broadcast(patient_id, fusion_update)
                inference_queue.task_done()
                
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in inference worker: {e}")
            await asyncio.sleep(1)

# ── Lifespan ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    global forecaster, mqtt_hub, xgb_heart_model, xgb_heart_metrics, simulator
    logger.info("═══════════════════════════════════════")
    logger.info("  MedTwin Compute Hub — Initializing   ")
    logger.info("═══════════════════════════════════════")

    # Start 4 concurrent background workers
    for _ in range(4):
        task = asyncio.create_task(inference_worker())
        bg_worker_tasks.append(task)
    logger.info("Async Job Queue: 4 concurrent workers started.")
    
    # Initialize Telemetry Simulator
    simulator = TelemetrySimulator(callback=lambda p: on_telemetry(p.get("patient_id", "SIM"), p))
    logger.info("Telemetry Simulator engine ready.")

    lstm, device = get_lstm_model()
    logger.info(f"ECG LSTM: {'loaded on ' + str(device) if lstm else 'mock mode'}")

    forecaster = HybridForecaster(arima_weight=1.0, lstm_weight=0.0, use_neural=False)
    logger.info("Observed-history ARIMA/trend forecasting engine ready")
        
    default_heart_model = os.path.join(MEDTWIN_ROOT, "artifacts", "heart_xgboost.joblib")
    model_path = os.getenv("MEDTWIN_XGB_MODEL_PATH") or (default_heart_model if os.path.isfile(default_heart_model) else None)
    if model_path:
        try:
            from cardio_ultra.models.train_heart_model import load_heart_model
            artifact = load_heart_model(model_path)
            xgb_heart_model = artifact["model"]
            xgb_heart_metrics = artifact.get("metrics")
            logger.info("XGBoost: loaded versioned local artifact from %s", model_path)
        except Exception as exc:
            logger.warning("XGBoost model artifact was not loaded: %s", exc)
    else:
        logger.info("XGBoost: unavailable until MEDTWIN_XGB_MODEL_PATH points to a versioned model artifact")

    if MedTwinMQTTClient:
        try:
            mqtt_hub = MedTwinMQTTClient(
                broadcast_callback=on_telemetry,
                imaging_callback=on_imaging,
            )
            mqtt_hub.start()
            logger.info("MQTT Client: started (listening on fog-validated cloud topics)")
        except Exception as e:
            logger.warning(f"MQTT Client: {e} — running without edge telemetry")

    logger.info("Probabilistic Ensemble Engine & SHAP: ready")
    logger.info("═══════════════════════════════════════")
    logger.info("  All systems nominal. Server ready.    ")
    logger.info("═══════════════════════════════════════")

    yield

    for task in bg_worker_tasks:
        task.cancel()
    if mqtt_hub:
        mqtt_hub.stop()
    logger.info("MedTwin Compute Hub shut down.")


# ── FastAPI App ──
app = FastAPI(
    title="MedTwin Compute Hub",
    description="Multi-modal AI Digital Twin Gateway — ECG, NLP, Vision, Fusion, Forecasting",
    version="2.0.0",
    lifespan=lifespan,
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("MEDTWIN_CORS_ORIGINS", "http://localhost:8080,http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve frontend static files ──
frontend_dir = os.path.join(MEDTWIN_ROOT, "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")


# ══════════════════════════════════════════════════════════════
#  ENDPOINTS
# ══════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    if os.path.isfile(os.path.join(frontend_dir, "index.html")):
        return RedirectResponse(url="/static/index.html")
    return {"service": "MedTwin Compute Hub", "version": "2.0.0", "status": "running"}


@app.websocket("/ws/patient/{patient_id}")
async def websocket_endpoint(websocket: WebSocket, patient_id: str):
    await manager.connect(websocket, patient_id)
    # Send current state immediately on connect
    fusion_update = run_fusion(patient_id)
    await websocket.send_json(fusion_update)
    try:
        while True:
            data = await websocket.receive_text()
            # Client can send commands if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket, patient_id)


@app.post("/api/v1/nlp/submit_report")
async def submit_clinical_report(patient_id: str, report_text: str):
    """Legacy endpoint — runs ClinicalBERT NLP and returns extracted entities."""
    ctx = get_patient(patient_id)
    nlp_result = run_clinical_nlp(report_text)
    ctx["nlp"] = nlp_result
    fusion_update = run_fusion(patient_id)
    await manager.broadcast(patient_id, fusion_update)
    return {"status": "success", "extracted": nlp_result, "fusion_update": fusion_update}


@app.post("/api/v1/intake/document")
async def document_intake(request: DocumentIntakeRequest):
    """Primary endpoint for clinical document intake — runs full NLP + fusion pipeline."""
    ctx = get_patient(request.patient_id)
    nlp_result = run_clinical_nlp(request.report_text)
    ctx["nlp"] = nlp_result
    
    # Generate SHAP explanation if requested
    if request.generate_shap:
        ctx["explainability_requested"] = True
        
    fusion_update = run_fusion(request.patient_id)
    await manager.broadcast(request.patient_id, fusion_update)
    return {
        "status": "success",
        "entities": nlp_result,
        "fusion_update": fusion_update,
    }

@app.post("/api/v1/inference/batch")
async def batch_inference(request: BatchInferenceRequest):
    """High-throughput endpoint for bulk inference, using async job queues."""
    queued_count = 0
    for item in request.items:
        try:
            inference_queue.put_nowait(item.dict())
            queued_count += 1
        except asyncio.QueueFull:
            logger.warning("Inference queue is full, dropping requests.")
            break
            
    return {
        "status": "accepted",
        "message": f"Successfully queued {queued_count}/{len(request.items)} items for background processing."
    }


@app.post("/api/v1/simulator/start")
async def start_simulator(num_devices: int = 10, hz: float = 1.0):
    """Start the high-throughput telemetry simulator."""
    if simulator:
        await simulator.start_swarm(num_devices, hz)
        return {"status": "success", "message": f"Started {num_devices} simulated devices at {hz}Hz."}
    raise HTTPException(status_code=500, detail="Simulator not initialized.")

@app.post("/api/v1/simulator/stop")
async def stop_simulator():
    """Stop the telemetry simulator."""
    if simulator:
        await simulator.stop_swarm()
        return {"status": "success", "message": "Simulator stopped."}
    raise HTTPException(status_code=500, detail="Simulator not initialized.")


@app.post("/api/v1/ingest/telemetry")
async def ingest_telemetry(request: SignedTelemetryRequest):
    """Accept a signed edge packet over REST and run the same realtime path as MQTT."""
    payload = verify_signed_payload(request.payload, request.hmac)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid, tampered, or stale telemetry packet")
    patient_id = str(payload.get("patient_id", "")).strip()
    samples = payload.get("ecg_window", payload.get("ecg", []))
    if not patient_id or not isinstance(samples, list):
        raise HTTPException(status_code=422, detail="Payload requires patient_id and an ECG sample list")
    await on_telemetry(patient_id, payload)
    return {"status": "accepted", "fusion_update": run_fusion(patient_id)}


@app.post("/api/v1/ingest/imaging")
async def ingest_imaging(request: ImagingIngestRequest):
    """Ingest an already-produced R-CNN finding and update multimodal fusion."""
    if not request.finding.strip() or not 0.0 <= request.confidence <= 1.0:
        raise HTTPException(status_code=422, detail="finding is required and confidence must be between 0 and 1")
    if request.bounding_box is not None and len(request.bounding_box) != 4:
        raise HTTPException(status_code=422, detail="bounding_box must contain [x1, y1, x2, y2]")
    await on_imaging(request.patient_id, request.model_dump() if hasattr(request, "model_dump") else request.dict())
    return {"status": "accepted", "fusion_update": run_fusion(request.patient_id)}


@app.post("/api/v1/vision/analyze")
async def analyze_brain_mri(request: VisionInferenceRequest):
    """Analyze a base64 MRI image with the configured trained local CNN.

    This classifier has no bounding-box labels, so the returned 3-D finding is
    intentionally non-localized rather than a fabricated anatomical location.
    """
    try:
        model, artifact = get_configured_brain_tumor_classifier()
    except Exception as exc:
        logger.exception("Vision artifact could not be loaded")
        raise HTTPException(status_code=500, detail="Vision model artifact could not be loaded") from exc
    if model is None:
        raise HTTPException(status_code=503, detail="Vision model unavailable; configure MEDTWIN_VISION_MODEL_PATH")
    try:
        result = predict_brain_tumor_image(model, artifact, request.image_base64)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await on_imaging(request.patient_id, result)
    return {"status": "success", "vision_result": result, "fusion_update": run_fusion(request.patient_id)}


@app.post("/api/v1/inference/run")
async def run_inference(request: InferenceRequest):
    """Runs a specific AI model and returns the result + fusion update."""
    ctx = get_patient(request.patient_id)

    if request.model == "ecg-lstm":
        ecg_data = ctx["ecg"].get("trace", [])
        if not ecg_data:
            import math
            ecg_data = [math.sin(i * 0.1) * 0.5 + (0.9 if i % 30 == 0 else 0) for i in range(360)]
        result = predict_arrhythmia(ecg_data)
        ctx["ecg"] = result
        ctx["history"].append(result.get("risk_prob", 0.0))
        summary = result["label"]
        confidence = max(result.get("risk_prob", 0), 1 - result.get("risk_prob", 0))

    elif request.model == "heart-disease-xgboost":
        if 'xgb_heart_model' in globals() and xgb_heart_model is not None:
            import pandas as pd
            features = pd.DataFrame([{
                "age": 55, "sex": 1, "cp": 0, "trestbps": 140, "chol": 250, 
                "fbs": 0, "restecg": 1, "thalach": 160, "exang": 1, 
                "oldpeak": 2.0, "slope": 1, "ca": 2, "thal": 3
            }])
            y_pred_proba = float(xgb_heart_model.predict_proba(features)[:, 1][0])
            summary = f"XGBoost Risk: {y_pred_proba*100:.1f}%"
            confidence = y_pred_proba
            ctx["ecg"]["risk_prob"] = y_pred_proba
            ctx["ecg"]["label"] = "High Risk" if y_pred_proba > 0.5 else "Low Risk"
        else:
            summary = "XGBoost model unavailable"
            confidence = 0.0

    elif request.model == "stroke-tabular":
        from cloud.models.tabular_inference.stroke_inference import get_stroke_model
        res = get_stroke_model().predict(request.payload or {})
        summary = res.get("prediction_class", "Unknown")
        confidence = res.get("confidence", 0.0)
        ctx["ecg"]["label"] = summary

    elif request.model == "lung-cancer":
        from cloud.models.tabular_inference.lung_cancer_inference import get_lung_cancer_model
        res = get_lung_cancer_model().predict(request.payload or {})
        summary = res.get("prediction_class", "Unknown")
        confidence = res.get("confidence", 0.0)
        ctx["ecg"]["label"] = summary

    elif request.model in {"vision-rcnn", "vision-cnn"}:
        model, artifact = get_configured_brain_tumor_classifier()
        image_base64 = request.payload.get("image_base64")
        if model is None:
            raise HTTPException(status_code=503, detail="Trained vision artifact is unavailable")
        if not image_base64:
            raise HTTPException(status_code=422, detail="vision inference requires payload.image_base64")
        res = predict_brain_tumor_image(model, artifact, image_base64)
        summary = res["finding"]
        confidence = res["confidence"]
        ctx["vision"]["labels"] = [summary]
        ctx["history"].append(confidence)

    elif request.model == "pneumonia":
        from cloud.models.vision.pneumonia_inference import get_pneumonia_model
        res = get_pneumonia_model().predict(request.payload.get("image_base64", "mock_image_" * 10))
        summary = res.get("prediction_class", "Unknown")
        confidence = res.get("confidence", 0.0)
        ctx["vision"]["labels"] = [summary]

    elif request.model == "melanoma":
        from cloud.models.vision.melanoma_inference import get_melanoma_model
        res = get_melanoma_model().predict(request.payload.get("image_base64", "mock_image_" * 10))
        summary = res.get("prediction_class", "Unknown")
        confidence = res.get("confidence", 0.0)
        ctx["vision"]["labels"] = [summary]

    elif request.model == "gastro":
        from cloud.models.vision.gastro_inference import get_gastro_model
        res = get_gastro_model().predict(request.payload.get("image_base64", "mock_image_" * 10))
        summary = res.get("prediction_class", "Unknown")
        confidence = res.get("confidence", 0.0)
        ctx["vision"]["labels"] = [summary]

    elif request.model == "fusion-engine":
        fusion_update = run_fusion(request.patient_id)
        await manager.broadcast(request.patient_id, fusion_update)
        return {
            "model_name": "Multi-Modal Fusion",
            "summary": f"Agreement: {fusion_update['agreement_score']:.0%}",
            "confidence": fusion_update["agreement_score"],
            "fusion_update": fusion_update,
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    fusion_update = run_fusion(request.patient_id)
    await manager.broadcast(request.patient_id, fusion_update)
    return {
        "model_name": request.model,
        "summary": summary,
        "confidence": confidence,
        "fusion_update": fusion_update,
    }


@app.post("/api/v1/ecg/analyze")
async def analyze_ecg(request: ECGAnalysisRequest):
    """Direct ECG analysis endpoint — accepts raw sample array."""
    ctx = get_patient(request.patient_id)
    result = predict_arrhythmia(request.samples)
    ctx["ecg"] = result
    ctx["history"].append(result.get("risk_prob", 0.0))
    fusion_update = run_fusion(request.patient_id)
    await manager.broadcast(request.patient_id, fusion_update)
    return {"status": "success", "ecg_result": result, "fusion_update": fusion_update}


@app.post("/api/v1/risk/assess")
async def assess_risk(patient_id: str, total_cholesterol: float, systolic_bp: float, ejection_fraction: float):
    """Tabular K-Means risk clustering endpoint."""
    ctx = get_patient(patient_id)
    cluster = assign_risk_cluster(total_cholesterol, systolic_bp, ejection_fraction)
    ctx["risk_cluster"] = cluster
    fusion_update = run_fusion(patient_id)
    await manager.broadcast(patient_id, fusion_update)
    return {"status": "success", "risk_cluster": cluster, "fusion_update": fusion_update}


@app.post("/api/v1/heart-disease/predict")
async def predict_heart_disease(request: HeartDiseaseRequest):
    """Run the explicitly configured XGBoost artifact on supplied tabular features."""
    if xgb_heart_model is None:
        raise HTTPException(status_code=503, detail="XGBoost model unavailable; configure MEDTWIN_XGB_MODEL_PATH")
    try:
        import pandas as pd
        from cardio_ultra.models.train_heart_model import HEART_FEATURES

        payload = request.model_dump() if hasattr(request, "model_dump") else request.dict()
        features = pd.DataFrame([{name: payload[name] for name in HEART_FEATURES}], columns=HEART_FEATURES)
        risk = float(xgb_heart_model.predict_proba(features)[:, 1][0])
    except Exception as exc:
        logger.exception("XGBoost prediction failed")
        raise HTTPException(status_code=500, detail="Heart risk model could not process the supplied features") from exc

    ctx = get_patient(request.patient_id)
    ctx["ecg"]["risk_prob"] = risk
    ctx["ecg"]["label"] = "Elevated tabular risk" if risk >= 0.5 else "Lower tabular risk"
    ctx["history"].append(risk)
    ctx["history"] = ctx["history"][-50:]
    fusion_update = run_fusion(request.patient_id)
    await manager.broadcast(request.patient_id, fusion_update)
    return {
        "patient_id": request.patient_id,
        "risk_probability": risk,
        "model_metrics": xgb_heart_metrics,
        "fusion_update": fusion_update,
    }


@app.get("/api/v1/patient/{patient_id}/state")
async def get_patient_state(patient_id: str):
    """Returns the full current state for a patient."""
    return run_fusion(patient_id)


@app.get("/api/v1/patients/{patient_id}/state")
async def get_patient_state_plural(patient_id: str):
    """Compatibility route matching the documented API contract."""
    return run_fusion(patient_id)


@app.post("/api/v1/inference/heart-disease")
async def predict_heart(request: GenericInferenceRequest):
    """Extracted heart disease inference module."""
    model = get_heart_disease_model()
    payload = request.model_dump() if hasattr(request, "model_dump") else request.dict()
    result = model.predict(payload)
    return {"status": "success", "prediction": result}


@app.post("/api/v1/inference/brain-tumor")
async def predict_brain(request: GenericInferenceRequest):
    """Run the trained local brain-MRI classifier and update the 3-D session."""
    image = request.payload.get("image_base64")
    if not image:
        raise HTTPException(status_code=422, detail="payload.image_base64 is required")
    model, artifact = get_configured_brain_tumor_classifier()
    if model is None:
        raise HTTPException(status_code=503, detail="Trained vision artifact is unavailable")
    result = predict_brain_tumor_image(model, artifact, image)
    await on_imaging(request.patient_id, result)
    return {"status": "success", "prediction": result, "fusion_update": run_fusion(request.patient_id)}

@app.post("/api/v1/inference/stroke")
async def predict_stroke(request: GenericInferenceRequest):
    from cloud.models.tabular_inference.stroke_inference import get_stroke_model
    model = get_stroke_model()
    result = model.predict(request.payload)
    return {"status": "success", "prediction_class": result.get("prediction_class", ""), "confidence": result.get("confidence", 0.0), "summary": result.get("prediction_class", "")}

@app.post("/api/v1/inference/lung-cancer")
async def predict_lung_cancer(request: GenericInferenceRequest):
    from cloud.models.tabular_inference.lung_cancer_inference import get_lung_cancer_model
    model = get_lung_cancer_model()
    result = model.predict(request.payload)
    return {"status": "success", "prediction_class": result.get("prediction_class", ""), "confidence": result.get("confidence", 0.0), "summary": result.get("prediction_class", "")}

@app.post("/api/v1/inference/pneumonia")
async def predict_pneumonia(request: GenericInferenceRequest):
    from cloud.models.vision.pneumonia_inference import get_pneumonia_model
    model = get_pneumonia_model()
    result = model.predict(request.payload.get("image_base64", ""))
    return {"status": "success", "prediction_class": result.get("prediction_class", ""), "confidence": result.get("confidence", 0.0), "summary": result.get("summary", "")}

@app.post("/api/v1/inference/melanoma")
async def predict_melanoma(request: GenericInferenceRequest):
    from cloud.models.vision.melanoma_inference import get_melanoma_model
    model = get_melanoma_model()
    result = model.predict(request.payload.get("image_base64", ""))
    return {"status": "success", "prediction_class": result.get("prediction_class", ""), "confidence": result.get("confidence", 0.0), "summary": result.get("summary", "")}

@app.post("/api/v1/inference/gastro")
async def predict_gastro(request: GenericInferenceRequest):
    from cloud.models.vision.gastro_inference import get_gastro_model
    model = get_gastro_model()
    result = model.predict(request.payload.get("image_base64", ""))
    return {"status": "success", "prediction_class": result.get("prediction_class", ""), "confidence": result.get("confidence", 0.0), "summary": result.get("summary", "")}


@app.post("/api/v1/inference/forecast")
async def predict_forecast(request: ForecastRequest):
    ctx = get_patient(request.patient_id)
    forecast_values = ctx.get("last_forecast", [])
    
    val = 0.1
    if forecast_values:
        day_idx = min(request.forecast_day, len(forecast_values) - 1)
        val = forecast_values[day_idx]
        
    return {
        "status": "success", 
        "spread_multiplier": 1.0 + (val * 3.0),
        "severity_index": val * 1.5
    }


@app.get("/api/v1/health")
async def health_check():
    """System health check."""
    lstm, device = get_lstm_model()
    return {
        "status": "healthy",
        "ecg_lstm": "loaded" if lstm else "mock",
        "device": str(device) if device else "cpu",
        "forecaster": "loaded" if forecaster else "unavailable",
        "mqtt": "connected" if mqtt_hub else "disconnected",
        "vision_classifier": "configured" if get_configured_brain_tumor_classifier()[0] else "unavailable",
        "patients_tracked": len(patient_context),
    }
