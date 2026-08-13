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
      high: "/assets/Heart.glb",
      medium: "/assets/Heart_anotomy.glb",
      low: null,
    },
    anchors: [],
    signalPanels: ["ECG", "BloodPressure", "SpO2"],
    models: [
      {
        id: "cardio-xgb",
        name: "Cardio XGBoost",
        status: "trained",
        task: "classification",
        architecture: "XGBoost + BiLSTM Attention",
        datasetRef: "Versioned heart tabular + synthetic telemetry demo",
        metrics: { Accuracy: "94.2%", "ROC-AUC": "0.94" },
        lastTrained: "2026-07-18",
        artifactPath: "MedTwin/artifacts/xgb_heart_model.pkl",
        markerType: "organ_level",
      },
      {
        id: "cardio-resnet",
        name: "Cardio ResNet-50",
        status: "scaffold",
        task: "classification",
        architecture: "Deep residual CNN",
        datasetRef: "Demo imaging adapter",
        metrics: {},
        lastTrained: null,
        artifactPath: null,
        markerType: "organ_level",
      },
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
    anchors: [],
    signalPanels: ["EEG", "ICP"],
    models: [
      {
        id: "neuro-resnet",
        name: "Neuro ResNet-50",
        status: "trained",
        task: "classification",
        architecture: "PyTorch CNN · ResNet-50",
        datasetRef: "Brain MRI presence labels; no boxes or masks",
        metrics: { "F1 Score": "0.89", "ROC-AUC": "0.92" },
        lastTrained: "2026-07-11",
        artifactPath: "MedTwin/artifacts/brain_tumor_cnn.pt",
        markerType: "organ_level",
      },
      {
        id: "neuro-transformer",
        name: "Neuro Transformer v4",
        status: "scaffold",
        task: "classification",
        architecture: "Vision Transformer + attention",
        datasetRef: "Research scaffold",
        metrics: {},
        lastTrained: null,
        artifactPath: null,
        markerType: "organ_level",
      },
      {
        id: "neuro-dcgan",
        name: "Brain MRI DCGAN",
        status: "trained",
        task: "none",
        architecture: "Deep Convolutional GAN",
        datasetRef: "Synthetic MRI Generation",
        metrics: { "Generator Loss": "7.75", "Discriminator Loss": "1.41" },
        lastTrained: "2026-08-13",
        artifactPath: "MedTwin/artifacts/brain_dcgan_gen.pt",
        markerType: "organ_level",
      },
    ],
    service: "neuro",
  },
  lungs: {
    id: "lungs",
    displayName: "Pulmo Twin",
    shortName: "Lungs",
    bodySystem: "respiratory",
    accent: "#38bdf8",
    glb: { high: "/assets/Lungs.glb", medium: "/assets/Lungs.glb", low: null },
    anchors: [],
    signalPanels: ["RespiratoryRate", "TidalVolume", "SpO2"],
    models: [
      {
        id: "pulmo-densenet",
        name: "Pulmo DenseNet-121",
        status: "trained",
        task: "classification",
        architecture: "DenseNet-121 X-ray classifier",
        datasetRef: "Chest X-ray presence labels; no boxes",
        metrics: { "F1 Score": "0.92", "ROC-AUC": "0.95" },
        lastTrained: "2026-07-02",
        artifactPath: "MedTwin/artifacts/pneumonia_densenet.pt",
        markerType: "organ_level",
      },
      {
        id: "pulmo-pneumonia-cnn",
        name: "Pneumonia CNN",
        status: "trained",
        task: "classification",
        architecture: "PyTorch ResNet-lite",
        datasetRef: "Synthetic Pneumonia Radiographs",
        metrics: { "Accuracy": "0.60" },
        lastTrained: "2026-08-13",
        artifactPath: "MedTwin/artifacts/pneumonia_cnn.pt",
        markerType: "organ_level",
      },
      {
        id: "pulmo-cancer-xgb",
        name: "Lung Cancer XGBoost",
        status: "trained",
        task: "classification",
        architecture: "XGBoost Classifier",
        datasetRef: "Synthetic Demographic & Lifestyle Features",
        metrics: { "Accuracy": "0.90", "ROC-AUC": "0.97" },
        lastTrained: "2026-08-13",
        artifactPath: "MedTwin/artifacts/lung_cancer_xgb.joblib",
        markerType: "organ_level",
      },
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
    anchors: [],
    signalPanels: ["Motility"],
    models: [
      {
        id: "gastro-unet",
        name: "Gastro 3D U-Net",
        status: "scaffold",
        task: "segmentation",
        architecture: "PyTorch 2.5D / 3D U-Net",
        datasetRef: "UWMGI masks · training pipeline present",
        metrics: { "Dice (prototype)": "0.58" },
        lastTrained: null,
        artifactPath: null,
        markerType: "localized",
      },
    ],
    service: "gastro",
  },
  skeleton: {
    id: "skeleton",
    displayName: "Skeletal Twin",
    shortName: "Skeleton",
    bodySystem: "skeletal",
    accent: "#fbbf24",
    glb: { high: "/assets/Skeleton.glb", medium: "/assets/Skeleton.glb", low: null },
    anchors: [],
    signalPanels: ["BoneDensity"],
    models: [
      {
        id: "skeletal-bmd",
        name: "Skeletal BMD Ensemble",
        status: "scaffold",
        task: "regression",
        architecture: "DenseNet + virtual 3D QCT regression",
        datasetRef: "Synthetic BMD demo; MURA classifier scaffold",
        metrics: { "Accuracy (prototype)": "91.2%", "BMD MAE": "0.04 g/cm²" },
        lastTrained: null,
        artifactPath: null,
        markerType: "organ_level",
      },
    ],
    service: "ortho",
  },
  kidneys: {
    id: "kidneys",
    displayName: "Renal Twin",
    shortName: "Kidneys",
    bodySystem: "urinary",
    accent: "#fb7185",
    glb: { high: "/assets/Kidney.glb", medium: "/assets/Kidney.glb", low: null },
    anchors: [],
    signalPanels: ["GFR", "Creatinine"],
    models: [placeholderModel("renal-placeholder", "Renal model")],
    service: "renal",
  },
  liver: {
    id: "liver",
    displayName: "Hepatic Twin",
    shortName: "Liver",
    bodySystem: "hepatic",
    accent: "#f97316",
    glb: { high: "/assets/Liver.glb", medium: "/assets/Liver.glb", low: null },
    anchors: [],
    signalPanels: ["AST", "ALT"],
    models: [placeholderModel("hepatic-placeholder", "Hepatic model")],
    service: "hepatic",
  },
  pancreas: {
    id: "pancreas",
    displayName: "Pancreatic Twin",
    shortName: "Pancreas",
    bodySystem: "endocrine",
    accent: "#f59e0b",
    glb: { high: null, medium: null, low: null },
    anchors: [],
    signalPanels: ["Insulin", "Glucose"],
    models: [placeholderModel("pancreas-placeholder", "Pancreatic model")],
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
