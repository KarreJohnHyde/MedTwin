"""Mirrors gateway/src/types.ts — see note in services/pulmonary/schemas.py."""
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict


class DomainResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_id: str
    status: Literal["ok", "invalid_input", "timeout", "error"]
    label: Optional[str] = None
    confidence: Optional[float] = None
    raw_scores: Optional[dict] = None
    model_version: Optional[str] = None
    is_mock: bool = False


class FuseRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    patient_id: str
    domain_results: list[DomainResult]


class Finding(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    finding: str
    system: str
    severity_band: str
    confidence: float
    source_models: list[str]
    evidence: str


class ForecastPoint(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    day: int
    severity_band: str
    confidence: float


class FuseResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    findings: list[Finding]
    concordance: Literal["CONCORDANT", "DISCORDANT", "PARTIAL"]
    fusion_confidence: float
    risk_index: int
    forecast: list[ForecastPoint]
    model_versions: dict
