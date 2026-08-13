import React, { useRef, useEffect, useState } from 'react'
import {
  type GraphConfig, defaultGraphConfig, drawGrid, drawAxisLabels, drawLine, drawDot, getPlotArea, toCanvasX, toCanvasY,
} from '../../lib/graphUtils'
import { generateVolumeTimeCurve, SPIROMETRY_PRESETS } from '../../lib/medicalData'

interface VolumeTimeProps { width?: number; height?: number }

export default function VolumeTimeCurve({ width = 400, height = 240 }: VolumeTimeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const progressRef = useRef(0)
  const [activePreset, setActivePreset] = useState('normal')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2; canvas.height = height * 2; ctx.scale(2, 2)

    const params = SPIROMETRY_PRESETS[activePreset] || SPIROMETRY_PRESETS.normal
    const config: GraphConfig = {
      ...defaultGraphConfig, width, height,
      padding: { top: 20, right: 20, bottom: 38, left: 50 },
      xRange: [0, 6], yRange: [0, 6],
      gridSpacingX: 1, gridSpacingY: 1,
      gridColor: 'rgba(6,182,212,0.06)',
    }
    const curveData = generateVolumeTimeCurve(params, 250)
    const normalData = generateVolumeTimeCurve(SPIROMETRY_PRESETS.normal, 250)

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(15,23,42,0.95)'; ctx.fillRect(0, 0, width, height)
      drawGrid(ctx, config)

      // Normal reference
      if (activePreset !== 'normal') {
        drawLine(ctx, config, normalData, 'rgba(45,212,191,0.12)', 1.0)
      }

      // FEV1 one-second marker
      const oneSecX = toCanvasX(1, config)
      ctx.strokeStyle = 'rgba(239,68,68,0.3)'; ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(oneSecX, getPlotArea(config).y); ctx.lineTo(oneSecX, getPlotArea(config).y + getPlotArea(config).h); ctx.stroke()
      ctx.setLineDash([])
      ctx.font = '8px "DM Mono", monospace'; ctx.fillStyle = 'rgba(239,68,68,0.5)'; ctx.textAlign = 'center'
      ctx.fillText('1s', oneSecX, getPlotArea(config).y - 4)

      // Animate curve
      const progress = Math.min(curveData.length, Math.floor(progressRef.current))
      const visible = curveData.slice(0, progress)

      // Filled area
      if (visible.length > 1) {
        const color = activePreset === 'obstructive' ? 'rgba(251,191,36,0.08)' : activePreset === 'restrictive' ? 'rgba(239,68,68,0.08)' : 'rgba(6,182,212,0.08)'
        ctx.fillStyle = color; ctx.beginPath()
        ctx.moveTo(toCanvasX(visible[0].x, config), toCanvasY(0, config))
        for (const p of visible) ctx.lineTo(toCanvasX(p.x, config), toCanvasY(p.y, config))
        ctx.lineTo(toCanvasX(visible[visible.length - 1].x, config), toCanvasY(0, config))
        ctx.closePath(); ctx.fill()
      }

      const mainColor = activePreset === 'obstructive' ? '#fbbf24' : activePreset === 'restrictive' ? '#ef4444' : '#06b6d4'
      drawLine(ctx, config, visible, mainColor, 2, true)

      if (progress > 0 && progress < curveData.length) {
        drawDot(ctx, config, curveData[progress - 1].x, curveData[progress - 1].y, 4, mainColor, true)
      }

      // FEV1 value at 1s
      const fev1Point = curveData.find(p => p.x >= 1)
      if (fev1Point && progress > curveData.indexOf(fev1Point)) {
        const fev1Y = toCanvasY(fev1Point.y, config)
        ctx.strokeStyle = 'rgba(239,68,68,0.25)'; ctx.lineWidth = 0.8
        ctx.setLineDash([3, 3])
        ctx.beginPath(); ctx.moveTo(oneSecX, fev1Y); ctx.lineTo(getPlotArea(config).x, fev1Y); ctx.stroke()
        ctx.setLineDash([])
        drawDot(ctx, config, 1, fev1Point.y, 4, '#ef4444')
        ctx.font = 'bold 9px "DM Mono", monospace'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'right'
        ctx.fillText(`FEV₁: ${params.fev1.toFixed(1)}L`, oneSecX - 6, fev1Y - 6)
      }

      // FVC marker at plateau
      if (progress >= curveData.length) {
        const { fvc, fev1 } = params
        const ratio = ((fev1 / fvc) * 100).toFixed(0)
        const ratioColor = fev1 / fvc < 0.7 ? '#ef4444' : '#2dd4bf'

        ctx.font = '9px "DM Mono", monospace'; ctx.fillStyle = '#06b6d4'; ctx.textAlign = 'right'
        ctx.fillText(`FVC: ${fvc.toFixed(1)}L`, width - 20, toCanvasY(fvc, config) - 4)
        ctx.fillStyle = ratioColor
        ctx.fillText(`FEV₁/FVC: ${ratio}%`, width - 20, toCanvasY(fvc, config) + 10)
        const status = fev1 / fvc < 0.7 ? 'OBSTRUCTIVE' : fvc < 3.5 ? 'RESTRICTIVE' : 'NORMAL'
        ctx.fillText(status, width - 20, toCanvasY(fvc, config) + 22)
      }

      drawAxisLabels(ctx, config, 'Time (seconds)', 'Volume (L)',
        [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 6, label: '6' }],
        [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }],
      )

      progressRef.current += 1.2
      if (progressRef.current > curveData.length + 80) progressRef.current = 0
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [width, height, activePreset])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Volume-Time Curve</span>
        <div className="flex gap-1">
          {Object.keys(SPIROMETRY_PRESETS).map(p => (
            <button key={p} onClick={() => { setActivePreset(p); progressRef.current = 0 }}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors capitalize ${
                activePreset === p ? 'bg-cyan-900/40 border-cyan-700/60 text-cyan-400' : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}>{p}</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
    </div>
  )
}
