import React, { useState, useMemo } from 'react'
import { generateNeuroMetrics } from '../../lib/medicalData'

interface NeuroMetricsProps {
  disease?: string
}

function MetricGauge({ label, value, min, max, unit, thresholds }: {
  label: string; value: number; min: number; max: number; unit?: string
  thresholds?: { warn: number; danger: number; direction: 'above' | 'below' }
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  let color = '#2dd4bf'
  if (thresholds) {
    const { warn, danger, direction } = thresholds
    if (direction === 'below') {
      if (value < danger) color = '#ef4444'
      else if (value < warn) color = '#fbbf24'
    } else {
      if (value > danger) color = '#ef4444'
      else if (value > warn) color = '#fbbf24'
    }
  }

  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{label}</span>
        <span className="text-sm font-mono font-semibold tabular-nums" style={{ color }}>
          {value.toFixed(2)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[8px] font-mono text-slate-700">{min}</span>
        <span className="text-[8px] font-mono text-slate-700">{max}</span>
      </div>
    </div>
  )
}

function HubList({ hubs }: { hubs: { region: string; betweenness: number }[] }) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2">Hub Regions (Betweenness Centrality)</div>
      <div className="space-y-1.5">
        {hubs.map((h, i) => (
          <div key={h.region} className="flex items-center gap-2">
            <span className="w-4 text-[9px] font-mono text-slate-600">{i + 1}.</span>
            <span className="flex-1 text-xs text-slate-300 truncate">{h.region}</span>
            <div className="w-16 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${h.betweenness * 100}%`,
                background: `hsl(${270 - h.betweenness * 100}, 70%, 60%)`,
              }} />
            </div>
            <span className="text-[9px] font-mono text-purple-400 w-8 text-right">{h.betweenness.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DiseaseComparisonCard({ disease, metrics }: {
  disease: string
  metrics: ReturnType<typeof generateNeuroMetrics>
}) {
  const descriptions: Record<string, string> = {
    normal: 'Healthy brain with balanced local-global efficiency and intact hub connectivity.',
    alzheimers: "Disrupted local efficiency and declining small-world properties as memory hubs degenerate. Reduced hippocampal and thalamic connectivity.",
    epilepsy: 'Hyper-synchronized regional hubs triggering seizure activity. Elevated clustering coefficient with altered temporal lobe connectivity.',
    depression: 'Altered nodal centrality within emotional and cognitive networks. Reduced prefrontal-amygdala functional connectivity.',
    tbi: 'Loss of long-range functional integration causing persistent cognitive deficits. Reduced global efficiency and path length disruption.',
  }

  return (
    <div className="glass rounded-lg p-3 border border-purple-900/30">
      <div className="text-xs font-semibold text-purple-400 mb-1 capitalize">{disease === 'alzheimers' ? "Alzheimer's Disease" : disease === 'tbi' ? 'Traumatic Brain Injury' : disease}</div>
      <div className="text-[10px] text-slate-400 leading-relaxed mb-2">{descriptions[disease]}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'σ', value: metrics.smallWorldness.toFixed(1), color: metrics.smallWorldness < 2 ? '#ef4444' : '#2dd4bf' },
          { label: 'CC', value: metrics.clusteringCoeff.toFixed(2), color: '#fbbf24' },
          { label: 'GE', value: metrics.globalEfficiency.toFixed(2), color: '#8b5cf6' },
        ].map(m => (
          <div key={m.label}>
            <div className="text-[8px] font-mono text-slate-600">{m.label}</div>
            <div className="text-xs font-mono font-semibold" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function NeuroMetrics({ disease = 'normal' }: NeuroMetricsProps) {
  const [activeDiseases, setActiveDiseases] = useState<string[]>(['normal', disease !== 'normal' ? disease : 'alzheimers'])

  const metricsMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof generateNeuroMetrics>> = {}
    for (const d of ['normal', 'alzheimers', 'epilepsy', 'depression', 'tbi']) {
      map[d] = generateNeuroMetrics(d)
    }
    return map
  }, [])

  const current = metricsMap[disease] || metricsMap.normal

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">Graph-Theoretic Metrics</div>

      <div className="grid grid-cols-2 gap-2">
        <MetricGauge label="Small-Worldness (σ)" value={current.smallWorldness} min={0} max={5}
          thresholds={{ warn: 2.0, danger: 1.5, direction: 'below' }} />
        <MetricGauge label="Clustering Coefficient" value={current.clusteringCoeff} min={0} max={1} />
        <MetricGauge label="Global Efficiency" value={current.globalEfficiency} min={0} max={1}
          thresholds={{ warn: 0.4, danger: 0.3, direction: 'below' }} />
        <MetricGauge label="Char. Path Length" value={current.pathLength} min={1} max={5}
          thresholds={{ warn: 3.0, danger: 3.5, direction: 'above' }} />
      </div>

      <HubList hubs={current.hubRegions} />

      <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-1">Clinical Applications</div>
      <div className="flex gap-1 flex-wrap mb-1">
        {['normal', 'alzheimers', 'epilepsy', 'depression', 'tbi'].map(d => (
          <button key={d} onClick={() => {
            setActiveDiseases(prev =>
              prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].slice(-3)
            )
          }}
            className={`px-2 py-0.5 text-[8px] font-mono rounded border transition-colors capitalize ${
              activeDiseases.includes(d)
                ? 'bg-purple-900/30 border-purple-700/50 text-purple-400'
                : 'border-slate-800 text-slate-700 hover:text-slate-500'
            }`}>{d === 'alzheimers' ? "Alzheimer's" : d === 'tbi' ? 'TBI' : d}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {activeDiseases.map(d => (
          <DiseaseComparisonCard key={d} disease={d} metrics={metricsMap[d]} />
        ))}
      </div>
    </div>
  )
}
