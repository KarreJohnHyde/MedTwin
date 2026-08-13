import json
import datetime

def generate_live_risk_report(inference_payload):
    """
    Formats the raw model inference outputs into a standardized 
    executive diagnostic report as specified in the system instructions.
    """
    
    # Extract data
    patient_id = inference_payload.get("patient_id")
    preds = inference_payload.get("predictions", {})
    
    mi_risk = preds.get("30_day_mi_risk", 0.0)
    arrhythmia_risk = preds.get("24h_arrhythmia_risk", 0.0)
    entities = preds.get("detected_clinical_entities", [])
    
    # Formulate recommendations based on risk thresholds
    interventions = []
    if mi_risk > 0.7:
        interventions.append("URGENT: Schedule Coronary Computed Tomography Angiogram (CCTA) or Cardiac Catheterization.")
        interventions.append("Consider immediate statin therapy adjustment.")
    elif mi_risk > 0.4:
        interventions.append("Schedule Nuclear Cardiac Stress Test (MPI) within 7 days.")
        
    if arrhythmia_risk > 0.8:
        interventions.append("CRITICAL: High probability of imminent arrhythmia. Continuous telemetry monitoring required.")
    
    if "Chest Pain" in entities:
        interventions.append("Evaluate for angina. Administer ECG to check for ST-segment elevation.")
        
    if not interventions:
        interventions.append("Continue standard care and routine monitoring.")
        
    report = f"""
================================================================================
CARDIOAI-ULTRA: LIVE PREDICTIVE ANALYTICAL FORECASTING & RISK REPORT
================================================================================
Timestamp (UTC): {datetime.datetime.utcnow().isoformat()}
Patient ID:      {patient_id}

1. PATIENT RISK IDENTIFICATION:
   - Extracted NLP Entities: {', '.join(entities) if entities else 'None detected'}
   - CAC Score / Stenosis Status: (Pending Imaging Upload)
   - Ejection Fraction Status: (Pending Echo Data)

2. REAL-TIME FORECASTING & PROGNOSTIC TRAJECTORY:
   - 24-hour Arrhythmia Risk: {arrhythmia_risk * 100:.1f}%
   - 30-day Acute MI Risk:    {mi_risk * 100:.1f}%

3. RECOMMENDED CLINICAL INTERVENTIONS & NEXT STEPS:
"""
    for idx, intervention in enumerate(interventions):
        report += f"   {idx+1}. {intervention}\n"
        
    report += "================================================================================\n"
    
    return report

if __name__ == "__main__":
    print("Initiating Phase 4, Task 4.3: Real-Time Risk Report Generation")
    
    # Mock inference payload coming from the inference endpoint
    mock_inference_payload = {
        "patient_id": "P889",
        "predictions": {
            "30_day_mi_risk": 0.75,
            "24h_arrhythmia_risk": 0.12,
            "detected_clinical_entities": ["Hypertension", "Chest Pain"]
        }
    }
    
    report_text = generate_live_risk_report(mock_inference_payload)
    print(report_text)
    
    # Save report
    with open("sample_patient_report.txt", "w") as f:
        f.write(report_text)
