import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Bell,
  Boxes,
  ChevronDown,
  Command,
  HeartPulse,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  PanelRightClose,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react"
import ContextPanel from "./components/ContextPanel"
import RegistryBrowser from "./components/RegistryBrowser"
import { DigitalTwinsFeed } from "./components/DigitalTwinsFeed"
import useInferenceContext from "./hooks/useInferenceContext"
import { PATIENTS } from "./lib/clinicalData"
import { getDefaultModel, ORGAN_REGISTRY, type OrganId } from "./lib/twins"
import { ViewMode } from "./lib/organData"
import { OrganTelemetry } from "./components/OrganTelemetry"
import { ClinicalGraphs } from "./components/ClinicalGraphs"

type MobilePanel = "registry" | "workspace" | "context"

const TwinViewportGrid = lazy(() => import("./components/TwinViewportGrid"))
const ClinicalDock = lazy(() => import("./components/ClinicalDock"))

function SurfaceFallback({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center bg-[#040a16]">
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-slate-600">
        <span className="h-3 w-3 animate-spin rounded-full border border-cyan-300/20 border-t-cyan-300" />
        {label}
      </div>
    </div>
  )
}

function useLiveVitals() {
  const [vitals, setVitals] = useState({
    heartRate: 78,
    spo2: 97.4,
    systolic: 122,
    diastolic: 81,
  })
  useEffect(() => {
    const timer = window.setInterval(() => {
      setVitals((current) => ({
        heartRate: Math.round(
          Math.min(
            104,
            Math.max(62, current.heartRate + (Math.random() - 0.48) * 3),
          ),
        ),
        spo2: Number(
          Math.min(
            99.4,
            Math.max(94.8, current.spo2 + (Math.random() - 0.5) * 0.22),
          ).toFixed(1),
        ),
        systolic: Math.round(
          Math.min(
            145,
            Math.max(106, current.systolic + (Math.random() - 0.5) * 2),
          ),
        ),
        diastolic: Math.round(
          Math.min(
            92,
            Math.max(67, current.diastolic + (Math.random() - 0.5) * 1.4),
          ),
        ),
      }))
    }, 1800)
    return () => window.clearInterval(timer)
  }, [])
  return vitals
}

function ContextBanner({
  patientId,
  organId,
  modelId,
  day,
}: {
  patientId: string
  organId: OrganId
  modelId: string
  day: number
}) {
  const patient = PATIENTS.find((item) => item.id === patientId) ?? PATIENTS[0]
  const twin = ORGAN_REGISTRY[organId]
  const model =
    twin?.models.find((item) => item.id === modelId) ?? twin?.models[0]
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto border-b border-cyan-300/10 bg-cyan-300/[0.025] px-3 font-mono text-[9px] text-slate-500">
      <span className="flex shrink-0 items-center gap-1.5 text-cyan-200">
        <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
        LIVE DEMO
      </span>
      <span className="text-slate-700">/</span>
      <span className="shrink-0">{patient.name}</span>
      <span className="text-slate-700">/</span>
      <span className="shrink-0 text-slate-300">{twin?.shortName ?? organId}</span>
      <span className="text-slate-700">/</span>
      <span className="shrink-0">{model?.name ?? 'Model'}</span>
      <span className="text-slate-700">/</span>
      <span className="shrink-0">Day +{day}</span>
      <span className="ml-auto shrink-0 text-amber-200/70">
        Synthetic patient · context isolated
      </span>
    </div>
  )
}

function CommandPalette({
  onClose,
  onAction,
}: {
  onClose: () => void
  onAction: (action: string) => void
}) {
  const [query, setQuery] = useState("")
  const actions = [
    ["Run current inference", "infer", "Space"],
    ["Maximize or restore focused area", "maximize-area", "Ctrl+Space"],
    ["Reset focused camera", "reset-camera", "R"],
    ["Open twin registry", "registry", "1"],
    ["Focus workspace", "workspace", "2"],
    ["Open context panel", "context", "3"],
    ["Toggle twin feed", "feed", "4"],
    ["Advance forecast one day", "next-day", "→"],
    ["Reset forecast", "reset-day", "Home"],
  ].filter(([label]) => label.toLowerCase().includes(query.toLowerCase()))
  return (
    <div
      className="fixed inset-0 z-[100] flex justify-center bg-slate-950/75 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="h-fit w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#0a1423] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 items-center gap-3 border-b border-white/[0.06] px-4">
          <Search size={14} className="text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands"
            className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
          />
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-300"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-2">
          {actions.map(([label, action, shortcut]) => (
            <button
              key={action}
              onClick={() => {
                onAction(action)
                onClose()
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] text-slate-300 hover:bg-white/[0.05]"
            >
              <span>{label}</span>
              <kbd className="rounded border border-white/10 bg-slate-950/50 px-1.5 py-0.5 font-mono text-[8px] text-slate-600">
                {shortcut}
              </kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [patientId, setPatientId] = useState(PATIENTS[0].id)
  const [organId, setOrganId] = useState<OrganId>("heart")
  const [modelId, setModelId] = useState(getDefaultModel("heart").id)
  const [forecastDay, setForecastDay] = useState(0)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("workspace")
  const [mainView, setMainView] = useState<"workspace" | "feed">("workspace")
  const [viewMode, setViewMode] = useState<ViewMode>("exterior")
  const [commandOpen, setCommandOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const vitals = useLiveVitals()
  const inference = useInferenceContext({ patientId, organId, modelId })

  const patient = PATIENTS.find((item) => item.id === patientId) ?? PATIENTS[0]
  const twin = ORGAN_REGISTRY[organId]
  const model =
    twin?.models.find((item) => item.id === modelId) ?? twin?.models[0]
  const riskIndex = inference.result
    ? Math.round(inference.result.fusion.risk * 100)
    : Math.min(97, 8 + forecastDay * 6)

  const switchContext = useCallback(
    (nextOrgan: OrganId, nextModelId: string) => {
      setOrganId(nextOrgan)
      setModelId(nextModelId)
    },
    [],
  )

  const switchOrgan = useCallback(
    (nextOrgan: OrganId) => {
      switchContext(nextOrgan, getDefaultModel(nextOrgan)?.id ?? "default")
    },
    [switchContext],
  )

  const handleAction = (action: string) => {
    if (action === "infer") inference.runInference()
    if (action === "registry") setMobilePanel("registry")
    if (action === "workspace") setMobilePanel("workspace")
    if (action === "context") setMobilePanel("context")
    if (action === "feed") setMainView((v) => (v === "workspace" ? "feed" : "workspace"))
    if (action === "next-day") setForecastDay((day) => Math.min(14, day + 1))
    if (action === "reset-day") setForecastDay(0)
    if (action === "maximize-area")
      window.dispatchEvent(
        new CustomEvent("medtwin:workspace-command", {
          detail: { action: "toggle-maximize" },
        }),
      )
    if (action === "reset-camera")
      window.dispatchEvent(
        new CustomEvent("medtwin:workspace-command", {
          detail: { action: "reset-camera" },
        }),
      )
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches("input, textarea, select")) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandOpen(true)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.code === "Space") {
        event.preventDefault()
        handleAction("maximize-area")
        return
      }
      if (event.key === " ") {
        event.preventDefault()
        inference.runInference()
      }
      if (event.key === "ArrowRight")
        setForecastDay((day) => Math.min(14, day + 1))
      if (event.key === "ArrowLeft")
        setForecastDay((day) => Math.max(0, day - 1))
      if (event.key.toLowerCase() === "r") handleAction("reset-camera")
      if (event.key === "4") handleAction("feed")
      if (event.key === "Home") setForecastDay(0)
      if (event.key === "[") setLeftOpen((value) => !value)
      if (event.key === "]") setRightOpen((value) => !value)
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [inference.runInference])

  const resultLabel = useMemo(() => {
    if (!inference.result) return null
    return `${patient.name} · ${twin?.shortName ?? organId} · ${model?.name ?? ''} · ${new Date(inference.result.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  }, [inference.result, model?.name, patient.name, twin?.shortName, organId])

  return (
    <div className="flex h-dvh min-h-[560px] flex-col overflow-hidden bg-[#030712] text-slate-200">
      <div
        className="pointer-events-none fixed inset-0 z-[90] grid place-items-center overflow-hidden opacity-[0.018]"
        aria-hidden="true"
      >
        <div className="-rotate-12 whitespace-nowrap text-[clamp(34px,6vw,92px)] font-black uppercase tracking-[0.2em] text-white">
          Prototype · Not for clinical use
        </div>
      </div>

      <header className="z-50 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#07101e]/95 px-3 shadow-xl backdrop-blur-xl sm:px-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-teal-500 text-slate-950 shadow-[0_0_22px_rgba(45,212,191,.3)]">
            <HeartPulse size={16} />
          </div>
          <div className="hidden sm:block">
            <div className="text-[13px] font-semibold tracking-tight text-white">
              MedTwin
            </div>
            <div className="text-[7px] uppercase tracking-[0.22em] text-cyan-300/60">
              Clinical intelligence OS
            </div>
          </div>
        </div>

        <div className="hidden h-5 w-px bg-white/[0.07] sm:block" />
        <label className="relative hidden md:block">
          <span className="sr-only">Select patient</span>
          <select
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            className="h-8 appearance-none rounded-lg border border-white/[0.07] bg-slate-950/45 pl-3 pr-8 text-[10px] text-slate-300 outline-none hover:border-white/15 focus:border-cyan-300/30"
          >
            {PATIENTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.mrn}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-600"
            size={11}
          />
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="mr-2 hidden items-center gap-4 rounded-xl border border-white/[0.055] bg-slate-950/35 px-3 py-1.5 lg:flex">
            <div>
              <span className="text-[8px] uppercase tracking-wider text-slate-600">
                HR
              </span>
              <strong className="ml-1.5 font-mono text-[10px] text-cyan-200">
                {vitals.heartRate}
              </strong>
            </div>
            <div>
              <span className="text-[8px] uppercase tracking-wider text-slate-600">
                SpO₂
              </span>
              <strong className="ml-1.5 font-mono text-[10px] text-cyan-200">
                {vitals.spo2}%
              </strong>
            </div>
            <div>
              <span className="text-[8px] uppercase tracking-wider text-slate-600">
                BP
              </span>
              <strong className="ml-1.5 font-mono text-[10px] text-cyan-200">
                {vitals.systolic}/{vitals.diastolic}
              </strong>
            </div>
          </div>
          <div className="hidden -space-x-2 sm:flex">
            <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#07101e] bg-violet-500 text-[8px] font-semibold">
              AN
            </div>
            <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#07101e] bg-teal-600 text-[8px] font-semibold">
              SK
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setMainView((v) => (v === "workspace" ? "feed" : "workspace"))
            }
            className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[9px] sm:flex ${
              mainView === "feed"
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                : "border-white/[0.07] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            }`}
          >
            <LayoutGrid size={12} />
            FEED
          </button>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] px-2.5 text-[9px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300 sm:flex"
          >
            <Command size={12} />K
          </button>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setNotificationOpen((value) => !value)}
            className="relative grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
          >
            <Bell size={14} />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-300" />
          </button>
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen((value) => !value)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
          >
            <Settings size={14} />
          </button>
          <div className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-slate-700 text-[9px] font-semibold text-white">
            DR
          </div>
        </div>
      </header>

      <ContextBanner
        patientId={patientId}
        organId={organId}
        modelId={modelId}
        day={forecastDay}
      />

      <div className="hidden h-12 shrink-0 items-center gap-2 border-b border-white/[0.05] bg-[#050c18] px-3 sm:flex">
        <button
          type="button"
          aria-label="Toggle twin registry"
          onClick={() => setLeftOpen((value) => !value)}
          className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-white/[0.04] hover:text-slate-300"
        >
          {leftOpen ? <PanelLeftClose size={14} /> : <Menu size={14} />}
        </button>
        <div className="h-5 w-px bg-white/[0.06] mx-1" />
        
        {/* Horizontal Pill Bar Organ Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto mx-2 hide-scrollbar py-1">
          {Object.values(ORGAN_REGISTRY).map((item) => (
            <button 
              key={item.id}
              onClick={() => switchOrgan(item.id as OrganId)}
              className={`px-3.5 py-1.5 text-[10px] font-medium tracking-wide rounded-full transition-all duration-200 ${
                organId === item.id 
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]' 
                : 'bg-slate-900/40 text-slate-400 border border-transparent hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {item.displayName}
            </button>
          ))}
        </div>

        {/* Interior/Exterior Toggle */}
        <div className="flex items-center bg-slate-950/80 rounded-full p-0.5 border border-white/10 ml-auto shrink-0 shadow-inner">
          <button 
            onClick={() => setViewMode('exterior')} 
            className={`px-3 py-1 rounded-full text-[9px] font-semibold tracking-wider transition-colors ${
              viewMode === 'exterior' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            EXTERIOR
          </button>
          <button 
            onClick={() => setViewMode('interior')} 
            className={`px-3 py-1 rounded-full text-[9px] font-semibold tracking-wider transition-colors ${
              viewMode === 'interior' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            INTERIOR
          </button>
        </div>

        <div className="h-5 w-px bg-white/[0.06] mx-1" />
        <button
          type="button"
          aria-label="Toggle context panel"
          onClick={() => setRightOpen((value) => !value)}
          className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-white/[0.04] hover:text-slate-300"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      <nav className="grid h-11 shrink-0 grid-cols-3 border-b border-white/[0.06] sm:hidden">
        {(["registry", "workspace", "context"] as const).map((panel) => (
          <button
            key={panel}
            onClick={() => setMobilePanel(panel)}
            className={`text-[9px] uppercase tracking-[0.15em] ${
              mobilePanel === panel
                ? "border-b-2 border-cyan-300 bg-cyan-300/[0.05] text-cyan-200"
                : "text-slate-600"
            }`}
          >
            {panel}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1">
        <div
          className={`${
            mobilePanel === "registry" ? "block w-full" : "hidden"
          } min-h-0 border-r border-white/[0.06] bg-[#07101e] sm:block transition-all duration-300 ${
            leftOpen ? "sm:w-[236px]" : "sm:w-0 sm:overflow-hidden"
          }`}
        >
          <RegistryBrowser
            activeOrgan={organId}
            onSelect={(next) => {
              switchOrgan(next)
              setMobilePanel("workspace")
            }}
          />
        </div>

        <main
          className={`${
            mobilePanel === "workspace" ? "flex" : "hidden"
          } min-w-0 flex-1 flex-col sm:flex`}
        >
          {mainView === "feed" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-[#040a16]">
              <DigitalTwinsFeed riskScore={riskIndex} />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 flex relative">
                
                {/* Left Telemetry Panel */}
                <div className="hidden xl:flex w-64 border-r border-white/[0.04] bg-gradient-to-r from-[#030712] to-transparent p-4 overflow-y-auto z-10 custom-scrollbar">
                  <div className="w-full mt-2">
                    <OrganTelemetry organId={organId} />
                  </div>
                </div>

                {/* Center WebGL Canvas */}
                <div className="flex-1 min-w-0 relative h-full">
                  <Suspense
                    fallback={<SurfaceFallback label="Loading 3D workspace" />}
                  >
                    <TwinViewportGrid
                      activeOrgan={organId}
                      activeModelId={modelId}
                      patientId={patientId}
                      onActiveContextChange={switchContext}
                      forecastDay={forecastDay}
                      finding={inference.result?.result.finding ?? ""}
                      markerType={inference.result?.marker_type ?? "none"}
                      heartRate={vitals.heartRate}
                      riskIndex={riskIndex}
                      viewMode={viewMode}
                    />
                  </Suspense>
                  
                  {resultLabel ? (
                    <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 hidden -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[8px] text-slate-500 backdrop-blur-md lg:block">
                      Results are for:{" "}
                      <span className="text-slate-300">{resultLabel}</span>
                    </div>
                  ) : null}
                </div>

                {/* Right Clinical Graphs Panel */}
                <div className="hidden xl:block w-72 border-l border-white/[0.04] bg-gradient-to-l from-[#030712] to-transparent p-4 overflow-y-auto z-10 custom-scrollbar">
                  <div className="w-full mt-2">
                    <ClinicalGraphs organId={organId} viewMode={viewMode} />
                  </div>
                </div>
              </div>
              <Suspense
                fallback={
                  <div className="h-[188px] border-t border-white/[0.06] bg-[#07101e]" />
                }
              >
                <ClinicalDock
                  organId={organId}
                  day={forecastDay}
                  onDayChange={setForecastDay}
                />
              </Suspense>
            </>
          )}
        </main>

        <div
          className={`${
            mobilePanel === "context" ? "block w-full" : "hidden"
          } min-h-0 border-l border-white/[0.06] sm:block transition-all duration-300 ${
            rightOpen ? "sm:w-[292px]" : "sm:w-0 sm:overflow-hidden"
          }`}
        >
          <ContextPanel
            organId={organId}
            modelId={modelId}
            result={inference.result}
            status={inference.status}
            error={inference.error}
            onRun={inference.runInference}
          />
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-2 left-1/2 z-[95] -translate-x-1/2 rounded-full border border-amber-300/15 bg-slate-950/75 px-3 py-1 text-[8px] uppercase tracking-[0.16em] text-amber-200/70 backdrop-blur">
        Simulated / Prototype Data — Not for Clinical Use
      </div>

      {commandOpen ? (
        <CommandPalette
          onClose={() => setCommandOpen(false)}
          onAction={handleAction}
        />
      ) : null}
      {notificationOpen ? (
        <div className="fixed right-4 top-14 z-[80] w-72 rounded-2xl border border-white/10 bg-[#0a1423] p-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-white">
              Clinical notifications
            </span>
            <button
              onClick={() => setNotificationOpen(false)}
              className="text-slate-600"
            >
              <X size={13} />
            </button>
          </div>
          <div className="mt-3 space-y-1.5">
            {[
              "Context isolation guard active",
              "Synthetic telemetry stream connected",
              "Forecast confidence widens after Day +6",
            ].map((item, index) => (
              <div
                key={item}
                className="flex gap-2 rounded-lg bg-white/[0.025] p-2 text-[9px] text-slate-400"
              >
                <span
                  className={index === 2 ? "text-amber-300" : "text-cyan-300"}
                >
                  ●
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {settingsOpen ? (
        <div className="fixed inset-y-0 right-0 z-[85] w-[320px] border-l border-white/10 bg-[#091321] p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">
                Workspace settings
              </div>
              <div className="mt-0.5 text-[9px] text-slate-600">
                Local prototype preferences
              </div>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.05]"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Alert sounds", true],
              ["Auto rotate unfocused twins", true],
              ["Show synthetic watermark", true],
            ].map(([label, value]) => (
              <label
                key={String(label)}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[10px] text-slate-300"
              >
                <span>{String(label)}</span>
                <input
                  type="checkbox"
                  defaultChecked={Boolean(value)}
                  className="accent-cyan-400"
                />
              </label>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03] p-3 text-[9px] leading-relaxed text-slate-500">
            <Users size={14} className="mb-2 text-cyan-300" />
            Collaboration presence is simulated. Production co-op requires
            authenticated WebRTC/Yjs sessions and audit logging.
          </div>
        </div>
      ) : null}
    </div>
  )
}
