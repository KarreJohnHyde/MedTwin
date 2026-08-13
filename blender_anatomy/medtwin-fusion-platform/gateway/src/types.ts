// Canonical types mirroring section 8 of multimodal-fusion-deployment-prompt.md.
// Keep services/pulmonary/schemas.py and services/fusion/schemas.py in sync with
// this file by hand until a codegen step is added — flagged in README.md.

export type ImageModality = 'xray' | 'ct' | 'mri' | 'dermoscopic' | null;

export interface FusionInferRequest {
  patient_id: string;
  inputs: {
    report_text?: string | null;
    labs?: Record<string, number | string> | null;
    ecg_signal?: string | null; // base64
    image?: string | null; // base64
    image_modality?: ImageModality;
  };
}

export type SeverityBand = 'none' | 'low' | 'moderate' | 'high' | 'critical';
export type BodySystem = 'cardiovascular' | 'pulmonary' | 'neurological' | 'oncologic' | 'other';
export type Concordance = 'CONCORDANT' | 'DISCORDANT' | 'PARTIAL';

export interface StandardizedFinding {
  finding: string;
  system: BodySystem;
  severity_band: SeverityBand;
  confidence: number; // 0-1
  source_models: string[];
  evidence: string;
}

export interface ForecastPoint {
  day: number;
  severity_band: SeverityBand;
  confidence: number;
}

export interface FusionInferResponse {
  findings: StandardizedFinding[];
  concordance: Concordance;
  fusion_confidence: number;
  risk_index: number;
  forecast: ForecastPoint[];
  model_versions: Record<string, string>;
}

// Raw per-domain-model contract (section 2), used on the gateway <-> domain
// service <-> fusion service leg only — never returned to the dashboard directly.
export interface DomainModelResult {
  model_id: string;
  status: 'ok' | 'invalid_input' | 'timeout' | 'error';
  label?: string | null;
  confidence?: number | null;
  raw_scores?: Record<string, number> | null;
  model_version?: string | null;
  is_mock?: boolean; // MUST be true for any stubbed model — never omit in Phase 0/1
}
