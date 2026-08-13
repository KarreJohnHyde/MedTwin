import json
import os
import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)
LOCAL_DB_FILE = "local_mock_db.json"

def lambda_handler(event, context):
    """
    Simulates the AWS Lambda function that processes incoming telemetry 
    and clinical data.
    """
    try:
        body = json.loads(event.get("body", "{}"))
        
        patient_id = body.get("patient_id")
        timestamp = body.get("timestamp", datetime.datetime.utcnow().isoformat())
        
        if not patient_id:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing patient_id in payload"})
            }
            
        # Modalities Extraction
        vitals = body.get("vitals", {})
        ecg_data = body.get("ecg_data", [])
        clinical_notes = body.get("clinical_notes", "")
        
        # 1. Store structured data to DynamoDB (Mocked via local JSON file)
        record = {
            "timestamp": timestamp,
            "vitals": vitals,
            "ecg_data_length": len(ecg_data),
            "clinical_notes_preview": clinical_notes[:100] + "..." if clinical_notes else ""
        }
        
        if os.path.exists(LOCAL_DB_FILE):
            with open(LOCAL_DB_FILE, "r") as f:
                db = json.load(f)
        else:
            db = {"patients": {}}
            
        if patient_id not in db["patients"]:
            db["patients"][patient_id] = []
            
        db["patients"][patient_id].append(record)
        
        with open(LOCAL_DB_FILE, "w") as f:
            json.dump(db, f, indent=4)
            
        # In a real scenario, raw ECG or Imaging data might go to S3 here.
            
        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Data ingested successfully", "patient_id": patient_id})
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

@app.route("/ingest", methods=["POST"])
def ingest_data():
    """
    Simulates the API Gateway endpoint triggering the Lambda.
    """
    event = {
        "body": request.get_data(as_text=True),
        "headers": dict(request.headers)
    }
    
    # Trigger Lambda
    response = lambda_handler(event, None)
    
    return jsonify(json.loads(response["body"])), response["statusCode"]

if __name__ == "__main__":
    print("Starting Cardio-Ultra Mock Ingestion API on port 5000...")
    app.run(port=5000, debug=True)
