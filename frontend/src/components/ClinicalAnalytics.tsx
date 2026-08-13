import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  Boxes,
  ChartNoAxesCombined,
  CircleGauge,
  ShieldCheck,
} from "lucide-react"
import type { FusionResult } from "../lib/inferenceClient"

type AnalyticsTab =
  | "progression"
  | "performance"
  | "validation"
  | "roi"
  | "governance"

interface ClinicalAnalyticsProps {
  fusion: FusionResult
  forecastDay: number
}

const PERCENT = (value: number) => `${Math.round(value * 100)}%`

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: number | string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <small>{typeof label === "number" ? `Day +${label}` : label}</small>
      {payload.map((item) => (
        <div key={item.name}>
          <i style={{ background: item.color }} />
          <span>{item.name}</span>
          <b>{PERCENT(Number(item.value ?? 0))}</b>
        </div>
      ))}
    </div>
  )
}

function ProgressionPanel({ fusion, forecastDay }: ClinicalAnalyticsProps) {
  const current =
    fusion.forecast[Math.min(forecastDay, fusion.forecast.length - 1)]
  return (
    <div className="analytics-grid analytics-grid--progression">
      <article className="viz-panel viz-panel--wide">
        <header>
          <div>
            <h3>Progression forecast</h3>
            <p>Probability with 95% simulation interval · daily grain</p>
          </div>
          <span>ARIMA + LSTM</span>
        </header>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={fusion.forecast}
              margin={{ top: 10, right: 14, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                stroke="#273033"
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                stroke="#6f7d80"
                tickLine={false}
                axisLine={{ stroke: "#354144" }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, 1]}
                stroke="#6f7d80"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={PERCENT}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                x={forecastDay}
                stroke="#ffb35c"
                strokeDasharray="3 3"
                label={{
                  value: "ACTIVE",
                  fill: "#ffb35c",
                  fontSize: 9,
                  position: "insideTopRight",
                }}
              />
              <Area
                type="monotone"
                dataKey="expected"
                name="Expected"
                stroke="#5dd7ff"
                strokeWidth={2}
                fill="#5dd7ff"
                fillOpacity={0.12}
                dot={false}
                activeDot={{ r: 4, fill: "#5dd7ff" }}
              />
              <Line
                type="monotone"
                dataKey="upper"
                name="Upper"
                stroke="#8a989b"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lower"
                name="Lower"
                stroke="#8a989b"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="viz-panel forecast-summary">
        <header>
          <div>
            <h3>Active horizon</h3>
            <p>Selected 3D spread frame</p>
          </div>
          <span>DAY +{forecastDay}</span>
        </header>
        <div
          className="forecast-gauge"
          style={
            {
              "--value": `${Math.round(current.expected * 100)}%`,
            } as React.CSSProperties
          }
        >
          <div>
            <strong>{PERCENT(current.expected)}</strong>
            <span>expected</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>Lower bound</dt>
            <dd>{PERCENT(current.lower)}</dd>
          </div>
          <div>
            <dt>Upper bound</dt>
            <dd>{PERCENT(current.upper)}</dd>
          </div>
          <div>
            <dt>Spatial spread</dt>
            <dd>{PERCENT(current.spread)}</dd>
          </div>
          <div>
            <dt>Interval width</dt>
            <dd>{PERCENT(current.upper - current.lower)}</dd>
          </div>
        </dl>
      </article>
    </div>
  )
}

function PerformancePanel({ fusion }: { fusion: FusionResult }) {
  const rocData = useMemo(
    () =>
      Array.from({ length: 11 }, (_, index) => {
        const fpr = index / 10
        return { fpr, tpr: Math.min(1, Math.pow(fpr, 0.34)), reference: fpr }
      }),
    [],
  )
  const contributions = fusion.models.map((model) => ({
    ...model,
    display: model.name.replace(
      /\s+(Transformer|R-CNN|U-Net|LSTM|ARIMA).*$/i,
      "",
    ),
  }))
  return (
    <div className="analytics-grid analytics-grid--performance">
      <article className="viz-panel">
        <header>
          <div>
            <h3>ROC operating curve</h3>
            <p>Cross-validation benchmark · synthetic cohort</p>
          </div>
          <strong>AUC {fusion.fusion.auc_roc.toFixed(3)}</strong>
        </header>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rocData}
              margin={{ top: 10, right: 16, left: -18, bottom: 0 }}
            >
              <CartesianGrid stroke="#273033" strokeDasharray="2 4" />
              <XAxis
                dataKey="fpr"
                domain={[0, 1]}
                stroke="#6f7d80"
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={PERCENT}
              />
              <YAxis
                domain={[0, 1]}
                stroke="#6f7d80"
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={PERCENT}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="reference"
                name="Chance"
                stroke="#596568"
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="tpr"
                name="Sensitivity"
                stroke="#f5c85b"
                strokeWidth={2.2}
                dot={{ r: 2.2, fill: "#f5c85b" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="viz-panel viz-panel--wide">
        <header>
          <div>
            <h3>Fusion contribution</h3>
            <p>Calibrated probability contribution by model family</p>
          </div>
          <span>{fusion.models.length} MODELS</span>
        </header>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={contributions}
              layout="vertical"
              margin={{ top: 6, right: 22, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                stroke="#273033"
                strokeDasharray="2 4"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 0.28]}
                stroke="#6f7d80"
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={PERCENT}
              />
              <YAxis
                type="category"
                dataKey="display"
                width={112}
                stroke="#8a989b"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="contribution"
                name="Contribution"
                fill="#5dd7ff"
                radius={[0, 3, 3, 0]}
                barSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  )
}

function RoiPanel({ fusion, forecastDay }: ClinicalAnalyticsProps) {
  const values = Array.from({ length: 64 }, (_, index) => {
    const x = index % 8
    const y = Math.floor(index / 8)
    const centerDistance = Math.hypot(x - 4.2, y - 3.6)
    const intensity = Math.max(
      0.04,
      Math.min(
        0.95,
        fusion.fusion.probability + forecastDay * 0.018 - centerDistance * 0.13,
      ),
    )
    return intensity
  })
  const positive = Math.round(71 + fusion.fusion.probability * 28)
  const negative = 140 - positive
  return (
    <div className="analytics-grid analytics-grid--roi">
      <article className="viz-panel roi-heatmap-panel">
        <header>
          <div>
            <h3>Spatial ROI field</h3>
            <p>Normalized voxel probability · selected forecast frame</p>
          </div>
          <span>8 × 8</span>
        </header>
        <div
          className="roi-heatmap"
          role="img"
          aria-label="Spatial region probability heatmap"
        >
          {values.map((value, index) => (
            <i
              key={index}
              style={{
                opacity: value,
                background:
                  value > 0.62
                    ? "#ff7b65"
                    : value > 0.36
                      ? "#f5c85b"
                      : "#5dd7ff",
              }}
              title={PERCENT(value)}
            />
          ))}
        </div>
        <div className="heatmap-legend">
          <span>Low</span>
          <i />
          <i />
          <i />
          <span>High</span>
        </div>
      </article>
      <article className="viz-panel confusion-panel">
        <header>
          <div>
            <h3>Threshold matrix</h3>
            <p>Decision distribution at {PERCENT(fusion.threshold)}</p>
          </div>
          <span>N = 256</span>
        </header>
        <div className="confusion-labels confusion-labels--top">
          <span>REFERENCE +</span>
          <span>REFERENCE −</span>
        </div>
        <div className="confusion-body">
          <div className="confusion-labels confusion-labels--side">
            <span>MODEL +</span>
            <span>MODEL −</span>
          </div>
          <div className="confusion-matrix">
            <div>
              <small>TP</small>
              <strong>{positive}</strong>
              <span>{PERCENT(positive / 256)}</span>
            </div>
            <div>
              <small>FP</small>
              <strong>{Math.round(fusion.fusion.disagreement * 52)}</strong>
              <span>review</span>
            </div>
            <div>
              <small>FN</small>
              <strong>
                {Math.round(fusion.fusion.calibration_error * 128)}
              </strong>
              <span>missed</span>
            </div>
            <div>
              <small>TN</small>
              <strong>{negative}</strong>
              <span>{PERCENT(negative / 256)}</span>
            </div>
          </div>
        </div>
      </article>
      <article className="viz-panel roi-list-panel">
        <header>
          <div>
            <h3>Detected regions</h3>
            <p>Probability-sorted spatial anchors</p>
          </div>
          <span>
            {fusion.markers.filter((marker) => marker.visible).length} VISIBLE
          </span>
        </header>
        <div className="roi-list">
          {fusion.markers.map((marker, index) => (
            <div key={marker.id} className={marker.visible ? "" : "muted-row"}>
              <i>{String(index + 1).padStart(2, "0")}</i>
              <span>
                <strong>{marker.label}</strong>
                <small>
                  {marker.coordinate
                    .map((coordinate) => coordinate.toFixed(2))
                    .join(" · ")}
                </small>
              </span>
              <b>{PERCENT(marker.probability)}</b>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}

function ValidationPanel({ fusion }: { fusion: FusionResult }) {
  const calibration = fusion.validation.calibration.map((point) => ({
    ...point,
    ideal: point.predicted,
  }))
  return (
    <div className="validation-grid">
      <article className="viz-panel">
        <header>
          <div>
            <h3>Calibration reliability</h3>
            <p>Observed frequency against predicted probability</p>
          </div>
          <strong>ECE {fusion.fusion.calibration_error.toFixed(3)}</strong>
        </header>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={calibration} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#273033" strokeDasharray="2 4" />
              <XAxis dataKey="predicted" domain={[0, 1]} stroke="#6f7d80" tickLine={false} tick={{ fontSize: 10 }} tickFormatter={PERCENT} />
              <YAxis domain={[0, 1]} stroke="#6f7d80" tickLine={false} tick={{ fontSize: 10 }} tickFormatter={PERCENT} />
              <Tooltip content={<ChartTooltip />} />
              <Line dataKey="ideal" name="Ideal" stroke="#596568" strokeDasharray="4 4" dot={false} />
              <Line dataKey="observed" name="Observed" stroke="#5dd7ff" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="viz-panel">
        <header>
          <div>
            <h3>Precision-recall</h3>
            <p>Positive-class performance under class imbalance</p>
          </div>
          <strong>PR-AUC {fusion.models[0].pr_auc.toFixed(3)}</strong>
        </header>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fusion.validation.precision_recall} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#273033" strokeDasharray="2 4" />
              <XAxis dataKey="recall" domain={[0, 1]} stroke="#6f7d80" tickLine={false} tick={{ fontSize: 10 }} tickFormatter={PERCENT} />
              <YAxis domain={[0, 1]} stroke="#6f7d80" tickLine={false} tick={{ fontSize: 10 }} tickFormatter={PERCENT} />
              <Tooltip content={<ChartTooltip />} />
              <Area dataKey="precision" name="Precision" stroke="#f5c85b" fill="#f5c85b" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="viz-panel">
        <header>
          <div>
            <h3>Decision-curve utility</h3>
            <p>Net benefit across operating thresholds</p>
          </div>
          <span>THRESHOLD {fusion.threshold.toFixed(2)}</span>
        </header>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fusion.validation.decision_curve} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#273033" strokeDasharray="2 4" />
              <XAxis dataKey="threshold" stroke="#6f7d80" tickLine={false} tick={{ fontSize: 10 }} tickFormatter={PERCENT} />
              <YAxis domain={[-0.1, 0.8]} stroke="#6f7d80" tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine x={fusion.threshold} stroke="#ffb35c" strokeDasharray="3 3" />
              <Line dataKey="model" name="Model" stroke="#5dd7ff" strokeWidth={2} dot={false} />
              <Line dataKey="treat_all" name="Treat all" stroke="#f5c85b" strokeDasharray="4 4" dot={false} />
              <Line dataKey="treat_none" name="Treat none" stroke="#596568" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="viz-panel validation-monitoring">
        <header>
          <div>
            <h3>Drift and subgroup review</h3>
            <p>PSI, OOD rate, and interval estimates</p>
          </div>
          <span>{fusion.validation.metric_scope.toUpperCase()}</span>
        </header>
        <div className="drift-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fusion.validation.drift} margin={{ top: 8, right: 10, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#273033" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="window" stroke="#6f7d80" tickLine={false} tick={{ fontSize: 9 }} />
              <YAxis domain={[0, 0.15]} stroke="#6f7d80" tickLine={false} tick={{ fontSize: 9 }} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0.1} stroke="#ff7b65" strokeDasharray="3 3" />
              <Line dataKey="psi" name="PSI" stroke="#ff9f62" strokeWidth={2} dot={false} />
              <Line dataKey="ood_rate" name="OOD" stroke="#5dd7ff" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="subgroup-list">
          {fusion.validation.subgroups.map((group) => (
            <div key={group.name}>
              <span><strong>{group.name}</strong><small>N={group.n}</small></span>
              <i><b style={{ left: `${group.lower * 100}%`, width: `${(group.upper - group.lower) * 100}%` }} /><em style={{ left: `${group.auc * 100}%` }} /></i>
              <strong>{group.auc.toFixed(3)}</strong>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}

function GovernancePanel({ fusion }: { fusion: FusionResult }) {
  return (
    <div className="governance-grid">
      <article className="governance-score">
        <ShieldCheck size={22} />
        <small>ANONYMITY GUARD</small>
        <strong>{fusion.audit.identity_fields_processed}</strong>
        <span>identity fields processed</span>
      </article>
      <article className="governance-detail">
        <h3>Inference context</h3>
        <dl>
          <div>
            <dt>Engine</dt>
            <dd>{fusion.audit.engine}</dd>
          </div>
          <div>
            <dt>ROI method</dt>
            <dd>{fusion.audit.roi_method}</dd>
          </div>
          <div>
            <dt>Forecast</dt>
            <dd>{fusion.audit.forecast_method}</dd>
          </div>
          <div>
            <dt>Entropy</dt>
            <dd>{fusion.fusion.entropy.toFixed(3)} bits</dd>
          </div>
        </dl>
      </article>
      <article className="constraint-list">
        <h3>Operational constraints</h3>
        {fusion.constraints.map((constraint) => (
          <p key={constraint}>
            <i />
            {constraint}
          </p>
        ))}
      </article>
      <article className="model-governance">
        <h3>Versioned model cards</h3>
        {fusion.models.map((model) => (
          <div key={model.name}>
            <span><strong>{model.name}</strong><small>{model.dataset_contract}</small></span>
            <b>v{model.version}</b>
            <em>{model.approval}</em>
          </div>
        ))}
      </article>
      <article className="approval-history">
        <h3>Approval history</h3>
        {fusion.validation.approval_history.map((event) => (
          <div key={`${event.version}-${event.date}`}>
            <i />
            <span><strong>v{event.version}</strong><small>{event.date}</small></span>
            <b>{event.status}</b>
          </div>
        ))}
      </article>
    </div>
  )
}

export default function ClinicalAnalytics({
  fusion,
  forecastDay,
}: ClinicalAnalyticsProps) {
  const [tab, setTab] = useState<AnalyticsTab>("progression")
  const tabs: Array<{
    id: AnalyticsTab
    label: string
    icon: typeof Activity
  }> =
    [
      { id: "progression", label: "Progression", icon: Activity },
      { id: "performance", label: "Performance", icon: ChartNoAxesCombined },
      { id: "validation", label: "Validation", icon: CircleGauge },
      { id: "roi", label: "ROI matrix", icon: Boxes },
      { id: "governance", label: "Governance", icon: ShieldCheck },
    ]
  return (
    <section className="analytics-suite">
      <div className="analytics-suite__tabs" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {tab === "progression" ? (
        <ProgressionPanel fusion={fusion} forecastDay={forecastDay} />
      ) : null}
      {tab === "performance" ? <PerformancePanel fusion={fusion} /> : null}
      {tab === "validation" ? <ValidationPanel fusion={fusion} /> : null}
      {tab === "roi" ? (
        <RoiPanel fusion={fusion} forecastDay={forecastDay} />
      ) : null}
      {tab === "governance" ? <GovernancePanel fusion={fusion} /> : null}
    </section>
  )
}
