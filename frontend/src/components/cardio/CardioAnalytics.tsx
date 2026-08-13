import React, { useRef, useEffect, useMemo, useState } from 'react'
import {
  type GraphConfig, defaultGraphConfig, drawGrid, drawAxisLabels, drawLine, drawDot, getPlotArea, toCanvasX, toCanvasY,
  type ForceNode, type ForceEdge, simulateForce,
} from '../../lib/graphUtils'
import {
  generateFraminghamScatter, type FraminghamData,
} from '../../lib/medicalData'

interface CardioAnalyticsProps {
  width?: number
  height?: number
}

// ── Scatter Plot ───────────────────────────────────────────────────────────────
function FraminghamScatter({ width = 300, height = 220 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const data = useMemo(() => generateFraminghamScatter(80), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    const config: GraphConfig = {
      ...defaultGraphConfig,
      width, height,
      padding: { top: 15, right: 15, bottom: 35, left: 50 },
      xRange: [100, 300],
      yRange: [0, 30],
      gridSpacingX: 40,
      gridSpacingY: 5,
    }

    ctx.fillStyle = 'rgba(15,23,42,0.95)'
    ctx.fillRect(0, 0, width, height)
    drawGrid(ctx, config)

    for (const d of data) {
      const riskColor = d.score > 20 ? '#ef4444' : d.score > 10 ? '#fbbf24' : '#2dd4bf'
      const r = 2 + d.score * 0.15

      ctx.globalAlpha = 0.7
      ctx.fillStyle = riskColor
      ctx.shadowBlur = 4
      ctx.shadowColor = riskColor

      const cx = toCanvasX(d.totalChol, config)
      const cy = toCanvasY(d.score, config)
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()

      if (d.smoker) {
        ctx.strokeStyle = '#f97316'
        ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    drawAxisLabels(ctx, config, 'Total Cholesterol (mg/dL)', '10-yr CVD Risk (%)',
      [{ value: 150, label: '150' }, { value: 200, label: '200' }, { value: 250, label: '250' }],
      [{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 15, label: '15' }, { value: 20, label: '20' }, { value: 25, label: '25' }],
    )
  }, [width, height, data])

  return <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
}

// ── ROC Curve ──────────────────────────────────────────────────────────────────
function ROCCurve({ width = 220, height = 220 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    const config: GraphConfig = {
      ...defaultGraphConfig,
      width, height,
      padding: { top: 15, right: 15, bottom: 35, left: 45 },
      xRange: [0, 1],
      yRange: [0, 1],
      gridSpacingX: 0.2,
      gridSpacingY: 0.2,
    }

    ctx.fillStyle = 'rgba(15,23,42,0.95)'
    ctx.fillRect(0, 0, width, height)
    drawGrid(ctx, config)

    // Diagonal reference
    ctx.strokeStyle = 'rgba(148,163,184,0.15)'
    ctx.lineWidth = 0.8
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(toCanvasX(0, config), toCanvasY(0, config))
    ctx.lineTo(toCanvasX(1, config), toCanvasY(1, config))
    ctx.stroke()
    ctx.setLineDash([])

    // Model ROC curves
    const models = [
      { name: 'Fusion', auc: 0.94, color: '#2dd4bf' },
      { name: 'CNN', auc: 0.88, color: '#ef4444' },
      { name: 'LSTM', auc: 0.85, color: '#fbbf24' },
      { name: 'XGB', auc: 0.82, color: '#8b5cf6' },
    ]

    for (const model of models) {
      const curve: { x: number; y: number }[] = []
      for (let i = 0; i <= 100; i++) {
        const fpr = i / 100
        const tpr = 1 - Math.pow(1 - fpr, model.auc * 3)
        curve.push({ x: fpr, y: Math.min(1, tpr) })
      }
      drawLine(ctx, config, curve, model.color, 1.5, true)
    }

    drawAxisLabels(ctx, config, 'False Positive Rate', 'True Positive Rate',
      [{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1.0' }],
      [{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1.0' }],
    )

    // Legend
    let ly = 22
    for (const m of models) {
      ctx.fillStyle = m.color
      ctx.fillRect(width - 75, ly, 8, 3)
      ctx.font = '8px "DM Mono", monospace'
      ctx.fillStyle = 'rgba(148,163,184,0.5)'
      ctx.textAlign = 'left'
      ctx.fillText(`${m.name} .${(m.auc * 100).toFixed(0)}`, width - 64, ly + 4)
      ly += 13
    }
  }, [width, height])

  return <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
}

// ── Knowledge Graph ────────────────────────────────────────────────────────────
function CardioKnowledgeGraph({ width = 350, height = 250 }: { width?: number; height?: number }) {
  const [nodes, setNodes] = useState<ForceNode[]>([])
  const [edges] = useState<ForceEdge[]>([
    { source: 'hf', target: 'lvef', strength: 0.8, color: 'rgba(239,68,68,0.4)' },
    { source: 'hf', target: 'bnp', strength: 0.7, color: 'rgba(239,68,68,0.3)' },
    { source: 'hcm', target: 'lvh', strength: 0.9, color: 'rgba(251,191,36,0.4)' },
    { source: 'hcm', target: 'lvoto', strength: 0.75, color: 'rgba(251,191,36,0.3)' },
    { source: 'hcm', target: 'sam', strength: 0.6, color: 'rgba(251,191,36,0.3)' },
    { source: 'cad', target: 'stemi', strength: 0.85, color: 'rgba(239,68,68,0.4)' },
    { source: 'cad', target: 'chol', strength: 0.5, color: 'rgba(45,212,191,0.3)' },
    { source: 'af', target: 'stroke', strength: 0.7, color: 'rgba(139,92,246,0.4)' },
    { source: 'af', target: 'hr', strength: 0.6, color: 'rgba(139,92,246,0.3)' },
    { source: 'lvef', target: 'bnp', strength: 0.4, color: 'rgba(148,163,184,0.2)' },
    { source: 'stemi', target: 'lvef', strength: 0.5, color: 'rgba(148,163,184,0.2)' },
    { source: 'hf', target: 'af', strength: 0.3, color: 'rgba(148,163,184,0.15)' },
    { source: 'chol', target: 'stemi', strength: 0.35, color: 'rgba(148,163,184,0.15)' },
  ])

  useEffect(() => {
    const initialNodes: ForceNode[] = [
      { id: 'hf', label: 'Heart Failure', x: width * 0.3, y: height * 0.3, vx: 0, vy: 0, radius: 16, color: '#ef4444', group: 'disease' },
      { id: 'hcm', label: 'HCM', x: width * 0.7, y: height * 0.3, vx: 0, vy: 0, radius: 14, color: '#fbbf24', group: 'disease' },
      { id: 'cad', label: 'CAD', x: width * 0.5, y: height * 0.15, vx: 0, vy: 0, radius: 15, color: '#ef4444', group: 'disease' },
      { id: 'af', label: 'A.Fib', x: width * 0.2, y: height * 0.6, vx: 0, vy: 0, radius: 13, color: '#8b5cf6', group: 'disease' },
      { id: 'lvef', label: 'LVEF', x: width * 0.4, y: height * 0.5, vx: 0, vy: 0, radius: 10, color: '#2dd4bf', group: 'marker' },
      { id: 'bnp', label: 'BNP', x: width * 0.25, y: height * 0.45, vx: 0, vy: 0, radius: 9, color: '#2dd4bf', group: 'marker' },
      { id: 'lvh', label: 'LVH', x: width * 0.65, y: height * 0.5, vx: 0, vy: 0, radius: 9, color: '#06b6d4', group: 'finding' },
      { id: 'lvoto', label: 'LVOTO', x: width * 0.8, y: height * 0.5, vx: 0, vy: 0, radius: 8, color: '#06b6d4', group: 'finding' },
      { id: 'sam', label: 'SAM', x: width * 0.75, y: height * 0.65, vx: 0, vy: 0, radius: 8, color: '#06b6d4', group: 'finding' },
      { id: 'stemi', label: 'STEMI', x: width * 0.55, y: height * 0.35, vx: 0, vy: 0, radius: 11, color: '#ef4444', group: 'event' },
      { id: 'chol', label: 'Cholesterol', x: width * 0.6, y: height * 0.15, vx: 0, vy: 0, radius: 8, color: '#f97316', group: 'risk' },
      { id: 'stroke', label: 'Stroke', x: width * 0.15, y: height * 0.75, vx: 0, vy: 0, radius: 11, color: '#ef4444', group: 'event' },
      { id: 'hr', label: 'Heart Rate', x: width * 0.3, y: height * 0.7, vx: 0, vy: 0, radius: 8, color: '#2dd4bf', group: 'marker' },
    ]

    // Run force simulation
    const settled = simulateForce(initialNodes, edges, width, height, 80)
    setNodes(settled)
  }, [width, height, edges])

  return (
    <svg width={width} height={height} className="rounded-lg" style={{ background: 'rgba(15,23,42,0.95)' }}>
      {/* Edges */}
      {edges.map((e, i) => {
        const source = nodes.find(n => n.id === e.source)
        const target = nodes.find(n => n.id === e.target)
        if (!source || !target) return null
        return (
          <line key={i} x1={source.x} y1={source.y} x2={target.x} y2={target.y}
            stroke={e.color} strokeWidth={e.strength * 2} />
        )
      })}
      {/* Nodes */}
      {nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.radius} fill={`${n.color}30`} stroke={n.color} strokeWidth={1.5} />
          <text x={n.x} y={n.y + 3} textAnchor="middle" fill={n.color}
            fontSize={Math.max(7, n.radius * 0.55)} fontFamily="DM Mono, monospace" fontWeight="500">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Main Export ─────────────────────────────────────────────────────────────────
export default function CardioAnalytics({ width, height }: CardioAnalyticsProps) {
  const [tab, setTab] = useState<'scatter' | 'roc' | 'knowledge'>('scatter')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Analytical Models</span>
        <div className="flex gap-1">
          {[
            { id: 'scatter' as const, label: 'Framingham' },
            { id: 'roc' as const, label: 'ROC' },
            { id: 'knowledge' as const, label: 'Knowledge' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                tab === t.id
                  ? 'bg-red-900/40 border-red-700/60 text-red-400'
                  : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>
      {tab === 'scatter' && <FraminghamScatter />}
      {tab === 'roc' && <ROCCurve />}
      {tab === 'knowledge' && <CardioKnowledgeGraph />}
    </div>
  )
}
