import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import {
  Activity,
  Bell,
  Bone,
  Brain,
  Cuboid,
  Download,
  Droplets,
  Eye,
  EyeOff,
  FileJson,
  HeartPulse,
  Layers3,
  Maximize,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Workflow,
  Wind,
  X,
  Zap,
} from "lucide-react"
import type { AnatomyLayers, CameraPreset } from "./components/TwinViewport"
import {
  initialFusion,
  runFusion,
  type FusionResult,
  type ModelResult,
} from "./lib/inferenceClient"
import {
  ANATOMIES,
  ANATOMY_BY_ID,
  type AnatomyId,
  type ViewMode,
} from "./lib/twins"
import { volumeSummary, type VolumeData } from "./lib/volumeLoader"

const ClinicalAnalytics = lazy(() => import("./components/ClinicalAnalytics"))
const TwinViewport = lazy(() => import("./components/TwinViewport"))
const VolumeInspector = lazy(() => import("./components/VolumeInspector"))

const ANATOMY_ICONS: Record<AnatomyId, typeof HeartPulse> = {
  heart: HeartPulse,
  brain: Brain,
  nervous: Workflow,
  skeletal: Bone,
  lungs: Wind,
  renal: Droplets,
  digestive: Stethoscope,
}

const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: "exterior", label: "Exterior" },
  { id: "interior", label: "Interior" },
  { id: "xray", label: "X-ray" },
  { id: "mesh", label: "Mesh" },
]

const LAYER_LABELS: Array<{ id: keyof AnatomyLayers; label: string }> = [
  { id: "anatomy", label: "Anatomy" },
  { id: "vascular", label: "Vascular" },
  { id: "nervous", label: "Neural" },
  { id: "skeletal", label: "Skeletal" },
  { id: "roi", label: "ROI" },
  { id: "forecast", label: "Spread" },
]

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function ModelRow({
  model,
  active,
  threshold,
  onSelect,
}: {
  model: ModelResult
  active: boolean
  threshold: number
  onSelect: () => void
}) {
  const contributing = model.probability >= threshold
  return (
    <button
      type="button"
      className={`model-row ${active ? "selected" : ""}`}
      onClick={onSelect}
    >
      <div className="model-row__head">
        <i className={contributing ? "ready" : "standby"} />
        <span>
          <strong>{model.name}</strong>
          <small>
            {model.family} · {model.latency_ms} ms
          </small>
        </span>
        <b>{pct(model.probability)}</b>
      </div>
      <div className="model-row__bar">
        <i style={{ width: pct(model.probability) }} />
      </div>
      <dl>
        <div>
          <dt>AUC</dt>
          <dd>{model.auc_roc.toFixed(3)}</dd>
        </div>
        <div>
          <dt>F1</dt>
          <dd>{model.f1.toFixed(3)}</dd>
        </div>
        <div>
          <dt>SENS</dt>
          <dd>{model.sensitivity.toFixed(3)}</dd>
        </div>
      </dl>
    </button>
  )
}

export default function App() {
  const [anatomyId, setAnatomyId] = useState<AnatomyId>("heart")
  const [viewMode, setViewMode] = useState<ViewMode>("exterior")
  const [layers, setLayers] = useState<AnatomyLayers>({
    anatomy: true,
    vascular: true,
    nervous: false,
    skeletal: false,
    roi: true,
    forecast: true,
  })
  const [threshold, setThreshold] = useState(0.65)
  const [forecastDay, setForecastDay] = useState(4)
  const [forecastPlaying, setForecastPlaying] = useState(false)
  const [fusion, setFusion] = useState<FusionResult>(() =>
    initialFusion("heart", 0.65),
  )
  const [runState, setRunState] = useState<"idle" | "running" | "complete">(
    "idle",
  )
  const [selectedModel, setSelectedModel] = useState(0)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("anterior")
  const [cameraReset, setCameraReset] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [volumeInspectorOpen, setVolumeInspectorOpen] = useState(false)
  const [volume, setVolume] = useState<VolumeData | null>(null)
  const [volumeSlice, setVolumeSlice] = useState(0)
  const [volumeThreshold, setVolumeThreshold] = useState(0.62)
  const [volumeOpacity, setVolumeOpacity] = useState(0.62)
  const anatomy = ANATOMY_BY_ID[anatomyId]
  const activeForecast =
    fusion.forecast[Math.min(forecastDay, fusion.forecast.length - 1)]
  const primaryMarker = fusion.markers[0]

  useEffect(() => {
    if (!forecastPlaying) return
    const timer = window.setInterval(() => {
      setForecastDay((day) => (day >= fusion.forecast.length - 1 ? 0 : day + 1))
    }, 950)
    return () => window.clearInterval(timer)
  }, [forecastPlaying, fusion.forecast.length])

  const visibleMarkers = useMemo(
    () => fusion.markers.filter((marker) => marker.probability >= threshold),
    [fusion.markers, threshold],
  )

  function selectAnatomy(next: AnatomyId) {
    setAnatomyId(next)
    setFusion(initialFusion(next, threshold))
    setForecastDay(0)
    setSelectedModel(0)
    setRunState("idle")
    setCameraReset((value) => value + 1)
  }

  async function runInference() {
    setRunState("running")
    const result = await runFusion(
      anatomyId,
      threshold,
      12,
      volume ? volumeSummary(volume) : undefined,
    )
    setFusion(result)
    setRunState("complete")
    setSelectedModel(0)
  }

  function toggleLayer(layer: keyof AnatomyLayers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }))
  }

  function exportResult() {
    const payload = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        anonymous: true,
        volume_summary: volume ? volumeSummary(volume) : null,
        ...fusion,
      },
      null,
      2,
    )
    const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `medtwin-${anatomyId}-simulation.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="app-shell"
      style={
        {
          "--anatomy-color": anatomy.color,
          "--anatomy-secondary": anatomy.secondaryColor,
        } as React.CSSProperties
      }
    >
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Activity size={19} />
          </div>
          <div>
            <strong>MedTwin Atlas</strong>
            <span>ANATOMICAL INTELLIGENCE</span>
          </div>
        </div>
        <nav className="product-nav" aria-label="Product areas">
          <button className="selected" onClick={() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" })}>Workspace</button>
          <button onClick={() => document.getElementById("model-lab")?.scrollIntoView({ behavior: "smooth" })}>Model lab</button>
          <button onClick={() => document.getElementById("validation")?.scrollIntoView({ behavior: "smooth" })}>Validation</button>
          <button onClick={() => document.getElementById("validation")?.scrollIntoView({ behavior: "smooth" })}>Audit</button>
        </nav>
        <div className="topbar-actions">
          <span className="privacy-state">
            <ShieldCheck size={13} />
            ZERO-IDENTITY MODE
          </span>
          <button
            type="button"
            className="icon-button"
            title="Export simulation JSON"
            aria-label="Export simulation JSON"
            onClick={exportResult}
          >
            <Download size={15} />
          </button>
          <button
            type="button"
            className={`icon-button ${notificationsOpen ? "selected" : ""}`}
            title="Notifications"
            aria-label="Notifications"
            onClick={() => setNotificationsOpen((value) => !value)}
          >
            <Bell size={15} />
            <i />
          </button>
          <button
            type="button"
            className={`icon-button ${settingsOpen ? "selected" : ""}`}
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      <section className="context-bar">
        <div>
          <span className="live-dot" />
          ANONYMOUS STUDY <b>LAB-7F2A</b>
        </div>
        <i />
        <div>
          INPUT <b>{volume ? "LOCAL VOLUME + SYNTHETIC" : "SYNTHETIC MULTIMODAL"}</b>
        </div>
        <i />
        <div>
          ENGINE <b>{fusion.audit.engine.toUpperCase()}</b>
        </div>
        <i />
        <div>
          SESSION <b>EPHEMERAL</b>
        </div>
        <span className="context-source">
          {fusion.source === "gateway"
            ? "NODE + PYTHON CONNECTED"
            : "LOCAL PREVIEW"}
        </span>
      </section>

      <main className="workspace" id="workspace">
        <aside className="anatomy-browser">
          <div className="panel-heading">
            <div>
              <small>ANATOMY REGISTRY</small>
              <h2>Systems</h2>
            </div>
            <button
              type="button"
              className="icon-button small"
              title="Registry layers"
              aria-label="Registry layers"
            >
              <Layers3 size={14} />
            </button>
          </div>
          <div className="anatomy-list">
            {ANATOMIES.map((item) => {
              const Icon = ANATOMY_ICONS[item.id]
              return (
                <button
                  type="button"
                  key={item.id}
                  className={anatomyId === item.id ? "selected" : ""}
                  onClick={() => selectAnatomy(item.id)}
                >
                  <span>
                    <Icon size={17} />
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.system}</small>
                  </div>
                  <i />
                </button>
              )
            })}
          </div>
          <div className="registry-metric">
            <small>{anatomy.metricLabel}</small>
            <strong>{anatomy.metricValue}</strong>
            <span>
              <i style={{ width: "74%" }} />
            </span>
            <p>Synthetic reference range</p>
          </div>
          <div className="registry-footer">
            <Cuboid size={14} />
            <span>
              <strong>7 twins ready</strong>
              <small>Procedural scene · GLB compatible</small>
            </span>
          </div>
        </aside>

        <section className="viewport-workspace">
          <header className="viewport-header">
            <div>
              <small>{anatomy.system.toUpperCase()}</small>
              <h1>{anatomy.label} digital twin</h1>
              <p>{anatomy.description}</p>
            </div>
            <div className="mode-switcher" aria-label="Rendering mode">
              {VIEW_MODES.map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  className={viewMode === mode.id ? "selected" : ""}
                  onClick={() => setViewMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </header>

          <div className="viewport-toolbar">
            <div className="layer-controls">
              {LAYER_LABELS.map((layer) => (
                <button
                  type="button"
                  key={layer.id}
                  className={layers[layer.id] ? "selected" : ""}
                  onClick={() => toggleLayer(layer.id)}
                  title={`${
                    layers[layer.id] ? "Hide" : "Show"
                  } ${layer.label} layer`}
                >
                  {layers[layer.id] ? <Eye size={12} /> : <EyeOff size={12} />}
                  {layer.label}
                </button>
              ))}
            </div>
            <div className="camera-controls">
              <button
                type="button"
                className={volumeInspectorOpen ? "selected" : ""}
                title="Open local volume workspace"
                aria-label="Open local volume workspace"
                onClick={() => setVolumeInspectorOpen(true)}
              >
                <ScanLine size={13} />
              </button>
              {([
                "anterior",
                "posterior",
                "lateral",
                "superior",
              ] as CameraPreset[]).map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={cameraPreset === preset ? "selected" : ""}
                  title={`${preset} camera`}
                  onClick={() => setCameraPreset(preset)}
                >
                  {preset.slice(0, 1).toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                title="Reset camera"
                aria-label="Reset camera"
                onClick={() => setCameraReset((value) => value + 1)}
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                title="Fit viewport"
                aria-label="Fit viewport"
                onClick={() => setCameraReset((value) => value + 1)}
              >
                <Maximize size={13} />
              </button>
            </div>
          </div>

          <div className="viewport-stage">
            <Suspense fallback={<div className="module-loading">INITIALIZING 3D ENGINE</div>}>
              <TwinViewport
                anatomy={anatomy}
                mode={viewMode}
                layers={layers}
                fusion={fusion}
                threshold={threshold}
                forecastDay={forecastDay}
                cameraPreset={cameraPreset}
                cameraReset={cameraReset}
                volume={volume}
                volumeSlice={volumeSlice}
                volumeThreshold={volumeThreshold}
                volumeOpacity={volumeOpacity}
              />
            </Suspense>
            <div className="viewport-readout viewport-readout--left">
              <small>ACTIVE FINDING</small>
              <strong>{primaryMarker.label}</strong>
              <div>
                <span>ROI probability</span>
                <b>{pct(primaryMarker.probability)}</b>
              </div>
              <div>
                <span>Visible regions</span>
                <b>
                  {visibleMarkers.length} / {fusion.markers.length}
                </b>
              </div>
            </div>
            <div className="viewport-readout viewport-readout--right">
              <small>FORECAST FRAME</small>
              <strong>Day +{forecastDay}</strong>
              <div>
                <span>Expected</span>
                <b>{pct(activeForecast.expected)}</b>
              </div>
              <div>
                <span>Spread index</span>
                <b>{pct(activeForecast.spread)}</b>
              </div>
            </div>
          </div>

          <div className="forecast-control">
            <button
              type="button"
              className="forecast-play"
              title={forecastPlaying ? "Pause forecast" : "Play forecast"}
              aria-label={forecastPlaying ? "Pause forecast" : "Play forecast"}
              onClick={() => setForecastPlaying((value) => !value)}
            >
              {forecastPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <div className="forecast-track">
              <div>
                <span>BASELINE</span>
                <b>FORECAST HORIZON</b>
                <span>DAY +{fusion.forecast.length - 1}</span>
              </div>
              <input
                type="range"
                min="0"
                max={fusion.forecast.length - 1}
                value={forecastDay}
                onChange={(event) => setForecastDay(Number(event.target.value))}
                aria-label="Forecast day"
              />
            </div>
            <strong>
              +{forecastDay}
              <small>DAY</small>
            </strong>
          </div>
        </section>

        <aside className="inference-sidebar" id="model-lab">
          <div className="panel-heading">
            <div>
              <small>MULTIMODEL FUSION</small>
              <h2>Inference stack</h2>
            </div>
            <span
              className={`engine-state ${
                runState === "running" ? "running" : ""
              }`}
            >
              <i />
              {runState === "running" ? "RUNNING" : "READY"}
            </span>
          </div>

          <section className="fusion-score">
            <div
              className="score-ring"
              style={
                {
                  "--score": `${Math.round(fusion.fusion.probability * 100) * 3.6}deg`,
                } as React.CSSProperties
              }
            >
              <div>
                <strong>{pct(fusion.fusion.probability)}</strong>
                <span>FUSED</span>
              </div>
            </div>
            <div>
              <small>DECISION SUPPORT</small>
              <strong>{fusion.fusion.decision.toUpperCase()}</strong>
              <p>{anatomy.focus}</p>
              <span>
                AUC {fusion.fusion.auc_roc.toFixed(3)} · entropy{" "}
                {fusion.fusion.entropy.toFixed(2)}
              </span>
            </div>
          </section>

          <section className="threshold-control">
            <div>
              <label htmlFor="threshold">Decision threshold</label>
              <strong>{threshold.toFixed(2)}</strong>
            </div>
            <input
              id="threshold"
              type="range"
              min="0.25"
              max="0.9"
              step="0.01"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
            />
            <div>
              <span>SENSITIVE</span>
              <span>BALANCED</span>
              <span>SPECIFIC</span>
            </div>
          </section>

          <div className="model-stack">
            {fusion.models.map((model, index) => (
              <ModelRow
                key={model.name}
                model={model}
                active={selectedModel === index}
                threshold={threshold}
                onSelect={() => setSelectedModel(index)}
              />
            ))}
          </div>

          <section className="selected-model-detail">
            <div>
              <Zap size={14} />
              <span>
                <small>SELECTED MODEL</small>
                <strong>{fusion.models[selectedModel].name}</strong>
              </span>
            </div>
            <dl>
              <div>
                <dt>Specificity</dt>
                <dd>{fusion.models[selectedModel].specificity.toFixed(3)}</dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{pct(fusion.models[selectedModel].weight)}</dd>
              </div>
              <div>
                <dt>Contribution</dt>
                <dd>{pct(fusion.models[selectedModel].contribution)}</dd>
              </div>
            </dl>
          </section>

          <button
            type="button"
            className="run-button"
            disabled={runState === "running"}
            onClick={runInference}
          >
            {runState === "running" ? (
              <RefreshCw className="spin" size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            {runState === "running"
              ? "Running fusion"
              : "Run multimodel fusion"}
          </button>
        </aside>
      </main>

      <section id="validation">
        <Suspense fallback={<div className="analytics-loading">LOADING VALIDATION MODULE</div>}>
          <ClinicalAnalytics
            fusion={{ ...fusion, threshold }}
            forecastDay={forecastDay}
          />
        </Suspense>
      </section>

      <footer className="app-footer">
        <ShieldCheck size={12} />
        SYNTHETIC RESEARCH SIMULATION · NOT FOR DIAGNOSIS OR CLINICAL DECISIONS{" "}
        <span>NO PERSONAL DATA STORED</span>
      </footer>

      {notificationsOpen ? (
        <div className="floating-panel notification-panel">
          <header>
            <div>
              <Bell size={15} />
              <strong>System events</strong>
            </div>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setNotificationsOpen(false)}
            >
              <X size={14} />
            </button>
          </header>
          <div className="event-row">
            <i className="ok" />
            <span>
              <strong>Anonymous context verified</strong>
              <small>0 identity fields detected</small>
            </span>
            <b>NOW</b>
          </div>
          <div className="event-row">
            <i className="warn" />
            <span>
              <strong>Forecast interval widening</strong>
              <small>Review frames after Day +8</small>
            </span>
            <b>2M</b>
          </div>
          <div className="event-row">
            <i className="ok" />
            <span>
              <strong>Model catalog calibrated</strong>
              <small>{fusion.models.length} contributors ready</small>
            </span>
            <b>4M</b>
          </div>
        </div>
      ) : null}

      {volumeInspectorOpen ? (
        <Suspense fallback={null}>
          <VolumeInspector
            volume={volume}
            sliceIndex={volumeSlice}
            threshold={volumeThreshold}
            opacity={volumeOpacity}
            onVolumeChange={setVolume}
            onSliceIndexChange={setVolumeSlice}
            onThresholdChange={setVolumeThreshold}
            onOpacityChange={setVolumeOpacity}
            onClose={() => setVolumeInspectorOpen(false)}
          />
        </Suspense>
      ) : null}

      {settingsOpen ? (
        <aside className="settings-drawer">
          <header>
            <div>
              <Settings size={16} />
              <span>
                <strong>Workspace settings</strong>
                <small>Session-only preferences</small>
              </span>
            </div>
            <button
              type="button"
              aria-label="Close settings"
              onClick={() => setSettingsOpen(false)}
            >
              <X size={15} />
            </button>
          </header>
          <section>
            <h3>Rendering</h3>
            <label>
              <span>
                <strong>Forecast overlay</strong>
                <small>Spatial uncertainty volume</small>
              </span>
              <input
                type="checkbox"
                checked={layers.forecast}
                onChange={() => toggleLayer("forecast")}
              />
            </label>
            <label>
              <span>
                <strong>ROI markers</strong>
                <small>Threshold-filtered anchors</small>
              </span>
              <input
                type="checkbox"
                checked={layers.roi}
                onChange={() => toggleLayer("roi")}
              />
            </label>
            <label>
              <span>
                <strong>Skeletal context</strong>
                <small>Reference structure overlay</small>
              </span>
              <input
                type="checkbox"
                checked={layers.skeletal}
                onChange={() => toggleLayer("skeletal")}
              />
            </label>
          </section>
          <section>
            <h3>Session</h3>
            <button type="button" onClick={exportResult}>
              <FileJson size={14} />
              Export result bundle
            </button>
            <button
              type="button"
              onClick={() => {
                setThreshold(0.65)
                setForecastDay(0)
                setFusion(initialFusion(anatomyId, 0.65))
              }}
            >
              <RotateCcw size={14} />
              Reset simulation
            </button>
          </section>
          <div className="privacy-card">
            <ShieldCheck size={18} />
            <strong>Stateless anonymous mode</strong>
            <p>
              This workspace accepts only anatomy, threshold, horizon, and
              synthetic seed parameters.
            </p>
          </div>
        </aside>
      ) : null}
    </div>
  )
}
