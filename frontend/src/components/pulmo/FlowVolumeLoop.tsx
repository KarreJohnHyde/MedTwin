import React, { useRef, useEffect, useState } from 'react'
import {
  type GraphConfig, defaultGraphConfig, drawGrid, drawAxisLabels, drawLine, drawDot, getPlotArea, toCanvasX, toCanvasY,
} from '../../lib/graphUtils'
import { generateFlowVolumeLoop, SPIROMETRY_PRESETS, type SpirometryParams } from '../../lib/medicalData'

interface FlowVolumeLoopProps {
  width?: number
  height?: number
  preset?: string
}

export default function FlowVolumeLoop({ width = 400, height = 280, preset = 'normal' }: FlowVolumeLoopProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const progressRef = useRef(0)
  const [activePreset, setActivePreset] = useState(preset)
  const [showNormalOverlay, setShowNormalOverlay] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    const params = SPIROMETRY_PRESETS[activePreset] || SPIROMETRY_PRESETS.normal
    const normalParams = SPIROMETRY_PRESETS.normal

    const config: GraphConfig = {
      ...defaultGraphConfig,
      width, height,
      padding: { top: 20, right: 20, bottom: 38, left: 55 },
      xRange: [0, 6],
      yRange: [-8, 12],
      gridSpacingX: 1,
      gridSpacingY: 2,
      gridColor: 'rgba(6,182,212,0.06)',
    }

    const loopData = generateFlowVolumeLoop(params, 250)
    const normalData = generateFlowVolumeLoop(normalParams, 250)

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(15,23,42,0.95)'
      ctx.fillRect(0, 0, width, height)
      drawGrid(ctx, config)

      // Zero flow line
      const zeroY = toCanvasY(0, config)
      ctx.strokeStyle = 'rgba(148,163,184,0.2)'
      ctx.lineWidth = 0.8
      ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(getPlotArea(config).x, zeroY); ctx.lineTo(getPlotArea(config).x + getPlotArea(config).w, zeroY); ctx.stroke()
      ctx.setLineDash([])

      // Normal overlay (dim reference)
      if (showNormalOverlay && activePreset !== 'normal') {
        drawLine(ctx, config, normalData, 'rgba(45,212,191,0.15)', 1.2)
      }

      // Animate the main curve
      const progress = Math.min(loopData.length, Math.floor(progressRef.current))
      const visibleData = loopData.slice(0, progress)

      // Filled area under expiratory curve
      if (visibleData.length > 2) {
        const expPoints = visibleData.filter(p => p.y >= 0)
        if (expPoints.length > 1) {
          const fillColor = activePreset === 'obstructive' ? 'rgba(251,191,36,0.08)' :
                           activePreset === 'restrictive' ? 'rgba(239,68,68,0.08)' :
                           'rgba(6,182,212,0.08)'
          ctx.fillStyle = fillColor
          ctx.beginPath()
          ctx.moveTo(toCanvasX(expPoints[0].x, config), zeroY)
          for (const pt of expPoints) {
            ctx.lineTo(toCanvasX(pt.x, config), toCanvasY(pt.y, config))
          }
          ctx.lineTo(toCanvasX(expPoints[expPoints.length - 1].x, config), zeroY)
          ctx.closePath()
          ctx.fill()
        }
      }

      // Main curve
      const mainColor = activePreset === 'obstructive' ? '#fbbf24' :
                        activePreset === 'restrictive' ? '#ef4444' : '#06b6d4'
      drawLine(ctx, config, visibleData, mainColor, 2, true)

      // Current point
      if (progress > 0 && progress < loopData.length) {
        const pt = loopData[progress - 1]
        drawDot(ctx, config, pt.x, pt.y, 4, mainColor, true)
      }

      // PEF marker
      const pef = Math.max(...loopData.map(p => p.y))
      const pefPoint = loopData.find(p => p.y === pef)
      if (pefPoint && progress > loopData.indexOf(pefPoint)) {
        ctx.font = '8px "DM Mono", monospace'
        ctx.fillStyle = mainColor
        ctx.textAlign = 'left'
        const px = toCanvasX(pefPoint.x, config)
        const py = toCanvasY(pefPoint.y, config)
        ctx.fillText(`PEF: ${pef.toFixed(1)} L/s`, px + 8, py - 4)

        ctx.strokeStyle = mainColor
        ctx.lineWidth = 0.5
        ctx.setLineDash([2, 2])
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 6, py - 2); ctx.stroke()
        ctx.setLineDash([])
      }

      // Pattern label
      if (progress > loopData.length * 0.5) {
        const patternLabels: Record<string, string> = {
          normal: 'Normal Pattern',
          obstructive: 'Obstructive — Scooped Expiratory Curve',
          restrictive: 'Restrictive — Reduced Volume "Witch\'s Hat"',
        }
        ctx.font = '9px "DM Mono", monospace'
        ctx.fillStyle = `${mainColor}80`
        ctx.textAlign = 'right'
        ctx.fillText(patternLabels[activePreset] || '', width - 20, 14)
      }

      // Metrics box
      if (progress >= loopData.length) {
        const { fvc, fev1 } = params
        const ratio = (fev1 / fvc * 100).toFixed(0)
        const ratioColor = fev1 / fvc < 0.7 ? '#ef4444' : '#2dd4bf'

        ctx.fillStyle = 'rgba(15,23,42,0.9)'
        ctx.fillRect(width - 115, height - 72, 100, 38)
        ctx.strokeStyle = 'rgba(148,163,184,0.1)'
        ctx.strokeRect(width - 115, height - 72, 100, 38)

        ctx.font = '8px "DM Mono", monospace'
        ctx.fillStyle = 'rgba(148,163,184,0.5)'
        ctx.textAlign = 'left'
        ctx.fillText(`FVC: ${fvc.toFixed(1)} L`, width - 110, height - 58)
        ctx.fillText(`FEV₁: ${fev1.toFixed(1)} L`, width - 110, height - 48)
        ctx.fillStyle = ratioColor
        ctx.fillText(`FEV₁/FVC: ${ratio}%`, width - 110, height - 38)
      }

      drawAxisLabels(ctx, config, 'Volume (L)', 'Flow (L/s)',
        [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }],
        [{ value: -6, label: '-6' }, { value: -3, label: '-3' }, { value: 0, label: '0' }, { value: 3, label: '3' }, { value: 6, label: '6' }, { value: 9, label: '9' }],
      )

      // Exp/Insp labels
      ctx.font = '8px "DM Mono", monospace'
      ctx.fillStyle = 'rgba(148,163,184,0.25)'
      ctx.textAlign = 'left'
      ctx.fillText('Expiration ↑', getPlotArea(config).x + 4, 14)
      ctx.fillText('Inspiration ↓', getPlotArea(config).x + 4, height - 28)

      progressRef.current += 1.5
      if (progressRef.current > loopData.length + 60) progressRef.current = 0
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [width, height, activePreset, showNormalOverlay])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Flow-Volume Loop</span>
        <div className="flex gap-1">
          {Object.keys(SPIROMETRY_PRESETS).map(p => (
            <button key={p} onClick={() => { setActivePreset(p); progressRef.current = 0 }}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors capitalize ${
                activePreset === p
                  ? 'bg-cyan-900/40 border-cyan-700/60 text-cyan-400'
                  : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}>{p}</button>
          ))}
          {activePreset !== 'normal' && (
            <button onClick={() => setShowNormalOverlay(s => !s)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                showNormalOverlay ? 'border-teal-700/40 text-teal-500' : 'border-slate-800 text-slate-700'
              }`}>ref</button>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
    </div>
  )
}
