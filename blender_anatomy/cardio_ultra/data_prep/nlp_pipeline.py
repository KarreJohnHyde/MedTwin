import os

# Note: In a real environment, you would need to install transformers and torch:
# pip install transformers torch
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("Warning: 'transformers' or 'torch' library not found. Running in mock mode.")

def process_clinical_notes(notes):
    """
    Uses ClinicalBERT (or a mock equivalent if libraries are missing) 
    to extract named entities from clinical notes.
    
    Target Entities: Medical conditions, medications, symptoms.
    """
    if not TRANSFORMERS_AVAILABLE:
        # Mock NLP extraction for local testing without large models
        print("MOCK MODE: Extracting entities using heuristics...")
        entities = []
        if "chest pain" in notes.lower():
            entities.append({"word": "chest pain", "entity": "SYMPTOM", "score": 0.95})
        if "hypertension" in notes.lower():
            entities.append({"word": "hypertension", "entity": "DISEASE", "score": 0.99})
        if "aspirin" in notes.lower():
            entities.append({"word": "aspirin", "entity": "MEDICATION", "score": 0.98})
        return entities

    print("Initializing ClinicalBERT Pipeline...")
    # Typically, you would use a model fine-tuned for medical NER like:
    # d4data/biomedical-ner-all or emilyalsentzer/Bio_ClinicalBERT (requires custom NER head)
    # For demonstration, we use a generic placeholder name. 
    model_name = "d4data/biomedical-ner-all" 
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForTokenClassification.from_pretrained(model_name)
        nlp_pipeline = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
        
        print(f"Processing notes: {notes[:50]}...")
        results = nlp_pipeline(notes)
        return results
        
    except Exception as e:
        print(f"Error loading model {model_name}: {e}")
        print("Falling back to mock extraction...")
        return []

if __name__ == "__main__":
    print("Initiating Phase 2, Task 2.2: NLP Pipeline")
    
    sample_notes = "Patient presents with severe chest pain radiating to the left arm. History of hypertension. Currently taking aspirin 81mg daily."
    
    extracted_entities = process_clinical_notes(sample_notes)
    
    print("\nExtracted Entities:")
    for entity in extracted_entities:
        print(f"- {entity['word']} ({entity['entity']}, confidence: {entity['score']:.2f})")
