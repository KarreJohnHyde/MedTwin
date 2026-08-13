export type Modality = "xray" | "ct" | "mri" | "dermoscopic" | null;

export interface InferenceInputs {
  report_text: string | null;
  labs: Record<string, string | number>;
  ecg_signal: string | null;
  image: string | null;
  image_modality: Modality;
}

export interface FusionInferRequest {
  patient_id: string;
  inputs: InferenceInputs;
}

export type SystemType = "cardiovascular" | "pulmonary" | "neurological" | "oncologic" | "other";
export type SeverityBand = "none" | "low" | "moderate" | "high" | "critical";
export type ConcordanceType = "CONCORDANT" | "DISCORDANT" | "PARTIAL";

export interface Finding {
  finding: string;
  system: SystemType;
  severity_band: SeverityBand;
  confidence: number;
  source_models: string[];
  evidence: string;
}

export interface ForecastPoint {
  day: number;
  severity_band: SeverityBand;
  confidence: number;
}

export interface FusionInferResponse {
  findings: Finding[];
  concordance: ConcordanceType;
  fusion_confidence: number;
  risk_index: number;
  forecast: ForecastPoint[];
  model_versions: Record<string, string>;
}
