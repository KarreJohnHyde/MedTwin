import React, { useRef, useEffect, useState } from 'react'
import {
  type GraphConfig, defaultGraphConfig, drawGrid, drawAxisLabels, drawLine, drawDot, getPlotArea, toCanvasX, toCanvasY,
} from '../../lib/graphUtils'
import { generatePVLoop, PV_PRESETS, type PVLoopParams } from '../../lib/medicalData'

interface PVLoopProps {
  width?: number
  height?: number
  preset?: string
}

export default function PressureVolumeLoop({ width = 380, height = 280, preset = 'normal' }: PVLoopProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const cursorRef = useRef(0)
  const [activePreset, setActivePreset] = useState(preset)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    const params = PV_PRESETS[activePreset] || PV_PRESETS.normal

    const config: GraphConfig = {
      ...defaultGraphConfig,
      width, height,
      padding: { top: 20, right: 20, bottom: 38, left: 55 },
      xRange: [0, 220],
      yRange: [0, 220],
      gridSpacingX: 40,
      gridSpacingY: 40,
      gridColor: 'rgba(239,68,68,0.06)',
    }

    const loopData = generatePVLoop(params, 150)

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(15,23,42,0.95)'
      ctx.fillRect(0, 0, width, height)

      drawGrid(ctx, config)

      // ESPVR line (end-systolic pressure-volume relationship)
      ctx.strokeStyle = 'rgba(239,68,68,0.2)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(toCanvasX(0, config), toCanvasY(0, config))
      ctx.lineTo(toCanvasX(params.esv + 20, config), toCanvasY(params.peakPressure + 30, config))
      ctx.stroke()
      ctx.setLineDash([])

      // EDPVR curve
      ctx.strokeStyle = 'rgba(45,212,191,0.15)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      for (let v = 0; v <= 200; v += 2) {
        const p = 2 + 0.0005 * v * v
        const cx = toCanvasX(v, config)
        const cy = toCanvasY(p, config)
        v === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Draw loop
      const loopPoints = loopData.map(p => ({ x: p.volume, y: p.pressure }))
      
      // Filled area
      ctx.fillStyle = 'rgba(239,68,68,0.08)'
      ctx.beginPath()
      for (let i = 0; i < loopPoints.length; i++) {
        const cx = toCanvasX(loopPoints[i].x, config)
        const cy = toCanvasY(loopPoints[i].y, config)
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
      }
      ctx.closePath()
      ctx.fill()

      // Draw the animated traced portion
      const cursor = Math.floor(cursorRef.current) % loopPoints.length
      const traced = loopPoints.slice(0, cursor + 1)
      const remaining = loopPoints.slice(cursor)

      // Dim full loop
      drawLine(ctx, config, loopPoints, 'rgba(239,68,68,0.25)', 1.2)

      // Bright traced portion
      if (traced.length > 1) {
        drawLine(ctx, config, traced, '#ef4444', 2, true)
      }

      // Current position dot
      if (cursor < loopPoints.length) {
        const pt = loopPoints[cursor]
        drawDot(ctx, config, pt.x, pt.y, 4, '#ef4444', true)
        
        // Phase label
        const phase = cursor / loopPoints.length
        let phaseName = ''
        if (phase < 0.15) phaseName = 'IVC'
        else if (phase < 0.45) phaseName = 'Ejection'
        else if (phase < 0.60) phaseName = 'IVR'
        else phaseName = 'Filling'

        ctx.font = '9px "DM Mono", monospace'
        ctx.fillStyle = '#ef4444'
        ctx.textAlign = 'left'
        const dotCx = toCanvasX(pt.x, config)
        const dotCy = toCanvasY(pt.y, config)
        ctx.fillText(phaseName, dotCx + 8, dotCy - 4)
      }

      // Key markers
      drawDot(ctx, config, params.edv, params.edp, 3, '#fbbf24')
      drawDot(ctx, config, params.esv, params.peakPressure * 0.8, 3, '#2dd4bf')

      // EDV / ESV labels
      ctx.font = '8px "DM Mono", monospace'
      ctx.fillStyle = '#fbbf24'
      ctx.textAlign = 'center'
      ctx.fillText(`EDV ${params.edv}`, toCanvasX(params.edv, config), toCanvasY(params.edp, config) + 12)
      ctx.fillStyle = '#2dd4bf'
      ctx.fillText(`ESV ${params.esv}`, toCanvasX(params.esv, config) - 20, toCanvasY(params.peakPressure * 0.8, config) - 8)

      // SV label
      const sv = params.edv - params.esv
      ctx.font = 'bold 10px "DM Mono", monospace'
      ctx.fillStyle = 'rgba(248,113,113,0.8)'
      ctx.textAlign = 'center'
      ctx.fillText(`SV: ${sv} mL`, toCanvasX((params.edv + params.esv) / 2, config), toCanvasY(params.edp + 10, config) + 14)

      // Axis labels
      drawAxisLabels(ctx, config, 'Volume (mL)', 'Pressure (mmHg)',
        [{ value: 0, label: '0' }, { value: 50, label: '50' }, { value: 100, label: '100' }, { value: 150, label: '150' }, { value: 200, label: '200' }],
        [{ value: 0, label: '0' }, { value: 50, label: '50' }, { value: 100, label: '100' }, { value: 150, label: '150' }, { value: 200, label: '200' }],
      )

      cursorRef.current += 0.8
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [width, height, activePreset])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Pressure-Volume Loop</span>
        <div className="flex gap-1">
          {Object.keys(PV_PRESETS).map(p => (
            <button key={p} onClick={() => { setActivePreset(p); cursorRef.current = 0 }}
              className={`px-1.5 py-0.5 text-[8px] font-mono rounded border transition-colors ${
                activePreset === p
                  ? 'bg-red-900/40 border-red-700/60 text-red-400'
                  : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}>{p.replace(/([A-Z])/g, ' $1').trim()}</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
    </div>
  )
}
