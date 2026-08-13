import { useState } from "react"
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock3,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { FORECAST_POINTS } from "../lib/clinicalData"
import { SIGNAL_FIXTURES } from "../lib/signalFixtures"
import { ORGAN_REGISTRY, type OrganId } from "../lib/twins"
import { SignalPanel } from "./SignalPanel"
import { AdvancedCardioAnalytics } from "./AdvancedCardioAnalytics"
import { AdvancedNeuroAnalytics } from "./AdvancedNeuroAnalytics"

interface ClinicalDockProps {
  organId: OrganId
  day: number
  onDayChange: (day: number) => void
}

export default function ClinicalDock({
  organId,
  day,
  onDayChange,
}: ClinicalDockProps) {
  const [tab, setTab] = useState<"forecast" | "signals" | "analytics">(
    "forecast",
  )
  const [expanded, setExpanded] = useState(false)
  const signalIds = ORGAN_REGISTRY[organId].signalPanels
  const risk =
    FORECAST_POINTS.find((point) => point.day >= day)?.projected ?? 97

  return (
    <section
      className={`flex flex-none flex-col border-t border-cyan-300/10 bg-[#07101e]/95 shadow-[0_-16px_48px_rgba(0,0,0,.28)] transition-[height] duration-300 ${
        expanded ? "h-[310px]" : "h-[188px]"
      }`}
    >
      <div className="flex h-10 shrink-0 items-center border-b border-white/[0.055] px-3">
        <div className="flex h-full items-center gap-1">
          {[
            { id: "forecast" as const, label: "Risk forecast", icon: Clock3 },
            { id: "signals" as const, label: "Signals", icon: Activity },
            { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex h-full items-center gap-1.5 border-b px-3 text-[9px] uppercase tracking-[0.14em] transition ${
                tab === id
                  ? "border-cyan-300 text-cyan-200"
                  : "border-transparent text-slate-600 hover:text-slate-400"
              }`}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[9px] text-slate-600 sm:block">
            Projected risk{" "}
            <strong
              className={
                risk >= 70
                  ? "text-rose-300"
                  : risk >= 40
                    ? "text-amber-200"
                    : "text-cyan-200"
              }
            >
              {risk}%
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={
              expanded ? "Collapse clinical dock" : "Expand clinical dock"
            }
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {tab === "forecast" ? (
          <div className="grid h-full grid-cols-[minmax(0,1fr)_230px] gap-4 p-3 max-md:grid-cols-1">
            <div className="min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={FORECAST_POINTS}
                  margin={{ top: 4, right: 8, left: -26, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="riskFill" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#2dd4bf" stopOpacity="0.18" />
                      <stop
                        offset="0.55"
                        stopColor="#fbbf24"
                        stopOpacity="0.16"
                      />
                      <stop offset="1" stopColor="#fb7185" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(148,163,184,.07)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) =>
                      value === 0 ? "Now" : `+${value}d`
                    }
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#475569", fontSize: 8 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#07101e",
                      border: "1px solid rgba(103,232,249,.16)",
                      borderRadius: 10,
                      fontSize: 10,
                    }}
                    labelFormatter={(value) => `Day ${value}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="high"
                    stroke="none"
                    fill="url(#riskFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="low"
                    stroke="none"
                    fill="#07101e"
                  />
                  <Line
                    type="monotone"
                    dataKey="observed"
                    connectNulls={false}
                    stroke="#67e8f9"
                    strokeWidth={2}
                    dot={{ r: 2, fill: "#67e8f9" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="#fb7185"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex min-h-0 flex-col justify-center rounded-xl border border-white/[0.06] bg-slate-950/35 p-3 max-md:hidden">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                  Forecast horizon
                </span>
                <span className="font-mono text-[10px] text-white">
                  Day +{day}
                </span>
              </div>
              <input
                className="mt-3"
                type="range"
                min={0}
                max={14}
                step={1}
                value={day}
                onChange={(event) => onDayChange(Number(event.target.value))}
                aria-label="Forecast day"
              />
              <div className="mt-3 text-[9px] leading-relaxed text-slate-500">
                {day <= 2
                  ? "Observed baseline is stable. Projection begins after the available history window."
                  : day < 8
                    ? "Projected risk is rising; confidence widens as the horizon increases."
                    : "High-risk simulated trajectory. This trend is illustrative and not a tissue-spread prediction."}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[8px]">
                <span className="flex items-center gap-1 text-cyan-300">
                  <i className="h-px w-3 bg-cyan-300" />
                  Observed
                </span>
                <span className="flex items-center gap-1 text-rose-300">
                  <i className="h-px w-3 border-t border-dashed border-rose-300" />
                  Projected
                </span>
                <span className="text-slate-600">
                  Band = confidence interval
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "signals" ? (
          <div className="grid h-full auto-cols-[minmax(230px,1fr)] grid-flow-col gap-3 overflow-x-auto p-3">
            {signalIds.map((id) =>
              SIGNAL_FIXTURES[id] ? (
                <SignalPanel key={id} trace={SIGNAL_FIXTURES[id]} />
              ) : null,
            )}
          </div>
        ) : null}

        {tab === "analytics" ? (
          <div className="h-full w-full p-2">
            {organId === "heart" ? (
              <AdvancedCardioAnalytics riskScore={risk} />
            ) : organId === "brain" ? (
              <AdvancedNeuroAnalytics riskScore={risk} />
            ) : (
              <div className="grid h-full grid-cols-4 gap-3 max-md:grid-cols-2">
                {[
                  ["Active twins", "9", "5 model-capable"],
                  ["Context isolation", "100%", "patient · organ · model"],
                  ["Median latency", "184 ms", "prototype gateway"],
                  ["Synthetic sources", "12", "visibly labeled"],
                ].map(([label, value, note]) => (
                  <div
                    key={label}
                    className="flex min-h-0 flex-col justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-4"
                  >
                    <div className="text-[8px] uppercase tracking-[0.16em] text-slate-600">
                      {label}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {value}
                    </div>
                    <div className="mt-0.5 text-[8px] text-slate-600">{note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
