import logging
import os

try:
    from transformers import pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger("medtwin.models.nlp")

# Lazy loading to avoid blocking FastAPI startup
_nlp_pipeline = None

def get_clinical_bert():
    global _nlp_pipeline
    # Bio_ClinicalBERT is a base encoder, not a trained NER head.  Avoid a
    # surprise network download and uncalibrated token-classification output
    # unless an operator deliberately enables a compatible local model.
    if _nlp_pipeline is None and TRANSFORMERS_AVAILABLE and os.getenv("MEDTWIN_ENABLE_REMOTE_NLP") == "1":
        try:
            model_name = os.getenv("MEDTWIN_NLP_MODEL", "emilyalsentzer/Bio_ClinicalBERT")
            logger.info("Initializing configured NLP pipeline: %s", model_name)
            _nlp_pipeline = pipeline("ner", model=model_name, aggregation_strategy="simple")
        except Exception as e:
            logger.warning(f"Failed to load ClinicalBERT: {e}")
    return _nlp_pipeline

def run_clinical_nlp(report_text: str) -> dict:
    """Extracts entities using ClinicalBERT with a heuristic fallback."""
    diagnoses = []
    symptoms = []
    
    nlp = get_clinical_bert()
    if nlp:
        try:
            entities = nlp(report_text)
            for ent in entities:
                word = ent.get('word', '').lower()
                # Bio_ClinicalBERT typically outputs tokens, we filter for clinical significance
                if word in ["fracture", "lesion", "pneumonia", "afib"]:
                    diagnoses.append({"entity": word, "assertion": "present"})
                elif word in ["pain", "palpitations", "shortness of breath", "chest pressure"]:
                    symptoms.append({"entity": word, "assertion": "present"})
            # Only return early if BERT actually found something meaningful
            if diagnoses or symptoms:
                return {"diagnoses": diagnoses, "symptoms": symptoms, "engine": "Bio_ClinicalBERT NER"}
            # Otherwise fall through to the heuristic to augment
        except Exception as e:
            logger.error(f"NLP pipeline error: {e}")
            
    # Transparent heuristic fallback with comprehensive cardiac + neuro vocabulary
    text = report_text.lower()
    
    # ── Expanded diagnosis vocabulary ──
    terms = {
        # Cardiac conditions
        "fracture": "fracture", "lesion": "lesion", "pneumonia": "pneumonia",
        "atrial fibrillation": "afib", "afib": "afib", "pvc": "pvc",
        "myocardial infarction": "mi", "heart attack": "mi",
        "coronary artery disease": "cad", "angina": "angina",
        "heart failure": "heart_failure", "cardiac arrest": "cardiac_arrest",
        "cardiomyopathy": "cardiomyopathy", "arrhythmia": "arrhythmia",
        "hypertension": "hypertension", "high blood pressure": "hypertension",
        "stenosis": "stenosis", "valve disease": "valve_disease",
        "aortic aneurysm": "aortic_aneurysm", "pulmonary hypertension": "pulmonary_htn",
        "endocarditis": "endocarditis", "pericarditis": "pericarditis",
        # Neurological conditions
        "stroke": "stroke", "cerebrovascular accident": "stroke", "cva": "stroke",
        "transient ischemic attack": "tia", "tia": "tia",
        "epilepsy": "epilepsy", "seizure disorder": "epilepsy",
        "multiple sclerosis": "ms",
        "parkinson": "parkinsons", "parkinson's disease": "parkinsons",
        "alzheimer": "alzheimers", "alzheimer's disease": "alzheimers",
        "dementia": "dementia", "brain tumor": "brain_tumor",
        "glioma": "glioma", "meningioma": "meningioma", "astrocytoma": "astrocytoma",
        "encephalitis": "encephalitis", "meningitis": "meningitis",
        "traumatic brain injury": "tbi", "concussion": "concussion",
        "hydrocephalus": "hydrocephalus", "cerebral palsy": "cerebral_palsy",
        "autism": "autism", "adhd": "adhd", "dyslexia": "dyslexia",
        "schizophrenia": "schizophrenia", "bipolar disorder": "bipolar",
        "depression": "depression", "anxiety disorder": "anxiety",
        "ptsd": "ptsd", "als": "als", "amyotrophic lateral sclerosis": "als",
        "guillain-barré": "gbs", "huntington": "huntingtons",
        "neuropathy": "neuropathy", "migraine": "migraine",
    }
    
    for term, canonical in terms.items():
        start = text.find(term)
        if start >= 0 and not any(item["entity"] == canonical for item in diagnoses):
            nearby = text[max(0, start-32):start]
            diagnoses.append({"entity": canonical, "assertion": "absent" if any(word in nearby for word in ("no ", "without ", "denies ", "negative for ", "ruled out ")) else "present"})
    
    # ── Expanded symptom vocabulary ──
    symptom_terms = (
        # Cardiac symptoms
        "chest pain", "chest pressure", "palpitations", "shortness of breath", "dizziness",
        "syncope", "fainting", "edema", "swelling", "dyspnea", "orthopnea",
        "cyanosis", "tachycardia", "bradycardia", "diaphoresis", "sweating",
        "jaw pain", "arm pain", "nausea", "fatigue", "weakness",
        # Neurological symptoms
        "seizure", "convulsion", "tremor", "numbness", "tingling",
        "confusion", "memory loss", "aphasia", "speech difficulty",
        "vision loss", "double vision", "headache", "vertigo",
        "paralysis", "hemiparesis", "ataxia", "involuntary movement",
        "light-headedness", "loss of consciousness", "cough",
    )
    
    for term in symptom_terms:
        if term in text and not any(item["entity"] == term for item in symptoms):
            # Check for negation
            start = text.find(term)
            nearby = text[max(0, start-32):start]
            assertion = "absent" if any(word in nearby for word in ("no ", "without ", "denies ")) else "present"
            symptoms.append({"entity": term, "assertion": assertion})
    
    return {"diagnoses": diagnoses, "symptoms": symptoms, "engine": "rule-backed ClinicalBERT adapter (fallback)"}
