import numpy as np
import random

class HeartDiseaseAdapter:
    """
    Adapter for the 'heart-disease-exploratory-data-analysis.ipynb' notebook model.
    This notebook typically uses tabular patient data (age, sex, cp, trestbps, chol, etc.)
    to predict heart disease presence.
    
    In this adapter, we map the tabular output to a global 'Risk Index' for the 
    Heart.glb 3D anatomy model.
    """
    def __init__(self):
        # In a real scenario, we would load the serialized model weights here:
        # self.model = joblib.load('models/heart_disease_rf.pkl')
        self.is_loaded = True
        print("Heart Disease Tabular Model Adapter loaded.")

    def predict(self, patient_data: dict) -> dict:
        """
        Simulate a prediction based on patient tabular data.
        Returns a risk score that the UI can use for forecasting on the 3D model.
        """
        if not self.is_loaded:
            raise RuntimeError("Model is not loaded.")
            
        # Mock prediction logic representing the XGBoost/RF output
        # In reality, this would be: probs = self.model.predict_proba(df)[0][1]
        base_risk = 0.18
        
        # Adjust risk based on mock tabular features if provided
        age = patient_data.get('age', 50)
        chol = patient_data.get('chol', 200)
        
        if age > 60:
            base_risk += 0.15
        if chol > 240:
            base_risk += 0.20
            
        risk_score = min(max(base_risk + random.uniform(-0.05, 0.05), 0.0), 1.0)
        
        # Return structured data for the Next.js frontend to map onto the Heart
        return {
            "model_type": "tabular",
            "source_notebook": "heart-disease-exploratory-data-analysis.ipynb",
            "prediction_class": "Heart Disease Present" if risk_score > 0.5 else "Normal",
            "risk_score": risk_score,
            "confidence": 0.88,
            "mapping": "global", # Indicates this affects the entire organ, not a specific spatial region
            "features_used": ["age", "sex", "cp", "trestbps", "chol"]
        }
