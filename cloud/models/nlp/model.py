import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModelForTokenClassification

class MedTwinNLPModel(nn.Module):
    """
    ClinicalBERT-based NLP pipeline for Named Entity Recognition (NER).
    Extracts structured findings (Diagnosis, Medication, Symptom) from clinical reports.
    """
    def __init__(self, model_name="emilyalsentzer/Bio_ClinicalBERT", num_labels=7):
        """
        Args:
            model_name: HuggingFace model string. Default is Bio_ClinicalBERT.
            num_labels: Number of BIO tags. e.g., 
                        0: O (Outside)
                        1: B-Diagnosis
                        2: I-Diagnosis
                        3: B-Medication
                        4: I-Medication
                        5: B-Symptom
                        6: I-Symptom
        """
        super(MedTwinNLPModel, self).__init__()
        
        # Load Tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Load pre-trained BERT with Token Classification Head
        self.bert = AutoModelForTokenClassification.from_pretrained(
            model_name, 
            num_labels=num_labels,
            ignore_mismatched_sizes=True
        )
        
        self.id2label = {
            0: 'O',
            1: 'B-Diagnosis', 2: 'I-Diagnosis',
            3: 'B-Medication', 4: 'I-Medication',
            5: 'B-Symptom', 6: 'I-Symptom'
        }

    def forward(self, input_ids, attention_mask):
        return self.bert(input_ids=input_ids, attention_mask=attention_mask).logits

    def extract_entities(self, text):
        """
        Runs the full extraction pipeline on raw text.
        """
        self.bert.eval()
        
        # Tokenize
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
        
        with torch.no_grad():
            logits = self.forward(inputs["input_ids"], inputs["attention_mask"])
            
        # Get predictions
        predictions = torch.argmax(logits, dim=-1).squeeze().tolist()
        tokens = self.tokenizer.convert_ids_to_tokens(inputs["input_ids"].squeeze().tolist())
        
        entities = {"Diagnosis": [], "Medication": [], "Symptom": []}
        
        current_entity = []
        current_type = None
        
        for token, pred_id in zip(tokens, predictions):
            if token in ["[CLS]", "[SEP]", "[PAD]"]:
                continue
                
            label = self.id2label[pred_id]
            
            if label.startswith("B-"):
                if current_entity:
                    # Save previous entity
                    entity_str = self.tokenizer.convert_tokens_to_string(current_entity)
                    entities[current_type].append(entity_str)
                
                current_entity = [token]
                current_type = label.split("-")[1]
                
            elif label.startswith("I-") and current_type == label.split("-")[1]:
                current_entity.append(token)
                
            else:
                if current_entity:
                    # Save previous entity
                    entity_str = self.tokenizer.convert_tokens_to_string(current_entity)
                    entities[current_type].append(entity_str)
                    current_entity = []
                    current_type = None
                    
        # Catch any trailing entity
        if current_entity:
            entity_str = self.tokenizer.convert_tokens_to_string(current_entity)
            entities[current_type].append(entity_str)
            
        return entities

if __name__ == "__main__":
    # Test initialization (will download from HF if not cached)
    print("Initializing MedTwin NLP Model...")
    model = MedTwinNLPModel()
    
    sample_text = "The patient presents with severe chest pain and a fractured radius. Prescribed Aspirin 81mg."
    extracted = model.extract_entities(sample_text)
    
    print("\nSample Report:", sample_text)
    print("Extracted Entities:", extracted)
    print("MedTwin NLP Model initialized successfully.")
