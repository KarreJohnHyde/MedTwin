"""
NeuroTwin: NLP Feature Extraction Module
This module utilizes BERT and Transformer Encoders to parse unstructured clinical notes,
patient history, and encyclopedic text to extract features related to brain diseases.
"""

import warnings
import json

try:
    from transformers import pipeline
except ImportError:
    warnings.warn("Please install transformers and torch for NLP feature extraction.")

class NeuroNLPFeatureExtractor:
    def __init__(self):
        print("Initializing BERT Named Entity Recognition Pipeline...")
        try:
            # Using a generic NER model for demonstration. 
            # In production, a specialized medical model like 'd4data/biomedical-ner-all' should be used.
            self.ner_pipeline = pipeline("ner", aggregation_strategy="simple")
        except Exception as e:
            print(f"Failed to load pipeline: {e}")
            self.ner_pipeline = None

    def extract_features(self, text):
        """
        Extracts medical entities (diseases, symptoms, medications) from text.
        """
        if not self.ner_pipeline:
            return {"error": "Pipeline not initialized"}
            
        print(f"Extracting features from text of length {len(text)}...")
        entities = self.ner_pipeline(text)
        
        # Filter and structure the extracted entities
        features = {
            "conditions": [],
            "symptoms": [],
            "other_entities": []
        }
        
        for ent in entities:
            word = ent['word']
            # Simple heuristic mapping for demonstration
            if ent['entity_group'] == 'DIS' or 'disease' in word.lower():
                features["conditions"].append(word)
            else:
                features["other_entities"].append(word)
                
        return features

if __name__ == "__main__":
    # Example usage testing with a snippet of the provided text
    sample_text = "Multiple sclerosis (MS) is the most prominent of these. Like electrical wires, nerve cells have insulation covering them."
    
    extractor = NeuroNLPFeatureExtractor()
    results = extractor.extract_features(sample_text)
    
    print("\n--- Extracted Features ---")
    print(json.dumps(results, indent=2))
