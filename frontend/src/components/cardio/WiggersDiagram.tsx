import React, { useRef, useEffect } from 'react'
import {
  type GraphConfig, defaultGraphConfig, getPlotArea, toCanvasX, toCanvasY,
} from '../../lib/graphUtils'
import { generateWiggersCycle } from '../../lib/medicalData'
import { CARDIAC_PHASES as PHASE_BANDS } from '../../lib/graphUtils'

interface WiggersProps {
  width?: number
  height?: number
  hr?: number
}

export default function WiggersDiagram({ width = 520, height = 360, hr = 72 }: WiggersProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const cursorRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    const frames = generateWiggersCycle(hr, 300)
    const cycleMs = (60 / hr) * 1000

    // Sub-graph configs
    const pad = { left: 55, right: 15 }
    const ecgH = 55
    const pressH = 115
    const volH = 80
    const gap = 6
    const ecgTop = 30
    const pressTop = ecgTop + ecgH + gap
    const volTop = pressTop + pressH + gap

    const makeConfig = (top: number, h: number, yMin: number, yMax: number): GraphConfig => ({
      ...defaultGraphConfig,
      width, height: h,
      padding: { top: 0, right: pad.right, bottom: 0, left: pad.left },
      xRange: [0, cycleMs],
      yRange: [yMin, yMax],
      gridColor: 'rgba(45,212,191,0.04)',
    })

    const ecgConfig = makeConfig(ecgTop, ecgH, -0.8, 1.6)
    const pressConfig = makeConfig(pressTop, pressH, -5, 140)
    const volConfig = makeConfig(volTop, volH, 30, 140)

    const drawSubgraph = (config: GraphConfig, yOff: number) => {
      ctx.save()
      ctx.translate(0, yOff)

      // Grid
      const area = getPlotArea(config)
      ctx.strokeStyle = config.gridColor
      ctx.lineWidth = 0.5
      const xStep = cycleMs / 10
      for (let x = 0; x <= cycleMs; x += xStep) {
        const cx = toCanvasX(x, config)
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, config.height); ctx.stroke()
      }

      ctx.restore()
    }

    const drawTrace = (config: GraphConfig, yOff: number, data: { x: number; y: number }[], color: string, lw: number = 1.5) => {
      if (data.length < 2) return
      ctx.save()
      ctx.translate(0, yOff)
      ctx.shadowBlur = 6
      ctx.shadowColor = color
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const cx = toCanvasX(data[i].x, config)
        const cy = toCanvasY(data[i].y, config)
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(15,23,42,0.95)'
      ctx.fillRect(0, 0, width, height)

      // Phase bands across full height
      const plotLeft = pad.left
      const plotWidth = width - pad.left - pad.right
      for (const phase of PHASE_BANDS) {
        const x1 = plotLeft + phase.start * plotWidth
        const w = (phase.end - phase.start) * plotWidth
        ctx.fillStyle = phase.color
        ctx.fillRect(x1, ecgTop, w, volTop + volH - ecgTop)

        // Phase label at top
        ctx.font = '7px "DM Mono", monospace'
        ctx.fillStyle = 'rgba(148,163,184,0.35)'
        ctx.textAlign = 'center'
        ctx.fillText(phase.label, x1 + w / 2, ecgTop - 3)
      }

      // Section labels
      ctx.font = '9px "DM Mono", monospace'
      ctx.fillStyle = 'rgba(148,163,184,0.4)'
      ctx.textAlign = 'left'
      ctx.fillText('ECG', 4, ecgTop + ecgH / 2 + 3)
      ctx.fillText('Pressure', 4, pressTop + 14)
      ctx.fillText('(mmHg)', 4, pressTop + 24)
      ctx.fillText('Volume', 4, volTop + 14)
      ctx.fillText('(mL)', 4, volTop + 24)

      // Draw sub-grids
      drawSubgraph(ecgConfig, ecgTop)
      drawSubgraph(pressConfig, pressTop)
      drawSubgraph(volConfig, volTop)

      // Section dividers
      ctx.strokeStyle = 'rgba(148,163,184,0.1)'
      ctx.lineWidth = 0.5;
      [pressTop, volTop].forEach(y => {
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke()
      })

      // ECG trace
      const ecgData = frames.map(f => ({ x: f.time, y: f.ecg }))
      drawTrace(ecgConfig, ecgTop, ecgData, '#2dd4bf', 1.5)

      // Pressure traces
      const aorticData = frames.map(f => ({ x: f.time, y: f.aorticPressure }))
      const ventPressData = frames.map(f => ({ x: f.time, y: f.ventricularPressure }))
      const atrialData = frames.map(f => ({ x: f.time, y: f.atrialPressure }))
      drawTrace(pressConfig, pressTop, aorticData, '#ef4444', 1.5)
      drawTrace(pressConfig, pressTop, ventPressData, '#f97316', 1.5)
      drawTrace(pressConfig, pressTop, atrialData, '#3b82f6', 1.0)

      // Volume trace
      const volData = frames.map(f => ({ x: f.time, y: f.ventricularVolume }))
      drawTrace(volConfig, volTop, volData, '#8b5cf6', 1.5)

      // Animated cursor line
      const cursor = cursorRef.current % frames.length
      const cursorTime = frames[Math.floor(cursor)]?.time || 0
      const cursorX = toCanvasX(cursorTime, ecgConfig) // same X for all subgraphs

      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(cursorX, ecgTop)
      ctx.lineTo(cursorX, volTop + volH)
      ctx.stroke()
      ctx.setLineDash([])

      // Cursor dots on each trace
      const fi = Math.floor(cursor)
      if (fi < frames.length) {
        const f = frames[fi]
        // ECG dot
        ctx.save(); ctx.translate(0, ecgTop)
        ctx.fillStyle = '#2dd4bf'; ctx.beginPath()
        ctx.arc(cursorX, toCanvasY(f.ecg, ecgConfig), 3, 0, Math.PI * 2); ctx.fill()
        ctx.restore()

        // Pressure dots
        ctx.save(); ctx.translate(0, pressTop)
        ctx.fillStyle = '#ef4444'; ctx.beginPath()
        ctx.arc(cursorX, toCanvasY(f.aorticPressure, pressConfig), 3, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#f97316'; ctx.beginPath()
        ctx.arc(cursorX, toCanvasY(f.ventricularPressure, pressConfig), 3, 0, Math.PI * 2); ctx.fill()
        ctx.restore()

        // Volume dot
        ctx.save(); ctx.translate(0, volTop)
        ctx.fillStyle = '#8b5cf6'; ctx.beginPath()
        ctx.arc(cursorX, toCanvasY(f.ventricularVolume, volConfig), 3, 0, Math.PI * 2); ctx.fill()
        ctx.restore()

        // Phase info
        ctx.font = '9px "DM Mono", monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.textAlign = 'center'
        ctx.fillText(f.phase, cursorX, volTop + volH + 14)
      }

      // Legend
      const legendY = height - 14
      const items = [
        { label: 'Aortic P', color: '#ef4444' },
        { label: 'LV P', color: '#f97316' },
        { label: 'Atrial P', color: '#3b82f6' },
        { label: 'LV Vol', color: '#8b5cf6' },
        { label: 'ECG', color: '#2dd4bf' },
      ]
      ctx.font = '8px "DM Mono", monospace'
      let lx = pad.left
      for (const item of items) {
        ctx.fillStyle = item.color
        ctx.fillRect(lx, legendY, 8, 3)
        ctx.fillStyle = 'rgba(148,163,184,0.5)'
        ctx.textAlign = 'left'
        ctx.fillText(item.label, lx + 11, legendY + 3)
        lx += ctx.measureText(item.label).width + 20
      }

      // Time axis
      ctx.font = '8px "DM Mono", monospace'
      ctx.fillStyle = 'rgba(148,163,184,0.3)'
      ctx.textAlign = 'center'
      for (let t = 0; t <= cycleMs; t += cycleMs / 5) {
        ctx.fillText(`${(t / 1000).toFixed(2)}s`, toCanvasX(t, ecgConfig), volTop + volH + 26)
      }

      cursorRef.current += 0.6
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [width, height, hr])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Wiggers Diagram</span>
        <span className="text-[9px] font-mono text-slate-600">Synchronized Cardiac Cycle</span>
      </div>
      <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
    </div>
  )
}
