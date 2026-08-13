# Dataset Licenses & Provenance

For this prototype, we rely on the following public benchmark datasets as specified in the MedTwin IEEE paper.

## 1. MIT-BIH Arrhythmia Database
- **Source:** PhysioNet
- **Access:** Open Access (v1.0.0)
- **License:** Open Data Commons Open Database License (ODbL) v1.0
- **Usage in MedTwin:** Primary training and evaluation corpus for the LSTM Arrhythmia classifier.

## 2. PTB-XL, a large publicly available electrocardiography dataset
- **Source:** PhysioNet
- **Access:** Open Access (v1.0.3)
- **License:** Open Data Commons Open Database License (ODbL) v1.0
- **Usage in MedTwin:** Cross-validation and robustness testing for the signal branch.

## 3. MURA (MUsculoskeletal RAdiographs) / RSNA Bone Age
- **Source:** Stanford ML Group / Kaggle
- **Access:** Data Use Agreement Required (for MURA) / Kaggle Login (for RSNA).
- **License:** Non-commercial research use only.
- **Usage in MedTwin:** Training the ResNet-50 Faster R-CNN localization branch.
*Note: Due to automated deployment restrictions, a tiny synthetic/public sample subset is used for end-to-end edge simulation, but full training requires local developer authentication.*

## 4. Clinical Text Subset
- **Source:** HuggingFace / Public De-identified Medical Notes (Subset of MIMIC-III Demo or similar open equivalent).
- **Access:** Open Access / Restricted.
- **License:** Research use only.
- **Usage in MedTwin:** Fine-tuning ClinicalBERT for finding extraction.
