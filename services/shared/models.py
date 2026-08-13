from pydantic import BaseModel
from typing import Dict, Any, List, Optional, Literal

Modality = Literal["xray", "ct", "mri", "dermoscopic", None]

class InferenceInputs(BaseModel):
    report_text: Optional[str] = None
    labs: Dict[str, Any] = {}
    ecg_signal: Optional[str] = None
    image: Optional[str] = None
    image_modality: Modality = None

class InferenceRequest(BaseModel):
    patient_id: str
    inputs: InferenceInputs

class DomainOutput(BaseModel):
    model_id: str
    label: str
    confidence: float
    raw_scores: Dict[str, float]
    embedding: List[float]
    model_version: str

class DomainResponse(BaseModel):
    output: Optional[DomainOutput] = None
    error: Optional[str] = None

SystemType = Literal["cardiovascular", "pulmonary", "neurological", "oncologic", "other"]
SeverityBand = Literal["none", "low", "moderate", "high", "critical"]
ConcordanceType = Literal["CONCORDANT", "DISCORDANT", "PARTIAL"]

class Finding(BaseModel):
    finding: str
    system: SystemType
    severity_band: SeverityBand
    confidence: float
    source_models: List[str]
    evidence: str

class ForecastPoint(BaseModel):
    day: int
    severity_band: SeverityBand
    confidence: float

class FusionInferResponse(BaseModel):
    findings: List[Finding]
    concordance: ConcordanceType
    fusion_confidence: float
    risk_index: float
    forecast: List[ForecastPoint]
    model_versions: Dict[str, str]

class FusionInferRequest(BaseModel):
    patient_id: str
    domain_outputs: Dict[str, DomainResponse]
    inputs: InferenceInputs
