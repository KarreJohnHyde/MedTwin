import { useState } from "react"
import {
  AlertTriangle,
  Bone,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDot,
  FlaskConical,
  ShieldCheck,
} from "lucide-react"
import type { InferenceResult } from "../lib/clinicalData"
import { ORGAN_METRICS } from "../lib/clinicalData"
import { ORGAN_REGISTRY, type OrganId } from "../lib/twins"

interface ContextPanelProps {
  organId: OrganId
  modelId: string
  result: InferenceResult | null
  status: "idle" | "loading" | "success" | "error"
  error: string | null
  onRun: () => void
}

function ScoreRing({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color: string
}) {
  const radius = 23
  const circumference = 2 * Math.PI * radius
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 56 56"
        className="h-14 w-14"
        role="img"
        aria-label={`${label}: ${value}%`}
      >
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,.1)"
          strokeWidth="3.5"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          transform="rotate(-90 28 28)"
        />
        <text
          x="28"
          y="31"
          textAnchor="middle"
          fill={color}
          className="text-[9px] font-semibold"
        >
          {value}%
        </text>
      </svg>
      <span className="mt-1 text-[8px] uppercase tracking-[0.15em] text-slate-600">
        {label}
      </span>
    </div>
  )
}

function EmptyInference({
  status,
  onRun,
  trained,
}: {
  status: ContextPanelProps["status"]
  onRun: () => void
  trained: boolean
}) {
  if (!trained) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-950/40 p-4 text-center">
        <CircleDot className="mx-auto mb-2 text-slate-600" size={20} />
        <div className="text-[11px] font-medium text-slate-300">
          No trained diagnostic model
        </div>
        <div className="mt-1 text-[9px] leading-relaxed text-slate-600">
          Signals and 3D anatomy remain available without fabricated model
          output.
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-dashed border-cyan-300/15 bg-cyan-300/[0.025] p-4 text-center">
      <BrainCircuit className="mx-auto mb-2 text-cyan-300/60" size={20} />
      <div className="text-[11px] font-medium text-slate-300">
        {status === "loading"
          ? "Inference pipeline running"
          : "No result for this context"}
      </div>
      <div className="mt-1 text-[9px] text-slate-600">
        Results appear only for the active patient, organ, and model.
      </div>
      {status !== "loading" ? (
        <button
          type="button"
          onClick={onRun}
          className="mt-3 rounded-lg bg-cyan-300/12 px-3 py-1.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-300/20"
        >
          Run inference
        </button>
      ) : (
        <div className="mx-auto mt-3 h-1 w-28 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-300" />
        </div>
      )}
    </div>
  )
}

function BmdPanel({ result }: { result: InferenceResult }) {
  const bmd = result.bmd
  if (!bmd) return null
  const position = Math.min(100, Math.max(0, ((bmd.tScore + 4) / 5) * 100))
  return (
    <div className="space-y-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.035] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-medium text-amber-100">
          <Bone size={13} /> BMD & T-score
        </div>
        <span className="rounded bg-amber-300/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-amber-200">
          Synthetic
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-950/45 p-2.5">
          <div className="text-[8px] uppercase tracking-wider text-slate-600">
            Absolute BMD
          </div>
          <div className="mt-1 text-lg font-semibold text-white">
            {bmd.absoluteBmd.toFixed(3)}{" "}
            <span className="text-[9px] font-normal text-slate-500">g/cm²</span>
          </div>
        </div>
        <div className="rounded-lg bg-slate-950/45 p-2.5">
          <div className="text-[8px] uppercase tracking-wider text-slate-600">
            T-score
          </div>
          <div className="mt-1 text-lg font-semibold text-amber-200">
            {bmd.tScore.toFixed(1)}{" "}
            <span className="text-[9px] font-normal text-slate-500">SD</span>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-[8px] text-slate-600">
          <span>Osteoporosis</span>
          <span>Osteopenia</span>
          <span>Normal</span>
        </div>
        <div className="relative h-2 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400">
          <div
            className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_9px_white]"
            style={{ left: `${position}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[9px]">
        <div className="flex justify-between">
          <span className="text-slate-600">Cortical rim</span>
          <span className="text-slate-300">{bmd.corticalThickness} mm</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Trabecular</span>
          <span className="text-slate-300">{bmd.trabecularIndex}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Reference μ</span>
          <span className="text-slate-300">{bmd.referenceMean}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Reference SD</span>
          <span className="text-slate-300">{bmd.referenceSd}</span>
        </div>
      </div>
      <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2 text-[8px] leading-relaxed text-slate-500">
        Segmentation → trabecular/cortical features → BMD regression → T-score =
        (patient BMD − reference mean) / reference SD.
      </div>
    </div>
  )
}

export default function ContextPanel({
  organId,
  modelId,
  result,
  status,
  error,
  onRun,
}: ContextPanelProps) {
  const [tab, setTab] = useState<"clinical" | "model">("clinical")
  const twin = ORGAN_REGISTRY[organId]
  const model =
    twin.models.find((item) => item.id === modelId) ?? twin.models[0]
  const trained = model.status !== "placeholder"
  const metrics = ORGAN_METRICS[organId]

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#07101e]/90">
      <div className="border-b border-white/[0.06] px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-600">
              Focused context
            </div>
            <h2 className="mt-1 text-sm font-semibold text-white">
              {twin.displayName}
            </h2>
            <div className="mt-0.5 text-[9px] text-slate-500">{model.name}</div>
          </div>
          <div
            className={`rounded-md px-2 py-1 text-[8px] uppercase tracking-wider ${
              model.status === "trained"
                ? "bg-emerald-400/10 text-emerald-300"
                : model.status === "scaffold"
                  ? "bg-amber-300/10 text-amber-200"
                  : "bg-slate-700/30 text-slate-500"
            }`}
          >
            {model.status}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 rounded-lg bg-slate-950/55 p-1">
          {(["clinical", "model"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-md py-1.5 text-[9px] capitalize transition ${
                tab === item
                  ? "bg-white/[0.06] text-slate-200"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-2.5 text-[9px] leading-relaxed text-amber-100/70">
            <AlertTriangle className="mt-0.5 shrink-0" size={12} /> {error}
          </div>
        ) : null}

        {tab === "clinical" ? (
          <>
            <section>
              <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-600">
                Primary metrics
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-white/[0.055] bg-white/[0.025] p-2.5"
                  >
                    <div className="truncate text-[8px] uppercase tracking-[0.12em] text-slate-600">
                      {metric.label}
                    </div>
                    <div
                      className={`mt-1.5 truncate text-[12px] font-medium ${
                        metric.state === "alert"
                          ? "text-rose-300"
                          : metric.state === "watch"
                            ? "text-amber-200"
                            : "text-slate-200"
                      }`}
                    >
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {!result ? (
              <EmptyInference status={status} onRun={onRun} trained={trained} />
            ) : null}
            {result ? (
              <section className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                      result.result.confidence > 0
                        ? "bg-cyan-300/10 text-cyan-200"
                        : "bg-slate-700/30 text-slate-500"
                    }`}
                  >
                    {result.result.confidence > 0 ? (
                      <ShieldCheck size={14} />
                    ) : (
                      <FlaskConical size={14} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] uppercase tracking-[0.16em] text-slate-600">
                      AI finding
                    </div>
                    <div className="mt-1 text-[11px] font-medium leading-snug text-slate-200">
                      {result.result.finding}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
                  {result.result.detail}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2">
                  <span className="text-[8px] uppercase tracking-wider text-slate-600">
                    {result.marker_type.replace("_", " ")} marker
                  </span>
                  <span className="font-mono text-[10px] text-cyan-200">
                    {Math.round(result.result.confidence * 100)}% confidence
                  </span>
                </div>
              </section>
            ) : null}

            {result?.bmd ? <BmdPanel result={result} /> : null}

            {result?.fusion ? (
              <section className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.025] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Fusion engine
                  </span>
                  <span className="text-[8px] text-cyan-300">MULTIMODAL</span>
                </div>
                <div className="flex justify-around border-b border-white/[0.05] pb-3">
                  <ScoreRing
                    value={Math.round(result.fusion.risk * 100)}
                    label="Risk"
                    color="#fb7185"
                  />
                  <ScoreRing
                    value={Math.round(result.fusion.concordance * 100)}
                    label="Concordance"
                    color="#67e8f9"
                  />
                  <ScoreRing
                    value={Math.round(result.fusion.certainty * 100)}
                    label="Certainty"
                    color="#a78bfa"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  {result.fusion.attributions.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex justify-between text-[8px]">
                        <span className="text-slate-500">{item.label}</span>
                        <span className="font-mono text-slate-400">
                          {item.weight}%
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                          style={{ width: `${item.weight}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[9px] uppercase tracking-[0.18em] text-slate-600">
                Architecture
              </div>
              <div className="mt-1.5 text-[11px] text-slate-200">
                {model.architecture}
              </div>
              <div className="mt-3 space-y-2 border-t border-white/[0.05] pt-3 text-[9px]">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600">Task</span>
                  <span className="text-right capitalize text-slate-300">
                    {model.task}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600">Marker</span>
                  <span className="text-right text-slate-300">
                    {model.markerType.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600">Last trained</span>
                  <span className="text-right text-slate-300">
                    {model.lastTrained ?? "—"}
                  </span>
                </div>
              </div>
            </section>
            <section>
              <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-slate-600">
                Held-out metrics
              </div>
              {Object.keys(model.metrics).length > 0 ? (
                <div className="space-y-1.5">
                  {Object.entries(model.metrics).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-[9px]"
                    >
                      <span className="text-slate-500">{label}</span>
                      <span className="font-mono text-emerald-300">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700/70 p-4 text-center text-[9px] leading-relaxed text-slate-600">
                  No validated metric artifact is configured.
                </div>
              )}
            </section>
            <section className="rounded-xl border border-white/[0.05] bg-slate-950/30 p-3">
              <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-slate-600">
                Dataset provenance
              </div>
              <div className="text-[9px] leading-relaxed text-slate-400">
                {model.datasetRef}
              </div>
              <button
                type="button"
                className="mt-3 flex items-center gap-1 text-[9px] text-cyan-300/70 hover:text-cyan-200"
              >
                Model card <ChevronRight size={11} />
              </button>
            </section>
          </>
        )}
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <button
          type="button"
          onClick={onRun}
          disabled={status === "loading" || !trained}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 text-[11px] font-semibold text-slate-950 shadow-[0_0_24px_rgba(45,212,191,.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none"
        >
          {status === "loading" ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
          ) : (
            <Check size={13} />
          )}
          {status === "loading"
            ? "Running pipeline…"
            : trained
              ? "Run context inference"
              : "Model unavailable"}
        </button>
      </div>
    </aside>
  )
}
