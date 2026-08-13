"""Persistent anonymous inference API for MedTwin Atlas."""

from __future__ import annotations

import asyncio
import os
import time
import uuid
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from inference.fusion_engine import build_result
from inference.model_registry import MODEL_CATALOG, public_catalog


Anatomy = Literal["heart", "brain", "nervous", "skeletal", "lungs", "renal", "digestive"]
IDENTITY_KEYS = {
    "name", "patient", "patient_id", "mrn", "email", "phone", "address",
    "birth", "dob", "record", "ssn", "passport", "identifier",
}


class VolumeSummary(BaseModel):
    format: Literal["nifti", "dicom"]
    dimensions: tuple[int, int, int]
    spacing: tuple[float, float, float]
    normalized_contrast: float = Field(ge=0.0, le=1.0)
    voxel_count: int = Field(ge=1, le=512 * 512 * 2048)

    class Config:
        extra = "forbid"


class InferenceRequest(BaseModel):
    anatomy: Anatomy = "heart"
    threshold: float = Field(default=0.65, ge=0.1, le=0.95)
    horizon: int = Field(default=12, ge=7, le=30)
    seed: int = Field(default=24, ge=0, le=1_000_000)
    volume_summary: VolumeSummary | None = None

    class Config:
        extra = "forbid"


def _contains_identity_key(value: Any) -> bool:
    if isinstance(value, dict):
        for key, nested in value.items():
            normalized = str(key).lower().replace("-", "_")
            if any(token in normalized for token in IDENTITY_KEYS):
                return True
            if _contains_identity_key(nested):
                return True
    if isinstance(value, list):
        return any(_contains_identity_key(item) for item in value)
    return False


MAX_CONCURRENCY = max(1, int(os.getenv("MEDTWIN_INFERENCE_CONCURRENCY", "4")))
INFERENCE_TIMEOUT_SECONDS = float(os.getenv("MEDTWIN_INFERENCE_TIMEOUT", "6"))
inference_slots = asyncio.Semaphore(MAX_CONCURRENCY)
started_at = time.time()
request_count = 0

app = FastAPI(
    title="MedTwin Anonymous Inference Service",
    version="3.0.0",
    description="Persistent research-only multimodel fusion service.",
)


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))[:64]
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/health")
async def health():
    return {
        "status": "ready",
        "service": "persistent-python-inference",
        "version": "3.0.0",
        "registry_loaded": sum(len(models) for models in MODEL_CATALOG.values()),
        "max_concurrency": MAX_CONCURRENCY,
        "uptime_seconds": round(time.time() - started_at, 2),
        "requests_completed": request_count,
        "privacy": "strict-anonymous-schema",
    }


@app.get("/api/catalog")
async def catalog():
    return {
        "status": "ready",
        "artifact_policy": "simulation contracts are never presented as validated weights",
        "catalog": public_catalog(),
    }


@app.post("/api/inference")
async def inference(request: InferenceRequest):
    global request_count
    payload = request.model_dump() if hasattr(request, "model_dump") else request.dict()
    payload = {key: value for key, value in payload.items() if value is not None}
    if _contains_identity_key(payload):
        raise HTTPException(status_code=422, detail="Identity-bearing fields are not accepted")
    try:
        async with inference_slots:
            result = await asyncio.wait_for(
                asyncio.to_thread(build_result, payload),
                timeout=INFERENCE_TIMEOUT_SECONDS,
            )
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Inference deadline exceeded") from exc
    request_count += 1
    result["runtime"] = {
        "service": "persistent-fastapi",
        "request_sequence": request_count,
        "queue_capacity": MAX_CONCURRENCY,
    }
    return result


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, error: ValueError):
    return JSONResponse(status_code=422, content={"status": "error", "message": str(error)})
