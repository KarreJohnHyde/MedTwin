import sys
import os
from fastapi import FastAPI
import uvicorn

# Ensure the shared module can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from shared.models import InferenceRequest, DomainResponse, DomainOutput

app = FastAPI(title="Pulmonary Domain Service")

@app.post("/infer", response_model=DomainResponse)
async def infer(request: InferenceRequest):
    # Reject invalid inputs explicitly
    if request.inputs.image_modality not in ["xray", "ct"]:
        return DomainResponse(error="invalid_input")
    
    if not request.inputs.image:
        return DomainResponse(error="invalid_input")

    # Mock output for Phase 0
    output = DomainOutput(
        model_id="pulmonary.pneumonia_detection",
        label="pneumonia",
        confidence=0.85,
        raw_scores={"pneumonia": 0.85, "normal": 0.15},
        embedding=[0.12, 0.45, -0.23, 0.88], 
        model_version="v1.3"
    )
    
    return DomainResponse(output=output)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
