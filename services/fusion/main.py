import sys
import os
from fastapi import FastAPI
import uvicorn
from typing import Dict

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from shared.models import FusionInferRequest, FusionInferResponse, Finding, ForecastPoint

app = FastAPI(title="Fusion Domain Service")

@app.post("/fuse", response_model=FusionInferResponse)
async def fuse(request: FusionInferRequest):
    findings = []
    model_versions: Dict[str, str] = {}
    fusion_confidence = 1.0
    concordance = "CONCORDANT"
    
    # Process Pulmonary
    pulm_res = request.domain_outputs.get("pulmonary")
    if pulm_res and pulm_res.output:
        out = pulm_res.output
        model_versions[out.model_id] = out.model_version
        
        # Mapping logic (stub)
        if out.label == "pneumonia":
            findings.append(Finding(
                finding="pneumonia",
                system="pulmonary",
                severity_band="moderate",
                confidence=out.confidence,
                source_models=[out.model_id],
                evidence="opacity in right lower lobe" # Stub evidence
            ))
            fusion_confidence = min(fusion_confidence, out.confidence)
    else:
        # Penalize confidence if a modality is missing/invalid
        fusion_confidence *= 0.5
        concordance = "DISCORDANT"
        
    # Stub forecast
    forecast = [
        ForecastPoint(day=0, severity_band="moderate", confidence=0.8),
        ForecastPoint(day=7, severity_band="moderate", confidence=0.6),
        ForecastPoint(day=14, severity_band="high", confidence=0.5)
    ]
        
    return FusionInferResponse(
        findings=findings,
        concordance=concordance,
        fusion_confidence=fusion_confidence,
        risk_index=45.0, # Stub risk index
        forecast=forecast,
        model_versions=model_versions
    )

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
