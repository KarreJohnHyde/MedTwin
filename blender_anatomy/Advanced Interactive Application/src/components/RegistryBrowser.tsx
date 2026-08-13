import { useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Database,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import { ORGAN_REGISTRY, type ModelStatus, type OrganId } from "../lib/twins"

interface RegistryBrowserProps {
  activeOrgan: OrganId
  onSelect: (organ: OrganId) => void
}

const statusIcon = {
  trained: CheckCircle2,
  scaffold: CircleDot,
  placeholder: AlertCircle,
}

const statusCopy: Record<ModelStatus, string> = {
  trained: "Trained",
  scaffold: "Scaffold",
  placeholder: "Not trained",
}

export default function RegistryBrowser({
  activeOrgan,
  onSelect,
}: RegistryBrowserProps) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | ModelStatus>("all")

  const twins = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return Object.values(ORGAN_REGISTRY).filter((twin) => {
      const matchesQuery =
        normalized.length === 0 ||
        twin.displayName.toLowerCase().includes(normalized) ||
        twin.shortName.toLowerCase().includes(normalized) ||
        twin.bodySystem.includes(normalized)
      const matchesStatus =
        status === "all" || twin.models.some((model) => model.status === status)
      return matchesQuery && matchesStatus
    })
  }, [query, status])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.06] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="text-cyan-300" size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
              Twin registry
            </span>
          </div>
          <span className="font-mono text-[9px] text-slate-600">
            {Object.keys(ORGAN_REGISTRY).length} systems
          </span>
        </div>
        <label className="relative block">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600"
            size={13}
          />
          <span className="sr-only">Search organ twins</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search organs or systems"
            className="h-9 w-full rounded-lg border border-white/[0.07] bg-slate-950/70 pl-8 pr-3 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/35"
          />
        </label>
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <SlidersHorizontal
            className="mr-1 shrink-0 text-slate-600"
            size={12}
          />
          {(["all", "trained", "scaffold", "placeholder"] as const).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`shrink-0 rounded-md px-2 py-1 text-[9px] capitalize transition ${
                  status === item
                    ? "bg-cyan-300/12 text-cyan-200"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                }`}
              >
                {item === "all" ? "All" : statusCopy[item]}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {twins.map((twin) => {
          const model = twin.models[0]
          const StatusIcon = statusIcon[model.status]
          const selected = activeOrgan === twin.id
          return (
            <button
              key={twin.id}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/x-medtwin-organ",
                  twin.id,
                )
                event.dataTransfer.effectAllowed = "copy"
              }}
              onClick={() => onSelect(twin.id as OrganId)}
              className={`group w-full rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-cyan-300/35 bg-cyan-300/[0.08] shadow-[inset_3px_0_0_rgba(103,232,249,.75)]"
                  : "border-transparent bg-white/[0.018] hover:border-white/[0.08] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-slate-950/55 font-mono text-sm"
                  style={{ color: twin.accent }}
                >
                  {twin.shortName.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[12px] font-medium text-slate-200">
                      {twin.displayName}
                    </div>
                    <StatusIcon
                      className={
                        model.status === "trained"
                          ? "text-emerald-400"
                          : model.status === "scaffold"
                            ? "text-amber-300"
                            : "text-slate-600"
                      }
                      size={13}
                    />
                  </div>
                  <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em] text-slate-600">
                    {twin.bodySystem}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
                <span className="truncate text-[9px] text-slate-500">
                  {model.name}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wider ${
                    model.status === "trained"
                      ? "bg-emerald-400/10 text-emerald-300"
                      : model.status === "scaffold"
                        ? "bg-amber-300/10 text-amber-200"
                        : "bg-slate-700/30 text-slate-500"
                  }`}
                >
                  {statusCopy[model.status]}
                </span>
              </div>
            </button>
          )
        })}
        {twins.length === 0 ? (
          <div className="px-3 py-10 text-center text-[11px] text-slate-600">
            No registry entries match these filters.
          </div>
        ) : null}
      </div>
      <div className="border-t border-white/[0.06] px-3 py-2 text-center text-[9px] text-slate-600">
        Click to load · drag into a viewport
      </div>
    </div>
  )
}
