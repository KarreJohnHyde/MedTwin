import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Columns2,
  Focus,
  Grid2X2,
  Maximize2,
  MoreHorizontal,
  Rows2,
  ScanLine,
  Square,
  X,
} from "lucide-react"
import XRayOrganViewer, {
  type CameraCommand,
  type CameraPreset,
} from "./XRayOrganViewer"
import {
  ORGAN_REGISTRY,
  REGISTRY_VERSION,
  type MarkerType,
  type OrganId,
} from "../lib/twins"
import {
  MAX_VIEWPORTS,
  collectLeaves,
  countLeaves,
  createPresetLayout,
  createWorkspaceId,
  isWorkspaceNode,
  joinSplit,
  removeLeaf,
  splitLeaf,
  updateLeafContext,
  updateSplitRatio,
  type ViewportLeaf,
  type ViewportSplit,
  type WorkspaceNode,
} from "../lib/workspaceLayout"

interface TwinViewportGridProps {
  activeOrgan: OrganId
  activeModelId: string
  patientId: string
  onActiveContextChange: (organ: OrganId, modelId: string) => void
  forecastDay: number
  finding: string
  markerType: MarkerType
  heartRate: number
  riskIndex: number
}

interface StoredWorkspace {
  registryVersion: string
  root: WorkspaceNode
  focusedLeafId: string
}

interface SplitRendererProps {
  node: WorkspaceNode
  workspaceRoot: WorkspaceNode
  focusedLeafId: string
  maximizedLeafId: string | null
  activeOrgan: OrganId
  forecastDay: number
  finding: string
  markerType: MarkerType
  heartRate: number
  riskIndex: number
  commandByLeaf: Record<string, CameraCommand>
  openMenuId: string | null
  dropLeafId: string | null
  onFocus: (leaf: ViewportLeaf) => void
  onDropOrgan: (leafId: string, organ: OrganId) => void
  onSplit: (leaf: ViewportLeaf, axis: "horizontal" | "vertical") => void
  onClose: (leaf: ViewportLeaf) => void
  onJoin: (splitId: string, keep: "first" | "second") => void
  onRatioChange: (splitId: string, ratio: number) => void
  onToggleMaximize: (leafId: string) => void
  onCameraCommand: (
    leafId: string,
    action: CameraCommand["action"],
    preset?: CameraPreset,
  ) => void
  onOpenMenu: (leafId: string | null) => void
  onDropHighlight: (leafId: string | null) => void
}

const STORAGE_PREFIX = "medtwin-blender-workspace"

function workspaceStorageKey(patientId: string) {
  return `${STORAGE_PREFIX}:${patientId}`
}

function readWorkspace(patientId: string): StoredWorkspace {
  const fallbackRoot = createPresetLayout(1)
  const fallbackLeaf = collectLeaves(fallbackRoot)[0]
  try {
    const stored = JSON.parse(
      localStorage.getItem(workspaceStorageKey(patientId)) ?? "null",
    ) as StoredWorkspace | null
    if (
      stored?.registryVersion === REGISTRY_VERSION &&
      isWorkspaceNode(stored.root) &&
      countLeaves(stored.root) <= MAX_VIEWPORTS &&
      collectLeaves(stored.root).some(
        (leaf) => leaf.id === stored.focusedLeafId,
      )
    ) {
      return stored
    }
  } catch {
    // Invalid persisted state is safely replaced below.
  }
  return {
    registryVersion: REGISTRY_VERSION,
    root: fallbackRoot,
    focusedLeafId: fallbackLeaf.id,
  }
}

function ModelStatusDot({
  status,
}: {
  status: "trained" | "scaffold" | "placeholder"
}) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${
        status === "trained"
          ? "bg-emerald-400 shadow-[0_0_7px_#34d399]"
          : status === "scaffold"
            ? "bg-amber-300 shadow-[0_0_7px_#fcd34d]"
            : "bg-slate-600"
      }`}
    />
  )
}

function ViewportCell({
  leaf,
  selected,
  maximized,
  activeOrgan,
  forecastDay,
  finding,
  markerType,
  heartRate,
  riskIndex,
  command,
  menuOpen,
  dropActive,
  canClose,
  canSplit,
  onFocus,
  onDropOrgan,
  onSplit,
  onClose,
  onToggleMaximize,
  onCameraCommand,
  onOpenMenu,
  onDropHighlight,
}: {
  leaf: ViewportLeaf
  selected: boolean
  maximized: boolean
  activeOrgan: OrganId
  forecastDay: number
  finding: string
  markerType: MarkerType
  heartRate: number
  riskIndex: number
  command?: CameraCommand
  menuOpen: boolean
  dropActive: boolean
  canClose: boolean
  canSplit: boolean
  onFocus: (leaf: ViewportLeaf) => void
  onDropOrgan: (leafId: string, organ: OrganId) => void
  onSplit: (leaf: ViewportLeaf, axis: "horizontal" | "vertical") => void
  onClose: (leaf: ViewportLeaf) => void
  onToggleMaximize: (leafId: string) => void
  onCameraCommand: (
    leafId: string,
    action: CameraCommand["action"],
    preset?: CameraPreset,
  ) => void
  onOpenMenu: (leafId: string | null) => void
  onDropHighlight: (leafId: string | null) => void
}) {
  const twin = ORGAN_REGISTRY[leaf.organ]
  const model =
    twin.models.find((item) => item.id === leaf.modelId) ?? twin.models[0]
  const activeResult = selected && leaf.organ === activeOrgan
  return (
    <section
      data-viewport-id={leaf.id}
      onPointerDown={() => onFocus(leaf)}
      onContextMenu={(event) => {
        event.preventDefault()
        onFocus(leaf)
        onOpenMenu(leaf.id)
      }}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("application/x-medtwin-organ"))
          onDropHighlight(leaf.id)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("application/x-medtwin-organ"))
          return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          onDropHighlight(null)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDropHighlight(null)
        const organ = event.dataTransfer.getData(
          "application/x-medtwin-organ",
        ) as OrganId
        if (organ in ORGAN_REGISTRY) onDropOrgan(leaf.id, organ)
      }}
      className={`relative h-full min-h-[180px] min-w-[200px] overflow-hidden bg-[#040a16] outline outline-1 -outline-offset-1 transition ${
        selected ? "z-10 outline-cyan-300/60" : "outline-white/[0.04]"
      } ${
        dropActive
          ? "outline-2 outline-cyan-200 shadow-[inset_0_0_38px_rgba(103,232,249,.12)]"
          : ""
      }`}
    >
      <XRayOrganViewer
        organ={leaf.organ}
        forecastDay={forecastDay}
        finding={activeResult ? finding : ""}
        markerType={activeResult ? markerType : "none"}
        heartRate={heartRate}
        riskIndex={riskIndex}
        interactive
        command={command}
      />

      <header className="absolute inset-x-0 top-0 z-30 flex h-9 items-center gap-2 border-b border-white/[0.07] bg-[#07101e]/82 px-2.5 backdrop-blur-xl">
        <ModelStatusDot status={model.status} />
        <span className="text-[10px] font-medium text-slate-200">
          {twin.shortName}
        </span>
        <span className="min-w-0 truncate text-[8px] text-slate-600">
          {model.name}
        </span>
        {selected ? (
          <span className="ml-auto flex items-center gap-1 rounded bg-cyan-300/10 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.12em] text-cyan-200">
            <ScanLine size={8} /> Focus
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <button
          type="button"
          aria-label={maximized ? "Restore viewport" : "Maximize viewport"}
          title="Maximize/restore (Ctrl+Space)"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onToggleMaximize(leaf.id)}
          className="grid h-6 w-6 place-items-center rounded text-slate-600 hover:bg-white/[0.06] hover:text-slate-300"
        >
          {maximized ? <Square size={11} /> : <Maximize2 size={11} />}
        </button>
        <button
          type="button"
          aria-label="Viewport actions"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onOpenMenu(menuOpen ? null : leaf.id)}
          className="grid h-6 w-6 place-items-center rounded text-slate-600 hover:bg-white/[0.06] hover:text-slate-300"
        >
          <MoreHorizontal size={13} />
        </button>
      </header>

      <div className="absolute left-2 top-11 z-20 flex gap-1 rounded-lg border border-white/[0.07] bg-slate-950/65 p-1 backdrop-blur-lg">
        {([
          "anterior",
          "posterior",
          "lateral",
          "superior",
          "cross-section",
        ] as CameraPreset[]).map((preset) => (
          <button
            key={preset}
            type="button"
            title={preset}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onCameraCommand(leaf.id, "preset", preset)}
            className="rounded px-1.5 py-1 text-[7px] uppercase text-slate-600 hover:bg-cyan-300/10 hover:text-cyan-200"
          >
            {preset === "cross-section" ? "X" : preset.slice(0, 1)}
          </button>
        ))}
        <button
          type="button"
          title="Reset view (R)"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onCameraCommand(leaf.id, "reset")}
          className="rounded px-1.5 py-1 text-[7px] uppercase text-slate-600 hover:bg-cyan-300/10 hover:text-cyan-200"
        >
          Reset
        </button>
      </div>

      {menuOpen ? (
        <div
          className="absolute right-2 top-10 z-50 w-40 rounded-xl border border-white/10 bg-[#0a1423]/98 p-1.5 shadow-2xl"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            disabled={!canSplit}
            onClick={() => onSplit(leaf, "horizontal")}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[9px] text-slate-400 hover:bg-white/[0.05] disabled:text-slate-700"
          >
            <Columns2 size={11} /> Split left / right
          </button>
          <button
            type="button"
            disabled={!canSplit}
            onClick={() => onSplit(leaf, "vertical")}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[9px] text-slate-400 hover:bg-white/[0.05] disabled:text-slate-700"
          >
            <Rows2 size={11} /> Split top / bottom
          </button>
          <button
            type="button"
            onClick={() => onToggleMaximize(leaf.id)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[9px] text-slate-400 hover:bg-white/[0.05]"
          >
            <Focus size={11} /> {maximized ? "Restore area" : "Maximize area"}
          </button>
          <button
            type="button"
            disabled={!canClose}
            onClick={() => onClose(leaf)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[9px] text-rose-300/70 hover:bg-rose-300/[0.06] disabled:text-slate-700"
          >
            <X size={11} /> Join / close area
          </button>
        </div>
      ) : null}

      {dropActive ? (
        <div className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-xl border border-dashed border-cyan-200/60 bg-cyan-300/[0.08] text-[10px] uppercase tracking-[0.17em] text-cyan-100">
          Load into this area
        </div>
      ) : null}
    </section>
  )
}

function SplitRenderer(props: SplitRendererProps) {
  const { node } = props
  if (node.kind === "leaf") {
    const totalLeaves = countLeaves(props.workspaceRoot)
    return (
      <ViewportCell
        leaf={node}
        selected={props.focusedLeafId === node.id}
        maximized={props.maximizedLeafId === node.id}
        activeOrgan={props.activeOrgan}
        forecastDay={props.forecastDay}
        finding={props.finding}
        markerType={props.markerType}
        heartRate={props.heartRate}
        riskIndex={props.riskIndex}
        command={props.commandByLeaf[node.id]}
        menuOpen={props.openMenuId === node.id}
        dropActive={props.dropLeafId === node.id}
        canClose={totalLeaves > 1}
        canSplit={totalLeaves < MAX_VIEWPORTS}
        onFocus={props.onFocus}
        onDropOrgan={props.onDropOrgan}
        onSplit={props.onSplit}
        onClose={props.onClose}
        onToggleMaximize={props.onToggleMaximize}
        onCameraCommand={props.onCameraCommand}
        onOpenMenu={props.onOpenMenu}
        onDropHighlight={props.onDropHighlight}
      />
    )
  }

  return <SplitArea {...props} node={node} />
}

function SplitArea(props: SplitRendererProps & { node: ViewportSplit }) {
  const { node } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const horizontal = node.axis === "horizontal"
  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const bounds = container.getBoundingClientRect()
    const move = (pointer: PointerEvent) => {
      const pixels = horizontal
        ? pointer.clientX - bounds.left
        : pointer.clientY - bounds.top
      const total = horizontal ? bounds.width : bounds.height
      const minimum = Math.min(45, (200 / Math.max(1, total)) * 100)
      props.onRatioChange(
        node.id,
        Math.min(100 - minimum, Math.max(minimum, (pixels / total) * 100)),
      )
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      document.body.style.cursor = ""
    }
    document.body.style.cursor = horizontal ? "col-resize" : "row-resize"
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
  }
  const startJoin = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const start = horizontal ? event.clientX : event.clientY
    document.body.style.cursor = horizontal ? "ew-resize" : "ns-resize"
    const stop = (pointer: PointerEvent) => {
      const delta = (horizontal ? pointer.clientX : pointer.clientY) - start
      document.body.style.cursor = ""
      window.removeEventListener("pointerup", stop)
      if (Math.abs(delta) < 24) return
      props.onJoin(node.id, delta < 0 ? "second" : "first")
    }
    window.addEventListener("pointerup", stop)
  }
  const childProps = { ...props }
  return (
    <div
      ref={containerRef}
      className={`relative flex h-full min-h-0 min-w-0 ${
        horizontal ? "flex-row" : "flex-col"
      }`}
    >
      <div
        className="min-h-0 min-w-0"
        style={{
          [horizontal ? "width" : "height"]: `${node.ratio}%`,
          [horizontal ? "height" : "width"]: "100%",
        }}
      >
        <SplitRenderer {...childProps} node={node.first} />
      </div>
      <button
        type="button"
        aria-label={`Resize ${horizontal ? "horizontal" : "vertical"} areas`}
        title="Drag to resize · Ctrl+drag toward a side to join"
        onPointerDown={(event) => {
          if (event.ctrlKey || event.metaKey) {
            startJoin(event)
          } else {
            startResize(event)
          }
        }}
        className={`group relative z-40 shrink-0 bg-cyan-300/10 hover:bg-cyan-300/35 ${
          horizontal ? "w-px cursor-col-resize" : "h-px cursor-row-resize"
        }`}
      >
        <span
          className={`absolute rounded-full bg-cyan-200/60 opacity-0 shadow-[0_0_8px_#67e8f9] transition-opacity group-hover:opacity-100 ${
            horizontal
              ? "left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2"
              : "left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2"
          }`}
        />
      </button>
      <div className="min-h-0 min-w-0 flex-1">
        <SplitRenderer {...childProps} node={node.second} />
      </div>
    </div>
  )
}

export default function TwinViewportGrid({
  activeOrgan,
  activeModelId,
  patientId,
  onActiveContextChange,
  forecastDay,
  finding,
  markerType,
  heartRate,
  riskIndex,
}: TwinViewportGridProps) {
  const [workspace, setWorkspace] = useState(() => readWorkspace(patientId))
  const [maximizedLeafId, setMaximizedLeafId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [dropLeafId, setDropLeafId] = useState<string | null>(null)
  const [commandByLeaf, setCommandByLeaf] =
    useState<Record<string, CameraCommand>>({})
  const commandSequence = useRef(0)

  useEffect(() => {
    const next = readWorkspace(patientId)
    setWorkspace(next)
    setMaximizedLeafId(null)
    const focused =
      collectLeaves(next.root).find((leaf) => leaf.id === next.focusedLeafId) ??
      collectLeaves(next.root)[0]
    onActiveContextChange(focused.organ, focused.modelId)
  }, [patientId, onActiveContextChange])

  useEffect(() => {
    localStorage.setItem(
      workspaceStorageKey(patientId),
      JSON.stringify(workspace),
    )
  }, [patientId, workspace])

  useEffect(() => {
    setWorkspace((current) => ({
      ...current,
      root: updateLeafContext(
        current.root,
        current.focusedLeafId,
        activeOrgan,
        activeModelId,
      ),
    }))
  }, [activeModelId, activeOrgan])

  const leaves = useMemo(() => collectLeaves(workspace.root), [workspace.root])
  const focusedLeaf =
    leaves.find((leaf) => leaf.id === workspace.focusedLeafId) ?? leaves[0]

  const focusLeaf = useCallback(
    (leaf: ViewportLeaf) => {
      setWorkspace((current) => ({ ...current, focusedLeafId: leaf.id }))
      onActiveContextChange(leaf.organ, leaf.modelId)
    },
    [onActiveContextChange],
  )

  const cameraCommand = useCallback(
    (
      leafId: string,
      action: CameraCommand["action"],
      preset?: CameraPreset,
    ) => {
      commandSequence.current += 1
      setCommandByLeaf((current) => ({
        ...current,
        [leafId]: { id: commandSequence.current, action, preset },
      }))
    },
    [],
  )

  const toggleMaximize = useCallback((leafId: string) => {
    setMaximizedLeafId((current) => (current === leafId ? null : leafId))
    setOpenMenuId(null)
  }, [])

  useEffect(() => {
    const handleCommand = (event: Event) => {
      const detail = (event as CustomEvent<{
        action: "toggle-maximize" | "reset-camera"
      }>).detail
      if (detail.action === "toggle-maximize")
        toggleMaximize(workspace.focusedLeafId)
      if (detail.action === "reset-camera")
        cameraCommand(workspace.focusedLeafId, "reset")
    }
    window.addEventListener("medtwin:workspace-command", handleCommand)
    return () =>
      window.removeEventListener("medtwin:workspace-command", handleCommand)
  }, [cameraCommand, toggleMaximize, workspace.focusedLeafId])

  const loadOrgan = (leafId: string, organ: OrganId) => {
    const modelId = ORGAN_REGISTRY[organ].models[0].id
    setWorkspace((current) => ({
      ...current,
      focusedLeafId: leafId,
      root: updateLeafContext(current.root, leafId, organ, modelId),
    }))
    onActiveContextChange(organ, modelId)
  }

  const split = (leaf: ViewportLeaf, axis: "horizontal" | "vertical") => {
    if (leaves.length >= MAX_VIEWPORTS) return
    const nextOrgan = (Object.keys(ORGAN_REGISTRY) as OrganId[])[
      leaves.length % Object.keys(ORGAN_REGISTRY).length
    ]
    const newLeafId = createWorkspaceId("leaf")
    setWorkspace((current) => ({
      ...current,
      focusedLeafId: newLeafId,
      root: splitLeaf(current.root, leaf.id, axis, nextOrgan, newLeafId),
    }))
    setOpenMenuId(null)
    onActiveContextChange(nextOrgan, ORGAN_REGISTRY[nextOrgan].models[0].id)
  }

  const closeLeaf = (leaf: ViewportLeaf) => {
    if (leaves.length <= 1) return
    setWorkspace((current) => {
      const root = removeLeaf(current.root, leaf.id) ?? createPresetLayout(1)
      const nextFocused = collectLeaves(root)[0]
      queueMicrotask(() =>
        onActiveContextChange(nextFocused.organ, nextFocused.modelId),
      )
      return { ...current, root, focusedLeafId: nextFocused.id }
    })
    setMaximizedLeafId(null)
    setOpenMenuId(null)
  }

  const applyPreset = (count: 1 | 2 | 4 | 6) => {
    const root = createPresetLayout(count)
    const nextFocused = collectLeaves(root)[0]
    setWorkspace({
      registryVersion: REGISTRY_VERSION,
      root,
      focusedLeafId: nextFocused.id,
    })
    setMaximizedLeafId(null)
    onActiveContextChange(nextFocused.organ, nextFocused.modelId)
  }

  const maximizedLeaf = maximizedLeafId
    ? (leaves.find((leaf) => leaf.id === maximizedLeafId) ?? null)
    : null
  const rendererProps: SplitRendererProps = {
    node: maximizedLeaf ?? workspace.root,
    workspaceRoot: workspace.root,
    focusedLeafId: workspace.focusedLeafId,
    maximizedLeafId,
    activeOrgan,
    forecastDay,
    finding,
    markerType,
    heartRate,
    riskIndex,
    commandByLeaf,
    openMenuId,
    dropLeafId,
    onFocus: focusLeaf,
    onDropOrgan: loadOrgan,
    onSplit: split,
    onClose: closeLeaf,
    onJoin: (splitId, keep) =>
      setWorkspace((current) => {
        const root = joinSplit(current.root, splitId, keep)
        const remaining = collectLeaves(root)
        const nextFocused =
          remaining.find((leaf) => leaf.id === current.focusedLeafId) ??
          remaining[0]
        queueMicrotask(() =>
          onActiveContextChange(nextFocused.organ, nextFocused.modelId),
        )
        return { ...current, root, focusedLeafId: nextFocused.id }
      }),
    onRatioChange: (splitId, ratio) =>
      setWorkspace((current) => ({
        ...current,
        root: updateSplitRatio(current.root, splitId, ratio),
      })),
    onToggleMaximize: toggleMaximize,
    onCameraCommand: cameraCommand,
    onOpenMenu: setOpenMenuId,
    onDropHighlight: setDropLeafId,
  }

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-[#030815]"
      onPointerDown={() => openMenuId && setOpenMenuId(null)}
    >
      <div className="absolute bottom-3 right-3 z-[60] flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/75 p-1 shadow-2xl backdrop-blur-xl">
        {([1, 2, 4, 6] as const).map((count) => (
          <button
            key={count}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => applyPreset(count)}
            title={`${count} area preset`}
            className={`grid h-7 min-w-7 place-items-center rounded-lg px-1.5 font-mono text-[8px] transition ${
              leaves.length === count && !maximizedLeafId
                ? "bg-cyan-300/15 text-cyan-200"
                : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
            }`}
          >
            {count === 1 ? (
              <Maximize2 size={12} />
            ) : count === 2 ? (
              <Rows2 size={12} />
            ) : count === 4 ? (
              <Grid2X2 size={12} />
            ) : (
              `6×`
            )}
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-white/10" />
        <span className="pr-2 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
          {maximizedLeafId ? "1 visible" : `${leaves.length} areas`} · per-cell
          WebGL
        </span>
      </div>
      {focusedLeaf ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[60] rounded-full border border-white/[0.08] bg-slate-950/65 px-2.5 py-1 font-mono text-[8px] text-slate-600">
          Focused:{" "}
          <span className="text-slate-300">
            {ORGAN_REGISTRY[focusedLeaf.organ].shortName}
          </span>{" "}
          · Ctrl+Space maximize · R reset
        </div>
      ) : null}
      <SplitRenderer {...rendererProps} />
    </div>
  )
}
