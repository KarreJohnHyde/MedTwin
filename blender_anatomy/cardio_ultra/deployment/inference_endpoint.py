import json
import datetime
import random

def lambda_handler(event, context):
    """
    Simulates a combined inference endpoint. 
    In production, this would load the trained PyTorch, XGBoost, and NLP models
    to perform inference on a live patient payload.
    """
    try:
        body = json.loads(event.get("body", "{}"))
        patient_id = body.get("patient_id", "UNKNOWN_PATIENT")
        
        print(f"Running inference for Patient: {patient_id}")
        
        # 1. Tabular Inference (Mock XGBoost)
        # Assuming the model predicts 30-day MI risk
        mi_risk_prob = random.uniform(0.1, 0.9)
        
        # 2. Time-Series Inference (Mock LSTM)
        # Assuming the model predicts imminent arrhythmia (within 24h)
        arrhythmia_prob = random.uniform(0.01, 0.95)
        
        # 3. NLP Extraction
        clinical_entities = ["Hypertension", "Chest Pain"] if "chest pain" in body.get("clinical_notes", "").lower() else []
        
        # Formulate internal inference object
        inference_result = {
            "patient_id": patient_id,
            "timestamp_utc": datetime.datetime.utcnow().isoformat(),
            "predictions": {
                "30_day_mi_risk": float(mi_risk_prob),
                "24h_arrhythmia_risk": float(arrhythmia_prob),
                "detected_clinical_entities": clinical_entities
            },
            "status": "success"
        }
        
        return {
            "statusCode": 200,
            "body": json.dumps(inference_result)
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "status": "failed"})
        }

if __name__ == "__main__":
    print("Testing Inference Endpoint...")
    
    mock_event = {
        "body": json.dumps({
            "patient_id": "P001",
            "vitals": {"bp": "140/90", "hr": 88},
            "clinical_notes": "Patient reports chest pain."
        })
    }
    
    response = lambda_handler(mock_event, None)
    print(f"Response Status: {response['statusCode']}")
    print(f"Response Body: {json.dumps(json.loads(response['body']), indent=2)}")
