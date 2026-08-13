from fastapi import FastAPI
from schemas import FuseRequest, FuseResponse
from concordance import (
    map_domain_result_to_finding,
    compute_concordance,
    compute_fusion_confidence,
    compute_risk_index,
    compute_forecast,
)

app = FastAPI(title="MedTwin Fusion Service")


@app.post("/fuse", response_model=FuseResponse)
def fuse(req: FuseRequest) -> FuseResponse:
    findings = [
        f for f in (map_domain_result_to_finding(r) for r in req.domain_results) if f is not None
    ]

    model_versions = {
        r.model_id: (r.model_version or "unknown") for r in req.domain_results
    }

    return FuseResponse(
        findings=findings,
        concordance=compute_concordance(req.domain_results),
        fusion_confidence=compute_fusion_confidence(req.domain_results),
        risk_index=compute_risk_index(findings),
        forecast=compute_forecast(findings),
        model_versions=model_versions,
    )


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}
