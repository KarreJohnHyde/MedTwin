import json
import logging
import time
from typing import Dict, List, Any

logger = logging.getLogger("medtwin.cdss")

class CDSSEngine:
    """
    Clinical Decision Support System (CDSS)
    Processes AI multimodal fusion outputs and cross-references against 
    clinical guidelines, drug-drug interactions, and contraindications.
    """
    def __init__(self):
        # Mock database of guidelines
        self.guidelines = {
            "afib": {
                "name": "Atrial Fibrillation Management",
                "rules": [
                    {"condition": lambda ctx: ctx.get("age", 0) > 65 and ctx.get("hypertension", False), 
                     "action": "Initiate DOAC (e.g., Apixaban) for stroke prophylaxis (CHA2DS2-VASc >= 2)."},
                    {"condition": lambda ctx: ctx.get("heart_rate", 0) > 110, 
                     "action": "Consider rate control with Beta-blocker or Diltiazem."}
                ]
            },
            "hcm": {
                "name": "Hypertrophic Cardiomyopathy",
                "rules": [
                    {"condition": lambda ctx: ctx.get("gradient", 0) > 50, 
                     "action": "Severe LVOTO detected. Avoid vasodilators and diuretics."},
                    {"condition": lambda ctx: "syncope" in ctx.get("symptoms", []), 
                     "action": "High risk for SCD. ICD evaluation strongly recommended."}
                ]
            },
            "brain_tumor": {
                 "name": "Intracranial Mass Management",
                 "rules": [
                     {"condition": lambda ctx: ctx.get("edema", False), 
                      "action": "Administer Dexamethasone to reduce vasogenic edema."},
                     {"condition": lambda ctx: "seizure" in ctx.get("symptoms", []), 
                      "action": "Start prophylactic antiepileptic (e.g., Levetiracetam)."}
                 ]
            }
        }
        
        # Mock Drug-Drug Interactions
        self.ddi_db = {
            ("amiodarone", "digoxin"): "SEVERE: Amiodarone increases digoxin toxicity risk.",
            ("apixaban", "ketoconazole"): "MODERATE: Increased bleeding risk due to CYP3A4 inhibition.",
        }

    def evaluate_patient(self, fusion_state: Dict[str, Any], patient_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Evaluate the fusion state against guidelines and return actionable insights.
        """
        start_t = time.time()
        ctx = patient_data or {}
        
        # Extract features from fusion state
        ecg_label = fusion_state.get("ecg_prediction", "").lower()
        vision_label = fusion_state.get("vision_prediction", "").lower()
        nlp_entities = fusion_state.get("nlp_entities", {})
        
        ctx["heart_rate"] = fusion_state.get("heart_rate", 72)
        ctx["symptoms"] = [s.get("entity", "").lower() for s in nlp_entities.get("symptoms", [])]
        
        # Determine active conditions based on AI outputs
        active_conditions = []
        if "fibrillation" in ecg_label or "afib" in ecg_label:
            active_conditions.append("afib")
        if "hypertrophic" in ecg_label or "hcm" in vision_label:
            active_conditions.append("hcm")
        if "tumor" in vision_label or "glioma" in vision_label:
            active_conditions.append("brain_tumor")
            
        recommendations = []
        warnings = []
        
        # Evaluate Guidelines
        for condition in active_conditions:
            if condition in self.guidelines:
                guide = self.guidelines[condition]
                for rule in guide["rules"]:
                    try:
                        if rule["condition"](ctx):
                            recommendations.append(f"[{guide['name']}] {rule['action']}")
                    except Exception as e:
                        logger.error(f"Error evaluating rule in {condition}: {e}")
                        
        # Mock DDI check if medications are provided
        meds = [m.lower() for m in ctx.get("medications", [])]
        for i in range(len(meds)):
            for j in range(i+1, len(meds)):
                pair = tuple(sorted([meds[i], meds[j]]))
                if pair in self.ddi_db:
                    warnings.append(self.ddi_db[pair])
                    
        # General heuristics based on AI confidence
        confidence = fusion_state.get("agreement_score", 1.0)
        if confidence < 0.6:
            warnings.append("AI Modality Conflict: Clinical correlation heavily required before intervention.")
            
        return {
            "cdss_active": True,
            "conditions_analyzed": active_conditions,
            "recommendations": recommendations,
            "warnings": warnings,
            "compute_ms": round((time.time() - start_t) * 1000, 2)
        }
