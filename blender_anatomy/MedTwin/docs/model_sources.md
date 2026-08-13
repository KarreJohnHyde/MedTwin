# Local model source register

This register records how the user-provided notebooks and documents informed
the MedTwin research prototype. They are reference material, not training data
licenses or evidence of clinical performance. No notebook output, patient
content, or model weight is imported automatically.

## Implemented and reproducible paths

- `heart.csv` - used by `scripts/train_heart_risk.py` as a local input. The
  XGBoost workflow deduplicates rows before a stratified split, then reports
  ROC-AUC, F1, accuracy, and a confusion matrix.
- `heart-disease-exploratory-data-analysis.ipynb`,
  `neuralnetwork-heart-disease-dataset.ipynb`,
  `listen-to-your-heart-a-disease-prediction.ipynb`, and
  `what-causes-heart-disease-explaining-the-model.ipynb` - informed the
  tabular feature schema, model comparison, and ROC-AUC/feature-explainability
  evaluation pattern.
- `brain-stroke-analysis-accuracy-96-03.ipynb` and
  `vitalpulse-2026-predictive-health-diagnostic.ipynb` - informed the
  reproducible classical baseline and vital-sign risk-fusion patterns.
- `vision-transformer-vit-tutorial-baseline.ipynb` - informed the compact
  patch-transformer interface in `NeuroTwin/advanced_models.py`.
- `generating-brain-mri-images-with-dc-gan.ipynb` - informed the DCGAN-style
  MRI generator interface. Generated images must never be mixed into
  validation/test cohorts.
- `brain-tumor-detection-from-mri-images-deep-cn.ipynb`,
  `brain-tumor-detection-v1-0-cnn-vgg-16.ipynb`, and
  `isic-pytorch-training-baseline-image-only.ipynb` - informed image split,
  augmentation, CNN, and held-out evaluation conventions.
- `uwmgi-mask-data.ipynb`, `uwmgi-2-5d-train-pytorch.ipynb`, and
  `uwmgi-unet-train-pytorch.ipynb` - inform a future segmentation track:
  masks need Dice/Jaccard metrics and patient-level splits. This is not yet an
  API inference path.
- `brain-tumor-eda-with-animations-and-modeling.ipynb`,
  `eda-3d-baseline-rsna-glioma-radiogenomics.ipynb`, and `rsna-2022-eda.ipynb`
  - inform a future DICOM/3-D data-quality track. DICOM and 3-D pipelines are
  intentionally not substituted with 2-D JPEG models.

## Reviewed but intentionally not wired into inference

- `exercise-deep-reinforcement-learning.ipynb` - unrelated game-RL exercise;
  no reinforcement-learning policy is appropriate for unsupervised clinical
  decisions.
- `eda-training-a-fast-ai-model-submission.ipynb`, `lung-cancer-prediction.ipynb`,
  `cancer-prediction.ipynb`, `pneumonia-detection-using-cnn-92-6-accuracy.ipynb`,
  and `unsupervised-learning.ipynb` - useful baseline/EDA references, but
  their datasets, labels, and task definitions do not match MedTwin's current
  ECG, cardiac-tabular, and brain-MRI interfaces.

## Clinical documents

- `403056201-CI-02-Heart-Related.pdf` was reviewed as an administrative
  heart-related report form.
- `802289083-Cardiac-Patient-Taking-History-File-for-Clinical-Rotation.pdf`
  was reviewed as a structured intake reference (chief complaint, symptom
  onset/duration/intensity, medical and medication history, family/social
  history, and functional assessment).

These forms inform future, consented data-capture fields only. They do not
provide ground-truth labels and must not be uploaded to the API as model data.

## Running the local heart baseline

```powershell
cd C:\blender_anatomy
python MedTwin\scripts\train_heart_risk.py `
  --data C:\Users\johnn\Downloads\heart.csv `
  --output MedTwin\artifacts\heart_xgboost.joblib

$env:MEDTWIN_XGB_MODEL_PATH = "C:\blender_anatomy\MedTwin\artifacts\heart_xgboost.joblib"
python -m uvicorn MedTwin.cloud.api.main:app --port 8001
```

The resulting artifact is a research baseline. Its validation metrics are not
a clinical performance claim and must be re-evaluated on a governed external
test set before any real-world use.

## Running the synthetic intestine segmentation baseline

```powershell
python MedTwin\scripts\train_uwmgi_unet.py
```

The resulting artifact (uwmgi_unet.pt) is trained on synthetic patterned tensors representing 3D MRI scans to fulfill architecture tests. No real patient data is used.
