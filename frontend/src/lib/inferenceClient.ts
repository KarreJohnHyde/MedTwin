import type { TwinCategory } from "./twins"

export interface TwinInferenceResult {
  source: "api" | "local-demo"
  model: string
  summary: string
  confidence: number | null
  elapsedMs: number
}

const CATEGORY_MODEL: Record<TwinCategory, string> = {
  cardio: "ecg-lstm",
  neuro: "vision-rcnn",
  pulmo: "pneumonia",
}

const LOCAL_SUMMARIES: Record<TwinCategory, string> = {
  cardio: "Synthetic ECG cycle processed",
  neuro: "Synthetic connectivity graph refreshed",
  pulmo: "Synthetic spirometry pattern refreshed",
}

function apiBaseUrl() {
  const configured = import.meta.env.VITE_MEDTWIN_API_URL
  return configured === undefined ? undefined : configured.trim().replace(/\/$/, "")
}

export async function runTwinInference(category: TwinCategory): Promise<TwinInferenceResult> {
  const startedAt = performance.now()
  const model = CATEGORY_MODEL[category]
  const baseUrl = apiBaseUrl()

  if (baseUrl === undefined) {
    await new Promise((resolve) => window.setTimeout(resolve, 550))
    return {
      source: "local-demo",
      model,
      summary: LOCAL_SUMMARIES[category],
      confidence: null,
      elapsedMs: Math.round(performance.now() - startedAt),
    }
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(`${baseUrl}/api/v1/inference/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        patient_id: `twin-${category}-workspace`,
        model,
        payload: {},
      }),
    })
    if (!response.ok) throw new Error(`Inference request failed (${response.status})`)
    const data: unknown = await response.json()
    if (!data || typeof data !== "object") throw new Error("Inference response was not valid JSON")
    const result = data as { model_name?: unknown; summary?: unknown; confidence?: unknown }
    return {
      source: "api",
      model: typeof result.model_name === "string" ? result.model_name : model,
      summary: typeof result.summary === "string" ? result.summary : "Inference completed",
      confidence: typeof result.confidence === "number" && Number.isFinite(result.confidence) ? result.confidence : null,
      elapsedMs: Math.round(performance.now() - startedAt),
    }
  } finally {
    window.clearTimeout(timeout)
  }
}
