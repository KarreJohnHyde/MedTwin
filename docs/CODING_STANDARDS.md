# MedTwin Coding Standards

## 1. Traceability to Literature
All module and class names MUST align exactly with the terminology used in the IEEE base paper to ensure traceability for grading.

### Key Naming Conventions
- **Imaging**: Use `imaging_branch`, `ResNet50_FPN_Backbone`, `GradCAM_Explainer`.
- **Signal**: Use `signal_branch`, `LSTM_Arrhythmia_Classifier`.
- **NLP**: Use `nlp_fusion_engine` or `clinical_bert_extractor`.
- **Fusion**: Use `agreement_score_A`, `fusion_engine`.

## 2. Metrics and Evaluation
- Any computed metric must use the exact names from Table II: `Accuracy`, `mAP`, `F1`, `Combined F1`.
- Never fabricate, estimate, or round up metrics. Report raw evaluated numbers on the hold-out splits.

## 3. Disclaimers
Every UI screen and report must carry a visible: **"research prototype — not for clinical use"** notice.
