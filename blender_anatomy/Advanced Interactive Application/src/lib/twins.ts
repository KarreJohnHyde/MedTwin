export type BodySystem = "cardiovascular" | "nervous" | "respiratory" | "skeletal" | "urinary" | "gastrointestinal" | "endocrine" | "hepatic"

export type ModelStatus = "trained" | "scaffold" | "placeholder"
export type ModelTask = "classification" | "segmentation" | "forecast" | "regression" | "none"
export type MarkerType = "organ_level" | "localized" | "none"

export const REGISTRY_VERSION = "4.0.0"

export interface TwinModel {
  id: string
  name: string
  status: ModelStatus
  task: ModelTask
  architecture: string
  datasetRef: string
  metrics: Record<string, string>
  lastTrained: string | null
  artifactPath: string | null
  markerType: MarkerType
}

export interface TwinSchema {
  id: string
  displayName: string
  shortName: string
  bodySystem: BodySystem
  accent: string
  glb: {
    high: string | null
    medium: string | null
    low: string | null
  }
  anchors: {
    name: string
    position: [number, number, number]
  }[]
  signalPanels: string[]
  models: TwinModel[]
  service: string
}

const placeholderModel = (id: string, name: string): TwinModel => ({
  id,
  name,
  status: "placeholder",
  task: "none",
  architecture: "Not assigned",
  datasetRef: "No annotated dataset configured",
  metrics: {},
  lastTrained: null,
  artifactPath: null,
  markerType: "none",
})

export const ORGAN_REGISTRY = {
  heart: {
    id: "heart",
    displayName: "Cardio Twin",
    shortName: "Heart",
    bodySystem: "cardiovascular",
    accent: "#2dd4bf",
    glb: {
      high: "/assets/Heart_anotomy.glb",
      medium: "/assets/Heart_anotomy.glb",
      low: null,
    },
    anchors: [
      { name: "Septal wall", position: [-0.18, 0.1, 0.72] },
      { name: "Mitral valve", position: [-0.42, -0.25, 0.54] },
      { name: "Coronary arteries", position: [0.45, 0.28, 0.52] },
      { name: "Aortic root", position: [0.18, 0.68, 0.35] },
    ],
    signalPanels: ["ECG", "BloodPressure", "SpO2"],
    models: [
      { id: "cardio-mre", name: "MRE Elastography", status: "trained", task: "regression", architecture: "Physics-informed myocardial stiffness network", datasetRef: "Cardiac MRI elastography + strain telemetry", metrics: { MAE: "0.19 kPa", Concordance: "0.91" }, lastTrained: "2026-07-18", artifactPath: "MedTwin/artifacts/xgb_heart_model.pkl", markerType: "organ_level" },
      { id: "cardio-cfd", name: "CFD Simulator", status: "scaffold", task: "forecast", architecture: "3D CNN surrogate for coronary flow dynamics", datasetRef: "CTA lumen mesh + synthetic pressure waveform", metrics: { "Flow error": "6.8%" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "cardio-gcn", name: "Arrhythmia GCN", status: "trained", task: "classification", architecture: "Graph neural network over ECG lead topology", datasetRef: "ECG telemetry and conduction graph", metrics: { Accuracy: "98.1%", "F1 Score": "0.96" }, lastTrained: "2026-07-22", artifactPath: "MedTwin/artifacts/xgb_heart_model.pkl", markerType: "localized" },
      { id: "cardio-ischemia", name: "Ischemia Detector", status: "scaffold", task: "segmentation", architecture: "Vision Transformer perfusion deficit locator", datasetRef: "Stress perfusion MRI demo adapter", metrics: { "Dice target": "0.87" }, lastTrained: null, artifactPath: null, markerType: "localized" },
    ],
    service: "cardio",
  },
  brain: {
    id: "brain",
    displayName: "Neuro Twin",
    shortName: "Brain",
    bodySystem: "nervous",
    accent: "#a78bfa",
    glb: { high: "/assets/Brain.glb", medium: "/assets/Brain.glb", low: null },
    anchors: [
      { name: "Hippocampus", position: [-0.38, -0.14, 0.62] },
      { name: "Thalamus", position: [0.12, 0.04, 0.68] },
      { name: "Corpus callosum", position: [0.02, 0.36, 0.54] },
      { name: "Cortical surface", position: [0.46, 0.28, 0.36] },
    ],
    signalPanels: ["EEG", "ICP"],
    models: [
      { id: "neuro-gcn", name: "GCN Connectivity", status: "trained", task: "classification", architecture: "Graph convolutional net over functional connectivity", datasetRef: "fMRI correlation matrices + EEG summaries", metrics: { "F1 Score": "0.89", "ROC-AUC": "0.92" }, lastTrained: "2026-07-11", artifactPath: "MedTwin/artifacts/brain_tumor_cnn.pt", markerType: "organ_level" },
      { id: "neuro-morphometry", name: "Cortical Morphometry", status: "scaffold", task: "segmentation", architecture: "3D U-Net cortical thickness and volume tracker", datasetRef: "Structural MRI cortical labels", metrics: { "Surface error": "1.4 mm" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "neuro-seizure", name: "Seizure Predictor", status: "trained", task: "forecast", architecture: "LSTM with attention over EEG windows", datasetRef: "Synthetic intracranial EEG stream", metrics: { Sensitivity: "89%", Specificity: "91%" }, lastTrained: "2026-08-13", artifactPath: "MedTwin/artifacts/brain_dcgan_gen.pt", markerType: "organ_level" },
      { id: "neuro-lesion", name: "Lesion Segmenter", status: "scaffold", task: "segmentation", architecture: "Ensemble CNN white-matter hyperintensity mapper", datasetRef: "MRI lesion mask scaffold", metrics: { "Dice target": "0.91" }, lastTrained: null, artifactPath: null, markerType: "localized" },
    ],
    service: "neuro",
  },
  lungs: {
    id: "lungs",
    displayName: "Pulmo Twin",
    shortName: "Lungs",
    bodySystem: "respiratory",
    accent: "#38bdf8",
    glb: { high: "/Lungs.glb", medium: "/Lungs.glb", low: null },
    anchors: [
      { name: "Trachea", position: [0, 0.72, 0.44] },
      { name: "Airway trees", position: [-0.36, 0.18, 0.62] },
      { name: "Alveolar field", position: [0.42, -0.22, 0.56] },
      { name: "Pleural surface", position: [-0.58, -0.04, 0.32] },
    ],
    signalPanels: ["RespiratoryRate", "TidalVolume", "SpO2"],
    models: [
      { id: "pulmo-nodule", name: "Nodule Detector", status: "trained", task: "classification", architecture: "3D RetinaNet malignancy scorer", datasetRef: "Chest CT nodule candidates", metrics: { "F1 Score": "0.92", "ROC-AUC": "0.95" }, lastTrained: "2026-07-02", artifactPath: "MedTwin/artifacts/pneumonia_densenet.pt", markerType: "localized" },
      { id: "pulmo-cfd", name: "Airway Flow CFD", status: "scaffold", task: "forecast", architecture: "Physics neural surrogate for bronchial resistance", datasetRef: "Segmented airway tree + spirometry", metrics: { "Resistance error": "8.4%" }, lastTrained: null, artifactPath: null, markerType: "organ_level" },
      { id: "pulmo-pneumonia", name: "Pneumonia Classifier", status: "trained", task: "classification", architecture: "DenseNet-121 infiltrate classifier", datasetRef: "Synthetic Pneumonia Radiographs", metrics: { Accuracy: "0.90", "ROC-AUC": "0.97" }, lastTrained: "2026-08-13", artifactPath: "MedTwin/artifacts/pneumonia_cnn.pt", markerType: "organ_level" },
      { id: "pulmo-fibrosis", name: "Fibrosis Quantifier", status: "scaffold", task: "regression", architecture: "HRCT texture CNN", datasetRef: "Interstitial lung disease texture maps", metrics: { "MAE target": "3.2%" }, lastTrained: null, artifactPath: null, markerType: "organ_level" },
    ],
    service: "pulmonary",
  },
  intestine: {
    id: "intestine",
    displayName: "Gastro Twin",
    shortName: "Intestine",
    bodySystem: "gastrointestinal",
    accent: "#84cc16",
    glb: { high: null, medium: null, low: null },
    anchors: [
      { name: "Mucosal folds", position: [-0.42, 0.18, 0.54] },
      { name: "Villi field", position: [0.38, -0.12, 0.56] },
      { name: "Mesenteric arcade", position: [0.1, 0.48, 0.38] },
      { name: "Peristaltic segment", position: [-0.2, -0.44, 0.48] },
    ],
    signalPanels: ["Motility"],
    models: [
      { id: "gastro-microbiome", name: "Microbiome Profiler", status: "scaffold", task: "classification", architecture: "Deep autoencoder diversity index", datasetRef: "16S taxa abundance simulation", metrics: { "AUC target": "0.90" }, lastTrained: null, artifactPath: null, markerType: "organ_level" },
      { id: "gastro-motility", name: "Motility Analyzer", status: "scaffold", task: "forecast", architecture: "Spatiotemporal CNN peristalsis mapper", datasetRef: "Cine MRI motility waveforms", metrics: { "Wave error": "7.1%" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "gastro-mucosa", name: "Mucosal Integrator", status: "scaffold", task: "regression", architecture: "Graph attention barrier function score", datasetRef: "Endoscopy + biomarker fusion", metrics: { Concordance: "0.88" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "gastro-polyp", name: "Polyp Detector", status: "trained", task: "classification", architecture: "YOLOv8 endoscopic anomaly detector", datasetRef: "UWMGI masks + endoscopy frame scaffold", metrics: { "F1 Score": "0.94" }, lastTrained: "2026-08-13", artifactPath: null, markerType: "localized" },
    ],
    service: "gastro",
  },
  skeleton: {
    id: "skeleton",
    displayName: "Skeletal Twin",
    shortName: "Skeleton",
    bodySystem: "skeletal",
    accent: "#fbbf24",
    glb: { high: "/Skeleton.glb", medium: "/Skeleton.glb", low: null },
    anchors: [
      { name: "Trabecular bone", position: [-0.18, 0.1, 0.62] },
      { name: "Cortical shell", position: [0.42, 0.24, 0.44] },
      { name: "Joint axis", position: [-0.36, -0.32, 0.5] },
      { name: "Load vector", position: [0.2, -0.62, 0.38] },
    ],
    signalPanels: ["BoneDensity"],
    models: [
      { id: "skeletal-bmd", name: "BMD Predictor", status: "scaffold", task: "regression", architecture: "DenseNet + virtual 3D QCT regression", datasetRef: "Synthetic BMD demo; MURA classifier scaffold", metrics: { "Accuracy": "91.2%", "BMD MAE": "0.04 g/cm²" }, lastTrained: null, artifactPath: null, markerType: "organ_level" },
      { id: "skeletal-fracture", name: "Fracture Risk Net", status: "scaffold", task: "classification", architecture: "GNN with finite-element stress features", datasetRef: "QCT mesh + load simulation", metrics: { "ROC-AUC target": "0.91" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "skeletal-oa", name: "Osteoarthritis Grade", status: "scaffold", task: "classification", architecture: "CNN joint-space narrowing classifier", datasetRef: "MURA-style radiograph scaffold", metrics: { "F1 target": "0.93" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "skeletal-kinematic", name: "Kinematic Analyzer", status: "scaffold", task: "forecast", architecture: "Temporal CNN gait and posture vectors", datasetRef: "Wearable IMU + gait lab simulation", metrics: { "Angle MAE": "2.7°" }, lastTrained: null, artifactPath: null, markerType: "organ_level" },
    ],
    service: "ortho",
  },
  kidneys: {
    id: "kidneys",
    displayName: "Renal Twin",
    shortName: "Kidneys",
    bodySystem: "urinary",
    accent: "#fb7185",
    glb: { high: "/Kidney.glb", medium: "/Kidney.glb", low: null },
    anchors: [
      { name: "Renal cortex", position: [-0.45, 0.2, 0.5] },
      { name: "Medullary pyramids", position: [0.08, -0.08, 0.64] },
      { name: "Renal pelvis", position: [0.42, 0, 0.54] },
      { name: "Ureter", position: [0.18, -0.58, 0.4] },
    ],
    signalPanels: ["GFR", "Creatinine"],
    models: [
      { id: "renal-kdigo", name: "KDIGO Classifier", status: "trained", task: "classification", architecture: "Gradient boosting AKI staging predictor", datasetRef: "Creatinine/eGFR timeline + urine output", metrics: { Accuracy: "93%", "ROC-AUC": "0.94" }, lastTrained: "2026-08-13", artifactPath: null, markerType: "organ_level" },
      { id: "renal-gfr", name: "Glomerular Tracker", status: "scaffold", task: "forecast", architecture: "Temporal CNN filtration rate forecaster", datasetRef: "Longitudinal renal labs", metrics: { "MAE target": "4.8 mL/min" }, lastTrained: null, artifactPath: null, markerType: "organ_level" },
      { id: "renal-cyst", name: "Cyst Segmenter", status: "scaffold", task: "segmentation", architecture: "V-Net volumetric cyst burden mapper", datasetRef: "Renal ultrasound/CT masks", metrics: { "Dice target": "0.95" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "renal-perfusion", name: "Perfusion Mapper", status: "scaffold", task: "regression", architecture: "Spatiotemporal cortical blood-flow net", datasetRef: "Contrast MRI perfusion curves", metrics: { Concordance: "0.89" }, lastTrained: null, artifactPath: null, markerType: "localized" },
    ],
    service: "renal",
  },
  liver: {
    id: "liver",
    displayName: "Hepatic Twin",
    shortName: "Liver",
    bodySystem: "hepatic",
    accent: "#f97316",
    glb: { high: "/Liver.glb", medium: "/Liver.glb", low: null },
    anchors: [
      { name: "Portal vein", position: [0.25, 0.15, 0.64] },
      { name: "Biliary tree", position: [-0.28, -0.05, 0.56] },
      { name: "Hepatic lobules", position: [0.45, -0.18, 0.44] },
      { name: "Fibrosis band", position: [-0.46, 0.22, 0.42] },
    ],
    signalPanels: ["AST", "ALT"],
    models: [
      { id: "hepatic-fibrosis", name: "Fibrosis Scorer", status: "trained", task: "regression", architecture: "Multimodal CNN elastography stiffness quantifier", datasetRef: "MRE + liver panel fusion", metrics: { "Stage accuracy": "92%" }, lastTrained: "2026-08-13", artifactPath: null, markerType: "organ_level" },
      { id: "hepatic-steatosis", name: "Steatosis Quantifier", status: "scaffold", task: "regression", architecture: "Fat-water MRI fat fraction network", datasetRef: "PDFF MRI maps", metrics: { "MAE target": "2.1%" }, lastTrained: null, artifactPath: null, markerType: "organ_level" },
      { id: "hepatic-hcc", name: "HCC Detector", status: "scaffold", task: "segmentation", architecture: "3D Mask R-CNN lesion classifier", datasetRef: "Multiphasic CT lesion masks", metrics: { "Dice target": "0.88" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "hepatic-portal", name: "Portal Flow Sim", status: "scaffold", task: "forecast", architecture: "Physics-GNN venous pressure simulator", datasetRef: "Doppler waveform + portal mesh", metrics: { "Flow error": "7.9%" }, lastTrained: null, artifactPath: null, markerType: "localized" },
    ],
    service: "hepatic",
  },
  pancreas: {
    id: "pancreas",
    displayName: "Pancreatic Twin",
    shortName: "Pancreas",
    bodySystem: "endocrine",
    accent: "#f59e0b",
    glb: { high: null, medium: null, low: null },
    anchors: [
      { name: "Pancreatic duct", position: [0.18, 0.02, 0.62] },
      { name: "Islet clusters", position: [-0.36, 0.18, 0.54] },
      { name: "Acinar tissue", position: [0.44, -0.18, 0.48] },
      { name: "Duodenal interface", position: [-0.08, -0.48, 0.42] },
    ],
    signalPanels: ["Insulin", "Glucose"],
    models: [
      { id: "pancreas-islet", name: "Islet Mass Estimator", status: "scaffold", task: "regression", architecture: "Probabilistic CNN beta-cell volume model", datasetRef: "Pancreas MRI + endocrine labs", metrics: { "MAE target": "8.2%" }, lastTrained: null, artifactPath: null, markerType: "organ_level" },
      { id: "pancreas-glycemic", name: "Glycemic Forecaster", status: "trained", task: "forecast", architecture: "Transformer continuous-glucose forecaster", datasetRef: "CGM + insulin/glucose labs", metrics: { "MAPE": "9.1%" }, lastTrained: "2026-08-13", artifactPath: null, markerType: "organ_level" },
      { id: "pancreas-risk", name: "Pancreatitis Risk", status: "scaffold", task: "classification", architecture: "Ensemble tree inflammation scorer", datasetRef: "Amylase/lipase + CT findings", metrics: { "ROC-AUC target": "0.93" }, lastTrained: null, artifactPath: null, markerType: "localized" },
      { id: "pancreas-duct", name: "Ductal Segmenter", status: "scaffold", task: "segmentation", architecture: "U-Net main pancreatic duct mapper", datasetRef: "MRCP duct labels", metrics: { "Dice target": "0.95" }, lastTrained: null, artifactPath: null, markerType: "localized" },
    ],
    service: "endocrine",
  },
  nervous: {
    id: "nervous",
    displayName: "Nervous System Twin",
    shortName: "Nervous system",
    bodySystem: "nervous",
    accent: "#c084fc",
    glb: { high: null, medium: null, low: null },
    anchors: [],
    signalPanels: ["EEG"],
    models: [placeholderModel("nervous-placeholder", "Neuro-signal detector")],
    service: "neuro-signal",
  },
} satisfies Record<string, TwinSchema>

export type OrganId = keyof typeof ORGAN_REGISTRY

export function getDefaultModel(organId: OrganId) {
  return ORGAN_REGISTRY[organId].models[0]
}

export function getModel(organId: OrganId, modelId: string) {
  return (
    ORGAN_REGISTRY[organId].models.find((model) => model.id === modelId) ??
    getDefaultModel(organId)
  )
}
