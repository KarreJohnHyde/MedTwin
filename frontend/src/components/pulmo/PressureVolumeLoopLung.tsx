import React, { useRef, useEffect, useState } from 'react'
import {
  type GraphConfig, defaultGraphConfig, drawGrid, drawAxisLabels, drawLine, getPlotArea, toCanvasX, toCanvasY,
} from '../../lib/graphUtils'
import { generateLungPVLoop, LUNG_PV_PRESETS } from '../../lib/medicalData'

interface LungPVProps { width?: number; height?: number }

export default function PressureVolumeLoopLung({ width = 380, height = 260 }: LungPVProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activePreset, setActivePreset] = useState('normal')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2; canvas.height = height * 2; ctx.scale(2, 2)

    const config: GraphConfig = {
      ...defaultGraphConfig, width, height,
      padding: { top: 20, right: 20, bottom: 38, left: 55 },
      xRange: [0, 40], yRange: [1000, 8000],
      gridSpacingX: 5, gridSpacingY: 1000,
      gridColor: 'rgba(6,182,212,0.06)',
    }

    ctx.fillStyle = 'rgba(15,23,42,0.95)'; ctx.fillRect(0, 0, width, height)
    drawGrid(ctx, config)

    const presetColors: Record<string, string> = {
      normal: '#06b6d4',
      fibrosis: '#ef4444',
      emphysema: '#fbbf24',
    }

    if (showAll) {
      // Draw all presets
      for (const [key, params] of Object.entries(LUNG_PV_PRESETS)) {
        const data = generateLungPVLoop(params, 120)
        const points = data.map(p => ({ x: p.x, y: p.y }))
        const color = presetColors[key] || '#94a3b8'

        // Fill hysteresis area
        ctx.fillStyle = `${color}10`
        ctx.beginPath()
        for (let i = 0; i < points.length; i++) {
          const cx = toCanvasX(points[i].x, config)
          const cy = toCanvasY(points[i].y, config)
          i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
        }
        ctx.closePath(); ctx.fill()

        drawLine(ctx, config, points, color, key === activePreset ? 2 : 1.2, key === activePreset)

        // Label
        const labelPt = points[Math.floor(points.length / 4)]
        ctx.font = '8px "DM Mono", monospace'
        ctx.fillStyle = color
        ctx.textAlign = 'left'
        ctx.fillText(key, toCanvasX(labelPt.x, config) + 4, toCanvasY(labelPt.y, config) - 4)
      }
    } else {
      const params = LUNG_PV_PRESETS[activePreset] || LUNG_PV_PRESETS.normal
      const data = generateLungPVLoop(params, 150)
      const points = data.map(p => ({ x: p.x, y: p.y }))
      const color = presetColors[activePreset] || '#06b6d4'

      // Hysteresis fill
      ctx.fillStyle = `${color}12`
      ctx.beginPath()
      for (let i = 0; i < points.length; i++) {
        const cx = toCanvasX(points[i].x, config)
        const cy = toCanvasY(points[i].y, config)
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
      }
      ctx.closePath(); ctx.fill()

      // Inspiration half
      const inspPoints = points.slice(0, Math.floor(points.length / 2) + 1)
      drawLine(ctx, config, inspPoints, color, 2, true)

      // Expiration half
      const expPoints = points.slice(Math.floor(points.length / 2))
      drawLine(ctx, config, expPoints, `${color}90`, 1.8, true)

      // Direction arrows
      const arrowIdx = Math.floor(points.length / 4)
      const arrowPt = points[arrowIdx]
      ctx.font = '10px sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'
      ctx.fillText('→', toCanvasX(arrowPt.x, config), toCanvasY(arrowPt.y, config) - 8)

      const arrow2Idx = Math.floor(points.length * 3 / 4)
      const arrow2Pt = points[arrow2Idx]
      ctx.fillText('←', toCanvasX(arrow2Pt.x, config), toCanvasY(arrow2Pt.y, config) + 14)

      // Labels
      ctx.font = '8px "DM Mono", monospace'
      ctx.fillStyle = 'rgba(148,163,184,0.4)'
      ctx.textAlign = 'left'
      ctx.fillText('Inspiration', toCanvasX(inspPoints[Math.floor(inspPoints.length / 2)].x, config) + 4,
        toCanvasY(inspPoints[Math.floor(inspPoints.length / 2)].y, config) + 12)
      ctx.fillText('Expiration', toCanvasX(expPoints[Math.floor(expPoints.length / 2)].x, config) + 4,
        toCanvasY(expPoints[Math.floor(expPoints.length / 2)].y, config) - 8)

      // Compliance line & value
      const compliance = params.compliance
      ctx.font = 'bold 9px "DM Mono", monospace'; ctx.fillStyle = color
      ctx.textAlign = 'right'
      ctx.fillText(`Compliance: ${compliance} mL/cmH₂O`, width - 20, 14)

      const compDesc = params.pattern === 'fibrosis' ? 'LOW — Stiff lung' :
                       params.pattern === 'emphysema' ? 'HIGH — Floppy lung' : 'NORMAL'
      ctx.font = '8px "DM Mono", monospace'; ctx.fillStyle = `${color}80`
      ctx.fillText(compDesc, width - 20, 26)

      // Hysteresis work label
      ctx.fillStyle = 'rgba(148,163,184,0.3)'; ctx.textAlign = 'center'
      const midPt = points[Math.floor(points.length * 0.35)]
      ctx.fillText('Elastic Work', toCanvasX(midPt.x, config), toCanvasY(midPt.y, config))
    }

    drawAxisLabels(ctx, config, 'Transpulmonary Pressure (cmH₂O)', 'Volume (mL)',
      [{ value: 0, label: '0' }, { value: 10, label: '10' }, { value: 20, label: '20' }, { value: 30, label: '30' }],
      [{ value: 2000, label: '2000' }, { value: 4000, label: '4000' }, { value: 6000, label: '6000' }],
    )
  }, [width, height, activePreset, showAll])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Pressure-Volume Loop</span>
        <div className="flex gap-1">
          {Object.keys(LUNG_PV_PRESETS).map(p => (
            <button key={p} onClick={() => { setActivePreset(p); setShowAll(false) }}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors capitalize ${
                activePreset === p && !showAll ? 'bg-cyan-900/40 border-cyan-700/60 text-cyan-400' : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}>{p}</button>
          ))}
          <button onClick={() => setShowAll(s => !s)}
            className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
              showAll ? 'bg-indigo-900/40 border-indigo-700/50 text-indigo-400' : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
            }`}>compare</button>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
    </div>
  )
}
