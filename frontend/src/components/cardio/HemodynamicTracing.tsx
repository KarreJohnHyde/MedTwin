import React, { useRef, useEffect, useState } from 'react'
import {
  type GraphConfig, defaultGraphConfig, drawGrid, drawAxisLabels, drawLine, getPlotArea, toCanvasX, toCanvasY,
} from '../../lib/graphUtils'
import {
  HEMODYNAMIC_CHANNELS, generateHemodynamicSample, type HemodynamicChannel,
} from '../../lib/medicalData'

interface HemodynamicProps {
  width?: number
  height?: number
  hr?: number
}

export default function HemodynamicTracing({ width = 480, height = 220, hr = 72 }: HemodynamicProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const offsetRef = useRef(0)
  const [activeChannels, setActiveChannels] = useState<Set<string>>(new Set(['Aorta', 'LV', 'PA']))

  const toggleChannel = (name: string) => {
    setActiveChannels(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

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
      padding: { top: 15, right: 15, bottom: 32, left: 45 },
      xRange: [0, 4],
      yRange: [-5, 150],
      gridSpacingX: 0.5,
      gridSpacingY: 25,
    }

    const bufferLen = 400

    // Maintain rolling buffers per channel
    const buffers: Record<string, number[]> = {}
    for (const ch of HEMODYNAMIC_CHANNELS) {
      buffers[ch.name] = Array(bufferLen).fill(ch.baseline)
    }

    const draw = () => {
      // Push new samples
      const t = offsetRef.current / 60
      for (const ch of HEMODYNAMIC_CHANNELS) {
        buffers[ch.name].push(generateHemodynamicSample(t, ch, hr))
        if (buffers[ch.name].length > bufferLen) buffers[ch.name].shift()
      }

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(15,23,42,0.95)'
      ctx.fillRect(0, 0, width, height)

      drawGrid(ctx, config)

      // Draw active channels
      for (const ch of HEMODYNAMIC_CHANNELS) {
        if (!activeChannels.has(ch.name)) continue

        const data = buffers[ch.name].map((v, i) => ({
          x: (i / bufferLen) * (config.xRange[1] - config.xRange[0]),
          y: v,
        }))

        drawLine(ctx, config, data, ch.color, 1.5, true)

        // Current value badge
        const current = buffers[ch.name][buffers[ch.name].length - 1]
        const area = getPlotArea(config)
        const cy = toCanvasY(current, config)
        ctx.fillStyle = ch.color
        ctx.font = 'bold 9px "DM Mono", monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`${current.toFixed(0)}`, area.x + area.w + 2, cy + 3)
      }

      drawAxisLabels(ctx, config, 'Time (s)', 'mmHg',
        [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }],
        [{ value: 0, label: '0' }, { value: 50, label: '50' }, { value: 100, label: '100' }, { value: 150, label: '150' }],
      )

      offsetRef.current += 1
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [width, height, hr, activeChannels])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Hemodynamic Tracings</span>
        <span className="text-[9px] font-mono text-slate-600">Catheterization</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {HEMODYNAMIC_CHANNELS.map(ch => (
          <button key={ch.name} onClick={() => toggleChannel(ch.name)}
            className={`flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono rounded border transition-all ${
              activeChannels.has(ch.name)
                ? 'border-slate-600 text-slate-300'
                : 'border-slate-800 text-slate-700'
            }`}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeChannels.has(ch.name) ? ch.color : 'rgba(100,116,139,0.3)' }} />
            {ch.name}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />
    </div>
  )
}
