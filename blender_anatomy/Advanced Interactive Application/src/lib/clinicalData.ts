import type { MarkerType, OrganId } from "./twins"

export interface Patient {
  id: string
  name: string
  age: number
  sex: "F" | "M"
  mrn: string
}

export interface PrimaryMetric {
  label: string
  value: string
  state: "normal" | "watch" | "alert"
}

export interface Attribution {
  label: string
  weight: number
}

export interface BmdResult {
  absoluteBmd: number
  tScore: number
  classification: "Normal" | "Osteopenia" | "Osteoporosis"
  corticalThickness: number
  trabecularIndex: number
  referenceMean: number
  referenceSd: number
}

export interface InferenceResult {
  patient_id: string
  organ: OrganId
  model_id: string
  context_key: string
  marker_type: MarkerType
  inference_id: string
  created_at: string
  synthetic: boolean
  result: {
    finding: string
    confidence: number
    detail: string
    anchor_region_or_coords?: string | [number, number, number]
  }
  fusion: {
    risk: number
    concordance: number
    certainty: number
    attributions: Attribution[]
  }
  bmd?: BmdResult
}

export const PATIENTS: Patient[] = [
  { id: "P-1048", name: "James Dalton", age: 55, sex: "M", mrn: "MT-1048" },
  { id: "P-1182", name: "Sarah Chen", age: 62, sex: "F", mrn: "MT-1182" },
  { id: "P-1216", name: "Robert Walsh", age: 47, sex: "M", mrn: "MT-1216" },
]

export const ORGAN_METRICS: Record<OrganId, PrimaryMetric[]> = {
  heart: [
    { label: "LVEF", value: "63%", state: "normal" },
    { label: "Stroke volume", value: "68 mL/beat", state: "normal" },
    { label: "QRS width", value: "91 ms", state: "normal" },
    { label: "Cardiac output", value: "5.1 L/min", state: "normal" },
  ],
  brain: [
    { label: "ICP", value: "13.4 mmHg", state: "normal" },
    { label: "O₂ extraction", value: "34.0%", state: "normal" },
    { label: "Alpha power", value: "8.3 μV²", state: "normal" },
    { label: "Cortical spikes", value: "4 / hr", state: "watch" },
  ],
  lungs: [
    { label: "SpO₂", value: "97.4%", state: "normal" },
    { label: "Tidal volume", value: "508 mL", state: "normal" },
    { label: "Resp. rate", value: "16 / min", state: "normal" },
    { label: "FEV₁ est.", value: "3.1 L", state: "normal" },
  ],
  intestine: [
    { label: "Dice overlap", value: "0.58", state: "watch" },
    { label: "Motility index", value: "18.6", state: "normal" },
    { label: "Mask volume", value: "42.8 cm³", state: "watch" },
    { label: "Signal quality", value: "81%", state: "normal" },
  ],
  skeleton: [
    { label: "Absolute BMD", value: "0.874 g/cm²", state: "watch" },
    { label: "T-score", value: "−1.6 SD", state: "watch" },
    { label: "Cortical rim", value: "2.42 mm", state: "normal" },
    { label: "Trabecular index", value: "0.286", state: "watch" },
  ],
  kidneys: [
    { label: "eGFR", value: "95 mL/min", state: "normal" },
    { label: "Creatinine", value: "0.9 mg/dL", state: "normal" },
    { label: "Model output", value: "Not trained", state: "watch" },
    { label: "Data source", value: "Synthetic trace", state: "watch" },
  ],
  liver: [
    { label: "AST", value: "22 U/L", state: "normal" },
    { label: "ALT", value: "28 U/L", state: "normal" },
    { label: "Model output", value: "Not trained", state: "watch" },
    { label: "Data source", value: "Synthetic trace", state: "watch" },
  ],
  pancreas: [
    { label: "Glucose", value: "95 mg/dL", state: "normal" },
    { label: "Insulin", value: "10 μU/mL", state: "normal" },
    { label: "Model output", value: "Not trained", state: "watch" },
    { label: "Data source", value: "Synthetic trace", state: "watch" },
  ],
  nervous: [
    { label: "Alpha power", value: "8.1 μV²", state: "normal" },
    { label: "Signal quality", value: "93%", state: "normal" },
    { label: "Model output", value: "Not trained", state: "watch" },
    { label: "Panel", value: "Waveform only", state: "watch" },
  ],
}

const ATTRIBUTIONS: Record<OrganId, Attribution[]> = {
  heart: [
    { label: "Septal thickness", weight: 88 },
    { label: "Wall motion", weight: 74 },
    { label: "LV volume", weight: 61 },
    { label: "Ejection fraction", weight: 55 },
  ],
  brain: [
    { label: "Cortical thickness", weight: 91 },
    { label: "White matter", weight: 82 },
    { label: "Ventricular volume", weight: 68 },
    { label: "Lesion segmentation", weight: 57 },
  ],
  lungs: [
    { label: "Parenchymal texture", weight: 86 },
    { label: "Opacity distribution", weight: 73 },
    { label: "Pleural boundary", weight: 62 },
    { label: "Oxygen saturation", weight: 48 },
  ],
  intestine: [
    { label: "Mask overlap", weight: 82 },
    { label: "Wall enhancement", weight: 71 },
    { label: "Bowel volume", weight: 60 },
    { label: "Motility", weight: 44 },
  ],
  skeleton: [
    { label: "Trabecular structure", weight: 89 },
    { label: "Cortical thickness", weight: 81 },
    { label: "Density oscillation", weight: 67 },
    { label: "Patient demographics", weight: 43 },
  ],
  kidneys: [],
  liver: [],
  pancreas: [],
  nervous: [],
}

const FINDINGS: Record<OrganId, {
  finding: string
  detail: string
  confidence: number
}> = {
  heart: {
    finding: "Elevated cardiovascular risk pattern",
    detail:
      "Organ-level classification driven by septal thickness and wall-motion features. No spatial claim is made.",
    confidence: 0.94,
  },
  brain: {
    finding: "No tumor-positive image pattern",
    detail:
      "MRI presence classifier output. This model has no boxes or masks and therefore cannot localize a finding.",
    confidence: 0.89,
  },
  lungs: {
    finding: "No pneumonia-positive image pattern",
    detail:
      "Chest X-ray presence classifier output. The result is restricted to the pulmonary context.",
    confidence: 0.92,
  },
  intestine: {
    finding: "Segmentation scaffold requires a versioned artifact",
    detail:
      "The U-Net training pipeline exists, but a validated held-out artifact is not configured for this demo.",
    confidence: 0,
  },
  skeleton: {
    finding: "Opportunistic BMD pattern: osteopenic range",
    detail:
      "Synthetic four-stage pipeline: segmentation, structural feature extraction, absolute BMD regression, then normative T-score conversion.",
    confidence: 0.91,
  },
  kidneys: {
    finding: "Not yet trained",
    detail:
      "Renal signals are available, but no diagnostic model or annotated dataset is configured.",
    confidence: 0,
  },
  liver: {
    finding: "Not yet trained",
    detail:
      "Hepatic signals are available, but no diagnostic model or annotated dataset is configured.",
    confidence: 0,
  },
  pancreas: {
    finding: "Not yet trained",
    detail:
      "Pancreatic signals are available, but no diagnostic model or annotated dataset is configured.",
    confidence: 0,
  },
  nervous: {
    finding: "Waveform panel only",
    detail:
      "EEG visualization is available; a diagnostic detector is not trained.",
    confidence: 0,
  },
}

export function makeSyntheticInference(
  patientId: string,
  organ: OrganId,
  modelId: string,
): InferenceResult {
  const contextKey = `${patientId}:${organ}:${modelId}`
  const finding = FINDINGS[organ]
  const baseRisk =
    organ === "heart"
      ? 0.72
      : organ === "skeleton"
        ? 0.46
        : organ === "brain"
          ? 0.23
          : 0.18
  return {
    patient_id: patientId,
    organ,
    model_id: modelId,
    context_key: contextKey,
    marker_type:
      organ === "intestine"
        ? "localized"
        : finding.confidence > 0
          ? "organ_level"
          : "none",
    inference_id: `demo-${organ}-${Date.now()}`,
    created_at: new Date().toISOString(),
    synthetic: true,
    result: {
      finding: finding.finding,
      confidence: finding.confidence,
      detail: finding.detail,
      anchor_region_or_coords:
        organ === "intestine" ? "mask-centroid-unavailable" : undefined,
    },
    fusion: {
      risk: baseRisk,
      concordance: organ === "heart" ? 0.92 : 0.86,
      certainty: organ === "heart" ? 0.89 : 0.82,
      attributions: ATTRIBUTIONS[organ],
    },
    bmd:
      organ === "skeleton"
        ? {
            absoluteBmd: 0.874,
            tScore: -1.6,
            classification: "Osteopenia",
            corticalThickness: 2.42,
            trabecularIndex: 0.286,
            referenceMean: 1.05,
            referenceSd: 0.11,
          }
        : undefined,
  }
}

export const FORECAST_POINTS = [
  { day: 0, observed: 8, projected: 8, low: 8, high: 8 },
  { day: 2, observed: 14, projected: 14, low: 12, high: 16 },
  { day: 4, observed: null, projected: 25, low: 20, high: 31 },
  { day: 6, observed: null, projected: 42, low: 33, high: 51 },
  { day: 8, observed: null, projected: 58, low: 46, high: 69 },
  { day: 10, observed: null, projected: 73, low: 59, high: 85 },
  { day: 12, observed: null, projected: 86, low: 68, high: 95 },
  { day: 14, observed: null, projected: 97, low: 76, high: 100 },
]
