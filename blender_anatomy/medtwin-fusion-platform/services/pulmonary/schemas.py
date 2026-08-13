"""
Pydantic mirror of gateway/src/types.ts DomainModelResult (and the request
shape). Keep these two files in sync by hand until codegen exists — this
duplication is the known Phase 0/1 debt called out in README.md.
"""
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict


class InferRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_id: str
    image: Optional[str] = None  # base64
    image_modality: Optional[str] = None
    labs: Optional[dict] = None


class InferResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    status: Literal["ok", "invalid_input", "error"]
    label: Optional[str] = None
    confidence: Optional[float] = None
    raw_scores: Optional[dict] = None
    model_version: Optional[str] = None
    is_mock: bool = False
