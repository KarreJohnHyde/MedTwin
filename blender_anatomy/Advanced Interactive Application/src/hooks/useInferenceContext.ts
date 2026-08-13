import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  makeSyntheticInference,
  type InferenceResult,
} from "../lib/clinicalData"
import type { OrganId } from "../lib/twins"

type RequestState = "idle" | "loading" | "success" | "error"

interface UseInferenceContextArgs {
  patientId: string
  organId: OrganId
  modelId: string
}

const API_ROOT = import.meta.env.VITE_MEDTWIN_API_URL ?? "http://localhost:8001"

export default function useInferenceContext({
  patientId,
  organId,
  modelId,
}: UseInferenceContextArgs) {
  const contextKey = `${patientId}:${organId}:${modelId}`
  const [resultsByContext, setResultsByContext] =
    useState<Record<string, InferenceResult>>({})
  const [statusByContext, setStatusByContext] =
    useState<Record<string, RequestState>>({})
  const [errorByContext, setErrorByContext] = useState<Record<string, string>>(
    {},
  )
  const controllerRef = useRef<AbortController | null>(null)
  const activeKeyRef = useRef(contextKey)

  useEffect(() => {
    activeKeyRef.current = contextKey
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [contextKey])

  useEffect(() => () => controllerRef.current?.abort(), [])

  const runInference = useCallback(async () => {
    if (statusByContext[contextKey] === "loading") return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setStatusByContext((current) => ({ ...current, [contextKey]: "loading" }))
    setErrorByContext((current) => {
      const next = { ...current }
      delete next[contextKey]
      return next
    })

    try {
      const response = await fetch(`${API_ROOT}/api/v1/inference/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          organ: organId,
          model_id: modelId,
        }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`E_INF_${response.status}`)
      const payload = (await response.json()) as InferenceResult
      if (
        payload.context_key !== contextKey ||
        activeKeyRef.current !== contextKey
      )
        return
      setResultsByContext((current) => ({ ...current, [contextKey]: payload }))
      setStatusByContext((current) => ({ ...current, [contextKey]: "success" }))
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      if (activeKeyRef.current !== contextKey) return

      // The browser prototype remains fully demonstrable without a running Python process.
      // The fallback is explicit synthetic data and never masquerades as a clinical result.
      const fallback = makeSyntheticInference(patientId, organId, modelId)
      setResultsByContext((current) => ({ ...current, [contextKey]: fallback }))
      setStatusByContext((current) => ({ ...current, [contextKey]: "success" }))
      setErrorByContext((current) => ({
        ...current,
        [contextKey]:
          "Backend unavailable; showing labeled synthetic prototype output.",
      }))
    }
  }, [contextKey, modelId, organId, patientId, statusByContext])

  return useMemo(
    () => ({
      contextKey,
      result: resultsByContext[contextKey] ?? null,
      status: statusByContext[contextKey] ?? "idle",
      error: errorByContext[contextKey] ?? null,
      runInference,
    }),
    [
      contextKey,
      errorByContext,
      resultsByContext,
      runInference,
      statusByContext,
    ],
  )
}
