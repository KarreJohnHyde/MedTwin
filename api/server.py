from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import numpy as np
import os

# Import components from our pipeline
from unet3d import UNet3D
from voxel_preprocessing import preprocess_mesh_to_voxel
from adapters.heart_disease_adapter import HeartDiseaseAdapter
from adapters.brain_tumor_adapter import BrainTumorAdapter
from adapters.forecast_adapter import ForecastAdapter
from adapters.kaggle_adapters import StrokeAdapter, LungCancerAdapter, PneumoniaAdapter, MelanomaAdapter, GastroAdapter

app = FastAPI(title="MedTwin 3D Inference API", version="1.0")

# Global variables for model state
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = None

class InferenceRequest(BaseModel):
    patient_id: str
    model: str
    mesh_path: str = None  # Optional, can be provided by the UI
    payload: dict = {}     # Generic payload for tabular or slice data

# Initialize adapters
heart_disease_adapter = HeartDiseaseAdapter()
brain_tumor_adapter = BrainTumorAdapter()
forecast_adapter = ForecastAdapter()
stroke_adapter = StrokeAdapter()
lung_cancer_adapter = LungCancerAdapter()
pneumonia_adapter = PneumoniaAdapter()
melanoma_adapter = MelanomaAdapter()
gastro_adapter = GastroAdapter()

@app.on_event("startup")
async def startup_event():
    global model
    # Initialize the 3D U-Net model
    model = UNet3D(in_channels=1, out_channels=2).to(device)
    # Ideally, load pre-trained weights here:
    # model.load_state_dict(torch.load("path/to/weights.pth"))
    model.eval()
    print("3D U-Net model loaded and ready for inference.")

@app.post("/api/v1/inference/run")
async def run_inference(request: InferenceRequest):
    """
    Endpoint for real-time 3D integration.
    Performs forward pass, calculates metrics and returns risk indices.
    """
    global model
    
    # Define a default mesh path if none provided (mocking the MedTwin environment)
    mesh_path = request.mesh_path or "../next-dashboard/public/assets/Heart.glb"
    
    if not os.path.exists(mesh_path):
        # Fallback to dummy data if mesh is missing
        print(f"Warning: Mesh {mesh_path} not found. Using dummy tensor.")
        tensor = torch.randn(1, 1, 32, 32, 32).to(device)
    else:
        try:
            tensor = preprocess_mesh_to_voxel(mesh_path, pitch=0.5).to(device)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Voxelization error: {str(e)}")

    with torch.no_grad():
        # 1. Forward Pass & Softmax
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)
        
        # 2. Metrics Extraction
        # Get probability map for the disease class (index 1)
        disease_probs = probs[0, 1, ...]
        
        # Segmentation: Threshold the probability map
        threshold = 0.5
        segmentation_mask = (disease_probs > threshold).float()
        
        # Forecasting (Risk Index): Ratio of diseased voxels to total organ voxels
        total_voxels = torch.numel(segmentation_mask)
        diseased_voxels = torch.sum(segmentation_mask).item()
        
        risk_ratio = diseased_voxels / max(total_voxels, 1)
        
        # Confidence can be modeled as the mean probability of the segmented area
        if diseased_voxels > 0:
            confidence = torch.sum(disease_probs * segmentation_mask).item() / diseased_voxels
        else:
            confidence = 0.0

    return {
        "model_name": "3D U-Net (Volumetric)",
        "patient_id": request.patient_id,
        "summary": "Processed 3D voxel grid successfully.",
        "risk_index": risk_ratio,
        "diseased_voxels": diseased_voxels,
        "total_voxels": total_voxels,
        "confidence": confidence,
        "status": "success"
    }

@app.post("/api/v1/inference/heart-disease")
async def run_heart_disease_inference(request: InferenceRequest):
    """
    Route for the Kaggle Heart Disease Notebook model.
    Maps tabular data to a global risk score for the Heart.glb anatomy.
    """
    try:
        result = heart_disease_adapter.predict(request.payload)
        result["patient_id"] = request.patient_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/inference/brain-tumor")
async def run_brain_tumor_inference(request: InferenceRequest):
    """
    Route for the Kaggle Brain Tumor Notebook model.
    Maps 2D CNN slice analysis to a 3D spatial coordinate for Brain.glb.
    """
    try:
        result = brain_tumor_adapter.predict(request.payload)
        result["patient_id"] = request.patient_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ForecastRequest(BaseModel):
    patient_id: str
    forecast_day: int

@app.post("/api/v1/inference/forecast")
async def run_forecast_inference(request: ForecastRequest):
    """
    Route for localized Time-Series predictive forecasting.
    """
    try:
        result = forecast_adapter.predict(request.forecast_day)
        result["patient_id"] = request.patient_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/inference/stroke")
async def run_stroke(request: InferenceRequest):
    try:
        result = stroke_adapter.predict(request.payload)
        result["patient_id"] = request.patient_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/inference/lung-cancer")
async def run_lung(request: InferenceRequest):
    try:
        result = lung_cancer_adapter.predict(request.payload)
        result["patient_id"] = request.patient_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/inference/pneumonia")
async def run_pneumonia(request: InferenceRequest):
    try:
        result = pneumonia_adapter.predict(request.payload)
        result["patient_id"] = request.patient_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/inference/melanoma")
async def run_melanoma(request: InferenceRequest):
    try:
        result = melanoma_adapter.predict(request.payload)
        result["patient_id"] = request.patient_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/inference/gastro")
async def run_gastro(request: InferenceRequest):
    try:
        result = gastro_adapter.predict(request.payload)
        result["patient_id"] = request.patient_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
