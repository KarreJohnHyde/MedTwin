import React, { useState, useCallback } from 'react'
import GridDivider from './GridDivider'

// ── Cardio Graphs ──────────────────────────────────────────────────────────────
import ECGWaveform from './cardio/ECGWaveform'
import PressureVolumeLoop from './cardio/PressureVolumeLoop'
import WiggersDiagram from './cardio/WiggersDiagram'
import HemodynamicTracing from './cardio/HemodynamicTracing'
import CardioAnalytics from './cardio/CardioAnalytics'

// ── Neuro Graphs ───────────────────────────────────────────────────────────────
import ConnectomeViewer from './neuro/ConnectomeViewer'
import NeuroMetrics from './neuro/NeuroMetrics'

// ── Pulmo Graphs ───────────────────────────────────────────────────────────────
import FlowVolumeLoop from './pulmo/FlowVolumeLoop'
import VolumeTimeCurve from './pulmo/VolumeTimeCurve'
import PressureVolumeLoopLung from './pulmo/PressureVolumeLoopLung'

export type OrganCategory = 'cardio' | 'neuro' | 'pulmo'

interface GridWorkspaceProps {
  category: OrganCategory
  viewer3D: React.ReactNode
}

// ── Cardio Graph Panel ─────────────────────────────────────────────────────────
function CardioGraphPanel() {
  const [tab, setTab] = useState<'ecg' | 'pv' | 'wiggers' | 'hemo' | 'analytics'>('ecg')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none flex border-b border-slate-800/60 px-2 pt-1">
        {[
          { id: 'ecg' as const, label: 'ECG' },
          { id: 'pv' as const, label: 'PV Loop' },
          { id: 'wiggers' as const, label: 'Wiggers' },
          { id: 'hemo' as const, label: 'Hemodynamic' },
          { id: 'analytics' as const, label: 'Analytics' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-all border-b-2 ${
              tab === t.id
                ? 'text-red-400 border-red-400 bg-red-900/10'
                : 'text-slate-600 border-transparent hover:text-slate-400 hover:bg-slate-800/30'
            }`}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'ecg' && <ECGWaveform />}
        {tab === 'pv' && <PressureVolumeLoop />}
        {tab === 'wiggers' && <WiggersDiagram />}
        {tab === 'hemo' && <HemodynamicTracing />}
        {tab === 'analytics' && <CardioAnalytics />}
      </div>
    </div>
  )
}

// ── Neuro Graph Panel ──────────────────────────────────────────────────────────
function NeuroGraphPanel() {
  const [tab, setTab] = useState<'connectome' | 'metrics'>('connectome')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none flex border-b border-slate-800/60 px-2 pt-1">
        {[
          { id: 'connectome' as const, label: 'Connectome' },
          { id: 'metrics' as const, label: 'Metrics & Clinical' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-all border-b-2 ${
              tab === t.id
                ? 'text-purple-400 border-purple-400 bg-purple-900/10'
                : 'text-slate-600 border-transparent hover:text-slate-400 hover:bg-slate-800/30'
            }`}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'connectome' && <ConnectomeViewer />}
        {tab === 'metrics' && <NeuroMetrics />}
      </div>
    </div>
  )
}

// ── Pulmo Graph Panel ──────────────────────────────────────────────────────────
function PulmoGraphPanel() {
  const [tab, setTab] = useState<'fvloop' | 'vtcurve' | 'pvloop'>('fvloop')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none flex border-b border-slate-800/60 px-2 pt-1">
        {[
          { id: 'fvloop' as const, label: 'Flow-Volume' },
          { id: 'vtcurve' as const, label: 'Volume-Time' },
          { id: 'pvloop' as const, label: 'P-V Loop' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[10px] font-mono uppercase tracking-wider transition-all border-b-2 ${
              tab === t.id
                ? 'text-cyan-400 border-cyan-400 bg-cyan-900/10'
                : 'text-slate-600 border-transparent hover:text-slate-400 hover:bg-slate-800/30'
            }`}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'fvloop' && <FlowVolumeLoop />}
        {tab === 'vtcurve' && <VolumeTimeCurve />}
        {tab === 'pvloop' && <PressureVolumeLoopLung />}
      </div>
    </div>
  )
}

// ── Main Grid Workspace ────────────────────────────────────────────────────────
export default function GridWorkspace({ category, viewer3D }: GridWorkspaceProps) {
  const [splitRatio, setSplitRatio] = useState(0.55)

  const handleResize = useCallback((delta: number) => {
    setSplitRatio(prev => {
      const containerWidth = window.innerWidth - 288 // approximate sidebar widths
      const newRatio = prev + delta / containerWidth
      return Math.max(0.25, Math.min(0.80, newRatio))
    })
  }, [])

  const GraphPanel = category === 'cardio' ? CardioGraphPanel
    : category === 'neuro' ? NeuroGraphPanel
    : PulmoGraphPanel

  const categoryColors = {
    cardio: { border: 'rgba(239,68,68,0.15)', header: '#ef4444', label: 'Cardio-Twin' },
    neuro:  { border: 'rgba(139,92,246,0.15)', header: '#8b5cf6', label: 'Neuro-Twin' },
    pulmo:  { border: 'rgba(6,182,212,0.15)', header: '#06b6d4', label: 'Pulmo-Twin' },
  }

  const colors = categoryColors[category]

  return (
    <div className="flex h-full overflow-hidden" style={{ borderTop: `1px solid ${colors.border}` }}>
      {/* 3D Viewport */}
      <div className="relative overflow-hidden" style={{ width: `${splitRatio * 100}%` }}>
        {/* Grid background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `
            linear-gradient(${colors.border} 1px, transparent 1px),
            linear-gradient(90deg, ${colors.border} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />

        {/* Category badge */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-2 px-2.5 py-1 rounded-md glass"
          style={{ borderColor: colors.border }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: colors.header }} />
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: colors.header }}>
            {colors.label}
          </span>
        </div>

        {viewer3D}
      </div>

      {/* Resizable Divider */}
      <GridDivider direction="vertical" onResize={handleResize} />

      {/* Graph Panel */}
      <div className="flex-1 overflow-hidden bg-slate-950/50">
        <GraphPanel />
      </div>
    </div>
  )
}
