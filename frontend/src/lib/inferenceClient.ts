import type { AnatomyId } from "./twins"
import type { VolumeSummary } from "./volumeLoader"

export interface ModelResult {
  name: string
  family: string
  version: string
  artifact_status: string
  dataset_contract: string
  intended_use: string
  output_contract: string
  approval: string
  weight: number
  probability: number
  contribution: number
  auc_roc: number
  pr_auc: number
  sensitivity: number
  specificity: number
  f1: number
  brier_score: number
  calibration_slope: number
  calibration_intercept: number
  ood_score: number
  latency_ms: number
  status: "contributing" | "below-threshold"
}

export interface SpatialMarker {
  id: string
  label: string
  probability: number
  confidence: number
  coordinate: [number, number, number]
  visible: boolean
}

export interface ForecastPoint {
  day: number
  expected: number
  lower: number
  upper: number
  spread: number
}

export interface FusionResult {
  status: "complete"
  mode: "synthetic-research-simulation"
  anatomy: AnatomyId
  threshold: number
  fusion: {
    probability: number
    decision: "review" | "monitor"
    entropy: number
    disagreement: number
    calibration_error: number
    auc_roc: number
  }
  models: ModelResult[]
  markers: SpatialMarker[]
  forecast: ForecastPoint[]
  validation: {
    metric_scope: string
    sample_size: number
    prevalence: number
    operating_threshold: number
    calibration: Array<{ predicted: number; observed: number }>
    precision_recall: Array<{ recall: number; precision: number }>
    decision_curve: Array<{
      threshold: number
      model: number
      treat_all: number
      treat_none: number
    }>
    subgroups: Array<{
      name: string
      n: number
      auc: number
      lower: number
      upper: number
    }>
    drift: Array<{ window: string; psi: number; ood_rate: number }>
    approval_history: Array<{
      version: string
      status: string
      date: string
    }>
  }
  constraints: string[]
  audit: {
    engine: string
    model_count: number
    forecast_method: string
    roi_method: string
    identity_fields_processed: number
    volume_context_used?: boolean
  }
  source?: "gateway" | "local-preview"
}

const LABELS: Record<AnatomyId, string> = {
  heart: "Myocardial perfusion irregularity",
  brain: "Focal tissue alteration",
  nervous: "Conduction discontinuity pattern",
  skeletal: "Cortical stress response",
  lungs: "Inflammatory opacity pattern",
  renal: "Parenchymal perfusion change",
  digestive: "Localized tissue thickening",
}

const FAMILIES = ["Transformer", "BiLSTM", "Faster R-CNN", "3D U-Net", "ARIMA"]

export function localPreview(
  anatomy: AnatomyId,
  threshold: number,
  horizon: number,
): FusionResult {
  const anatomyOffset =
    anatomy.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9
  const probability = 0.682 + anatomyOffset / 500
  const models: ModelResult[] = FAMILIES.map((family, index) => {
    const modelProbability = probability + 0.055 - index * 0.028
    const auc = 0.944 - index * 0.014
    return {
      name: `${anatomy.slice(0, 1).toUpperCase()}${anatomy.slice(1)} ${family}`,
      family,
      version: `1.${index}.0`,
      artifact_status: "simulation-contract",
      dataset_contract: "Synthetic multimodal research contract",
      intended_use: "Research pattern simulation",
      output_contract: index === 2 ? "ROI anchors + probability" : "calibrated probability",
      approval: "research-only",
      weight: [0.27, 0.23, 0.2, 0.18, 0.12][index],
      probability: modelProbability,
      contribution: modelProbability * [0.27, 0.23, 0.2, 0.18, 0.12][index],
      auc_roc: auc,
      pr_auc: auc - 0.032,
      sensitivity: auc - 0.036,
      specificity: auc - 0.029,
      f1: auc - 0.034,
      brier_score: 0.081 + index * 0.004,
      calibration_slope: 0.99 - index * 0.012,
      calibration_intercept: -0.012 + index * 0.006,
      ood_score: 0.071 + index * 0.009,
      latency_ms: [39, 22, 53, 58, 9][index],
      status:
        modelProbability >= threshold ? "contributing" : "below-threshold",
    }
  })
  const forecast: ForecastPoint[] = Array.from(
    { length: horizon + 1 },
    (_, day) => {
      const expected = Math.min(
        0.92,
        probability + day * 0.011 + Math.sin(day / 2) * 0.012,
      )
      const uncertainty = 0.025 + day * 0.006
      return {
        day,
        expected,
        lower: Math.max(0, expected - uncertainty),
        upper: Math.min(1, expected + uncertainty),
        spread: Math.min(1, 0.18 + day * 0.035),
      }
    },
  )
  const calibration = Array.from({ length: 11 }, (_, index) => ({
    predicted: index / 10,
    observed: Math.max(0, Math.min(1, index / 10 * 0.94 + 0.025)),
  }))
  const precisionRecall = Array.from({ length: 11 }, (_, index) => ({
    recall: index / 10,
    precision: Math.max(0, 0.96 - index * 0.028),
  }))
  const decisionCurve = Array.from({ length: 11 }, (_, index) => {
    const operatingThreshold = 0.05 + index * 0.085
    return {
      threshold: operatingThreshold,
      model: probability * (1 - operatingThreshold) - 0.04,
      treat_all: 0.46 - operatingThreshold * 0.62,
      treat_none: 0,
    }
  })
  return {
    status: "complete",
    mode: "synthetic-research-simulation",
    anatomy,
    threshold,
    fusion: {
      probability,
      decision: probability >= threshold ? "review" : "monitor",
      entropy: 0.902,
      disagreement: 0.142,
      calibration_error: 0.034,
      auc_roc: 0.923,
    },
    models,
    markers: [
      {
        id: "roi-1",
        label: LABELS[anatomy],
        probability,
        confidence: 0.89,
        coordinate: [0.22, 0.18, 0.16],
        visible: probability >= threshold,
      },
      {
        id: "roi-2",
        label: "Adjacent ROI 2",
        probability: probability - 0.11,
        confidence: 0.82,
        coordinate: [-0.13, -0.08, 0.2],
        visible: probability - 0.11 >= threshold,
      },
      {
        id: "roi-3",
        label: "Adjacent ROI 3",
        probability: probability - 0.2,
        confidence: 0.76,
        coordinate: [0.05, -0.24, -0.12],
        visible: probability - 0.2 >= threshold,
      },
    ],
    forecast,
    validation: {
      metric_scope: "synthetic validation cohort",
      sample_size: 640,
      prevalence: probability * 0.42,
      operating_threshold: threshold,
      calibration,
      precision_recall: precisionRecall,
      decision_curve: decisionCurve,
      subgroups: ["Acquisition A", "Acquisition B", "Protocol T1", "Protocol T2"].map(
        (name, index) => ({
          name,
          n: 128 + index * 32,
          auc: 0.922 - index * 0.006,
          lower: 0.877 - index * 0.006,
          upper: 0.961 - index * 0.006,
        }),
      ),
      drift: Array.from({ length: 12 }, (_, index) => ({
        window: `W${index + 1}`,
        psi: 0.035 + index * 0.004 + Math.sin(index) * 0.006,
        ood_rate: 0.021 + index * 0.002,
      })),
      approval_history: [
        { version: "0.8.0", status: "archived", date: "2026-02-18" },
        { version: "0.9.0", status: "research-review", date: "2026-05-03" },
        { version: "1.0.0", status: "research-only", date: "2026-08-01" },
      ],
    },
    constraints: [
      "Synthetic inputs only; no identity-bearing data are accepted or stored.",
      "Spatial points are visualization anchors, not validated lesion localization.",
      "Forecast uncertainty expands with horizon and requires source evidence.",
      "Outputs are research decision-support simulations, not diagnoses.",
    ],
    audit: {
      engine: "browser-preview-fusion-v1",
      model_count: models.length,
      forecast_method: "ARIMA + temporal LSTM simulation",
      roi_method: "R-CNN / U-Net visualization contract",
      identity_fields_processed: 0,
      volume_context_used: false,
    },
    source: "local-preview",
  }
}

export async function runFusion(
  anatomy: AnatomyId,
  threshold: number,
  horizon = 12,
  volume?: VolumeSummary,
): Promise<FusionResult> {
  const configured = import.meta.env.VITE_MEDTWIN_GATEWAY_URL?.trim().replace(
    /\/$/,
    "",
  )
  const baseUrl = configured || "http://localhost:8787"
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 4_000)
  try {
    const response = await fetch(`${baseUrl}/api/inference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        anatomy,
        threshold,
        horizon,
        seed: 24,
        ...(volume ? { volume_summary: volume } : {}),
      }),
    })
    if (!response.ok) throw new Error(`Gateway returned ${response.status}`)
    const data = (await response.json()) as FusionResult
    return { ...data, source: "gateway" }
  } catch {
    return localPreview(anatomy, threshold, horizon)
  } finally {
    window.clearTimeout(timeout)
  }
}

export function initialFusion(
  anatomy: AnatomyId,
  threshold: number,
): FusionResult {
  return localPreview(anatomy, threshold, 12)
}
