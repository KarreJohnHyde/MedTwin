"""
MedTwin Cloud Models NLP Package.
Re-exports from the top-level nlp.py and the detailed model.py for clean imports.
"""
import sys
import os
import importlib
import importlib.util

# The main run_clinical_nlp lives in cloud/models/nlp.py (a sibling file).
# Since this __init__.py creates the nlp *package*, we need to import the sibling.
_parent = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_nlp_file = os.path.join(_parent, "nlp.py")

if os.path.exists(_nlp_file):
    spec = importlib.util.spec_from_file_location("_nlp_toplevel", _nlp_file)
    _mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(_mod)
    run_clinical_nlp = _mod.run_clinical_nlp
    get_clinical_bert = _mod.get_clinical_bert
else:
    def run_clinical_nlp(text):
        return {"diagnoses": [], "symptoms": [], "engine": "unavailable"}
    def get_clinical_bert():
        return None

__all__ = ["run_clinical_nlp", "get_clinical_bert"]
