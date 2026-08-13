import React, { useRef, useEffect, useState } from 'react'
import {
  type GraphConfig, defaultGraphConfig, drawGrid, drawAxisLabels, drawLine, drawDot, drawAnnotation, toCanvasX, toCanvasY, getPlotArea,
} from '../../lib/graphUtils'
import {
  generateECGSample, getDefaultECGParams, ECG_PRESETS, type ECGParams,
} from '../../lib/medicalData'

interface ECGWaveformProps {
  width?: number
  height?: number
  preset?: string
  speed?: number // mm/s
}

export default function ECGWaveform({ width = 520, height = 200, preset = 'normal', speed = 25 }: ECGWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const offsetRef = useRef(0)
  const [activePreset, setActivePreset] = useState(preset)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    const params: ECGParams = {
      ...getDefaultECGParams(),
      ...ECG_PRESETS[activePreset],
    }

    const config: GraphConfig = {
      ...defaultGraphConfig,
      width, height,
      padding: { top: 15, right: 10, bottom: 28, left: 40 },
      xRange: [0, 4],
      yRange: [-0.8, 1.6],
      gridSpacingX: 0.2,
      gridSpacingY: 0.5,
      gridColor: 'rgba(239,68,68,0.06)',
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      // ECG grid (classic red-pink)
      const area = getPlotArea(config)
      ctx.fillStyle = 'rgba(15,23,42,0.95)'
      ctx.fillRect(0, 0, width, height)

      // Fine grid
      ctx.strokeStyle = 'rgba(239,68,68,0.05)'
      ctx.lineWidth = 0.5
      const smallX = (config.xRange[1] - config.xRange[0]) / 40
      const smallY = (config.yRange[1] - config.yRange[0]) / 24
      for (let x = config.xRange[0]; x <= config.xRange[1]; x += smallX) {
        const cx = toCanvasX(x, config)
        ctx.beginPath(); ctx.moveTo(cx, area.y); ctx.lineTo(cx, area.y + area.h); ctx.stroke()
      }
      for (let y = config.yRange[0]; y <= config.yRange[1]; y += smallY) {
        const cy = toCanvasY(y, config)
        ctx.beginPath(); ctx.moveTo(area.x, cy); ctx.lineTo(area.x + area.w, cy); ctx.stroke()
      }

      // Major grid
      drawGrid(ctx, { ...config, gridColor: 'rgba(239,68,68,0.12)' })

      // Baseline
      const baseY = toCanvasY(0, config)
      ctx.strokeStyle = 'rgba(148,163,184,0.15)'
      ctx.lineWidth = 0.5
      ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(area.x, baseY); ctx.lineTo(area.x + area.w, baseY); ctx.stroke()
      ctx.setLineDash([])

      // Generate ECG trace
      const traceData: { x: number; y: number }[] = []
      const timeWindow = config.xRange[1] - config.xRange[0]
      const samples = Math.floor(area.w)
      const timeOffset = offsetRef.current / (speed * 2)

      for (let i = 0; i < samples; i++) {
        const t = (i / samples) * timeWindow + timeOffset
        const v = generateECGSample(t, params)
        traceData.push({ x: (i / samples) * timeWindow, y: v })
      }

      // Draw trace with glow
      drawLine(ctx, config, traceData, '#2dd4bf', 1.8, true)

      // Ghost trace
      const ghostData = traceData.map(p => ({ x: p.x, y: p.y * 0.95 }))
      drawLine(ctx, { ...config, yRange: [config.yRange[0] - 0.05, config.yRange[1] - 0.05] }, ghostData, 'rgba(45,212,191,0.15)', 1.2, false)

      // Wave annotations
      const cycleLen = 60 / params.hr
      const currentCycle = (timeOffset % cycleLen)
      const cycleStart = timeWindow * 0.3
      if (cycleStart < timeWindow - 0.5) {
        drawAnnotation(ctx, config, cycleStart, params.pAmplitude + 0.15, 'P', 'rgba(251,191,36,0.7)')
        drawAnnotation(ctx, config, cycleStart + 0.12, params.qrsAmplitude + 0.2, 'QRS', '#ef4444')
        drawAnnotation(ctx, config, cycleStart + 0.35, params.tAmplitude + 0.15, 'T', 'rgba(99,102,241,0.7)')
      }

      // Labels
      drawAxisLabels(ctx, config, 'Time (s)', 'mV',
        [{ value: 0, label: '0' }, { value: 1, label: '1s' }, { value: 2, label: '2s' }, { value: 3, label: '3s' }],
        [{ value: -0.5, label: '-0.5' }, { value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1.0, label: '1.0' }],
      )

      // HR badge
      ctx.font = 'bold 11px "DM Mono", monospace'
      ctx.fillStyle = '#2dd4bf'
      ctx.textAlign = 'right'
      ctx.fillText(`${params.hr} bpm`, width - 12, 14)

      // Status indicator
      const statusColor = activePreset === 'normal' ? '#2dd4bf' : activePreset === 'stemi' || activePreset === 'afib' ? '#ef4444' : '#fbbf24'
      ctx.fillStyle = statusColor
      ctx.beginPath(); ctx.arc(width - 8, 24, 3, 0, Math.PI * 2); ctx.fill()
      ctx.font = '8px "DM Mono", monospace'
      ctx.fillStyle = 'rgba(148,163,184,0.5)'
      ctx.fillText(activePreset.toUpperCase(), width - 16, 27)

      offsetRef.current += speed === 50 ? 3.2 : 1.6
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [width, height, activePreset, speed])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">ECG Waveform</span>
          <span className="live-indicator w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
        </div>
        <div className="flex gap-1">
          {Object.keys(ECG_PRESETS).map(p => (
            <button key={p} onClick={() => setActivePreset(p)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                activePreset === p
                  ? 'bg-red-900/40 border-red-700/60 text-red-400'
                  : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}>{p}</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
    </div>
  )
}
