import { lazy, Suspense, useMemo, useState } from "react"
import TwinViewport from "./components/TwinViewport"
import { CATEGORY_META, TWIN_DEFINITIONS, type TwinCategory } from "./lib/twins"
import { runTwinInference, type TwinInferenceResult } from "./lib/inferenceClient"

type Layout = "focus" | "grid"

const ECGWaveform = lazy(() => import("./components/cardio/ECGWaveform"))
const PressureVolumeLoop = lazy(() => import("./components/cardio/PressureVolumeLoop"))
const WiggersDiagram = lazy(() => import("./components/cardio/WiggersDiagram"))
const HemodynamicTracing = lazy(() => import("./components/cardio/HemodynamicTracing"))
const ConnectomeViewer = lazy(() => import("./components/neuro/ConnectomeViewer"))
const NeuroMetrics = lazy(() => import("./components/neuro/NeuroMetrics"))
const FlowVolumeLoop = lazy(() => import("./components/pulmo/FlowVolumeLoop"))
const VolumeTimeCurve = lazy(() => import("./components/pulmo/VolumeTimeCurve"))
const PressureVolumeLoopLung = lazy(() => import("./components/pulmo/PressureVolumeLoopLung"))

const MODELS = {
  cardio: [
    { name: "CardioSignal Transformer", type: "ECG time-series", accuracy: "94.2%", precision: "92.8%", recall: "91.6%", f1: "92.2%" },
    { name: "CardioVision CNN", type: "Imaging feature extraction", accuracy: "91.8%", precision: "90.1%", recall: "89.4%", f1: "89.7%" },
    { name: "Hemodynamic Forecaster", type: "Physiology forecasting", accuracy: "89.6%", precision: "88.0%", recall: "87.1%", f1: "87.5%" },
  ],
  neuro: [
    { name: "Connectome GNN", type: "Structural / functional graph", accuracy: "92.1%", precision: "90.7%", recall: "89.9%", f1: "90.3%" },
    { name: "NeuroVision CNN", type: "MRI feature extraction", accuracy: "90.4%", precision: "89.2%", recall: "88.7%", f1: "88.9%" },
    { name: "Clinical BERT", type: "Research-note extraction", accuracy: "93.5%", precision: "91.8%", recall: "92.4%", f1: "92.1%" },
  ],
  pulmo: [
    { name: "Spirometry Transformer", type: "Flow / volume time-series", accuracy: "93.1%", precision: "91.5%", recall: "90.9%", f1: "91.2%" },
    { name: "PulmoRadiomics CNN", type: "CT / X-ray feature extraction", accuracy: "90.7%", precision: "89.8%", recall: "88.6%", f1: "89.2%" },
    { name: "Lung Region GNN", type: "Regional connectivity", accuracy: "88.9%", precision: "87.0%", recall: "86.4%", f1: "86.7%" },
  ],
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="chart-card">
      <div className="chart-card__title">{title}</div>
      <div className="chart-card__body">{children}</div>
    </article>
  )
}

function ClinicalGraphs({ category }: { category: TwinCategory }) {
  const content = category === "cardio" ? <section className="chart-grid cardio-charts">
    <ChartCard title="Electrical activity"><ECGWaveform width={450} height={190} /></ChartCard>
    <ChartCard title="Ventricular mechanics"><PressureVolumeLoop width={450} height={250} /></ChartCard>
    <ChartCard title="Synchronized cardiac cycle"><WiggersDiagram width={450} height={300} /></ChartCard>
    <ChartCard title="Hemodynamic tracing"><HemodynamicTracing width={450} height={240} /></ChartCard>
  </section> : category === "neuro" ? <section className="chart-grid neuro-charts">
    <ChartCard title="Structural & functional connectivity"><ConnectomeViewer width={520} height={330} /></ChartCard>
    <ChartCard title="Network topology"><NeuroMetrics /></ChartCard>
    <ChartCard title="Clinical interpretation">
      <div className="clinical-note">
        <p><strong>Structural connectome</strong> maps tract-derived connections; <strong>functional connectome</strong> displays regional signal correlation.</p>
        <dl><Metric label="Small-worldness" value="1.18" /><Metric label="Global efficiency" value="0.71" /><Metric label="Hub stability" value="0.86" /></dl>
        <p className="muted">Research patterns for neurodegeneration, epilepsy, mood disorders, TBI, and demyelinating disease are evaluated in dedicated models—not inferred from a display alone.</p>
      </div>
    </ChartCard>
  </section> : <section className="chart-grid pulmo-charts">
    <ChartCard title="Flow–volume loop"><FlowVolumeLoop width={450} height={285} /></ChartCard>
    <ChartCard title="Volume–time curve"><VolumeTimeCurve width={450} height={285} /></ChartCard>
    <ChartCard title="Pressure–volume loop"><PressureVolumeLoopLung width={450} height={285} /></ChartCard>
    <ChartCard title="Pattern guide">
      <div className="pattern-guide">
        <div><span className="guide-dot obstructive" /><strong>Obstructive</strong><p>Scooped expiratory limb and reduced FEV₁/FVC; compliance may be increased.</p></div>
        <div><span className="guide-dot restrictive" /><strong>Restrictive</strong><p>Reduced total capacity with a compact loop; compliance is reduced.</p></div>
        <div><span className="guide-dot normal" /><strong>Normal reference</strong><p>Use the reference overlay to compare the selected pattern.</p></div>
      </div>
    </ChartCard>
  </section>

  return <Suspense fallback={<div className="chart-loading">Loading dedicated clinical graphs…</div>}>{content}</Suspense>
}

export default function App() {
  const [category, setCategory] = useState<TwinCategory>("cardio")
  const [selectedId, setSelectedId] = useState("heart-anatomy")
  const [layout, setLayout] = useState<Layout>("focus")
  const [runState, setRunState] = useState<"idle" | "running" | "complete">("idle")
  const [inferenceResult, setInferenceResult] = useState<TwinInferenceResult | null>(null)
  const twins = useMemo(() => TWIN_DEFINITIONS.filter((twin) => twin.category === category), [category])
  const selected = twins.find((twin) => twin.id === selectedId) ?? twins[0]
  const meta = CATEGORY_META[category]

  function chooseCategory(next: TwinCategory) {
    setCategory(next)
    setSelectedId(TWIN_DEFINITIONS.find((twin) => twin.category === next)!.id)
  }

  async function runInference() {
    setRunState("running")
    setInferenceResult(null)
    try {
      setInferenceResult(await runTwinInference(category))
    } catch (error) {
      setInferenceResult({ source: "api", model: "unavailable", summary: error instanceof Error ? error.message : "Inference request failed", confidence: null, elapsedMs: 0 })
    } finally {
      setRunState("complete")
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">M</span><div><h1>MedTwin Studio</h1><p>Independent anatomy twins · research workspace</p></div></div>
        <div className="topbar-actions">
          <span className="research-badge">NOT FOR CLINICAL DECISIONS</span>
          <button className="primary-button" onClick={runInference} disabled={runState === "running"}>{runState === "running" ? "Running…" : runState === "complete" ? "Demo complete" : "Run demo inference"}</button>
        </div>
      </header>

      <section className="toolbar" aria-label="Workspace controls">
        <div className="category-switcher">
          {(Object.keys(CATEGORY_META) as TwinCategory[]).map((key) => <button key={key} className={category === key ? "selected" : ""} onClick={() => chooseCategory(key)}>{CATEGORY_META[key].label}</button>)}
        </div>
        <div className="workspace-mode"><span>Workspace</span><button className={layout === "focus" ? "selected" : ""} onClick={() => setLayout("focus")}>Focus</button><button className={layout === "grid" ? "selected" : ""} onClick={() => setLayout("grid")}>Twin grid</button></div>
      </section>

      <section className="workspace" style={{ "--accent": meta.color } as React.CSSProperties}>
        <aside className="twin-library">
          <div className="section-kicker">Twin library</div>
          <h2>{meta.label}</h2>
          <p>{meta.description}</p>
          <div className="twin-list">
            {twins.map((twin) => <button key={twin.id} onClick={() => setSelectedId(twin.id)} className={`twin-list__item ${selected.id === twin.id ? "selected" : ""}`}>
              <span className="twin-list__dot" /><span><strong>{twin.name}</strong><small>{twin.source}</small></span><b>GLB</b>
            </button>)}
          </div>
          <div className="library-footnote">Each selection loads a separate WebGL scene and preserves its native GLB material maps.</div>
        </aside>

        <section className={`viewport-region ${layout === "grid" ? "viewport-region--grid" : ""}`}>
          {layout === "focus" ? <>
            <div className="viewport-heading"><div><span className="section-kicker">Active digital twin</span><h2>{selected.name}</h2><p>{selected.description}</p></div><span className="scene-status">● live scene</span></div>
            <div className="viewport-frame"><TwinViewport twin={selected} active /></div>
          </> : twins.map((twin) => <button className={`grid-viewport ${selected.id === twin.id ? "selected" : ""}`} key={twin.id} onClick={() => setSelectedId(twin.id)}><TwinViewport twin={twin} active={selected.id === twin.id} /><span>{twin.name}</span></button>)}
        </section>

        <aside className="inference-panel">
          <div className="section-kicker">Inference models</div>
          <h2>{meta.label} stack</h2>
          <p>Cross-validation metrics from the configured research-model catalog.</p>
          <div className="model-list">
            {MODELS[category].map((model) => <article className="model-card" key={model.name}><div><span>READY</span><strong>{model.name}</strong><small>{model.type}</small></div><dl><Metric label="Accuracy" value={model.accuracy} /><Metric label="Precision" value={model.precision} /><Metric label="Recall" value={model.recall} /><Metric label="F1" value={model.f1} /></dl></article>)}
          </div>
          <div className={`demo-status demo-status--${runState}`}><span />{runState === "idle" ? "Awaiting synthetic input" : runState === "running" ? "Processing model adapters" : inferenceResult ? `${inferenceResult.source === "api" ? "API" : "Local preview"}: ${inferenceResult.summary}${inferenceResult.confidence !== null ? ` · ${(inferenceResult.confidence * 100).toFixed(1)}%` : ""}` : "Demo output refreshed"}</div>
        </aside>
      </section>

      <section className="analytics-section" style={{ "--accent": meta.color } as React.CSSProperties}>
        <div className="analytics-heading"><div><span className="section-kicker">Dedicated clinical graphs</span><h2>{meta.label} analytics</h2><p>Visualizations are scoped to the selected organ category.</p></div><span className="data-note">SYNTHETIC / RESEARCH DATA</span></div>
        <ClinicalGraphs category={category} />
      </section>
    </main>
  )
}
