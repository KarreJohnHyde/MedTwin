import React, { useState, useEffect, useMemo } from 'react'
import {
  type ForceNode, type ForceEdge, simulateForce,
} from '../../lib/graphUtils'
import {
  BRAIN_REGIONS, generateConnectome, LOBE_COLORS,
} from '../../lib/medicalData'

interface ConnectomeProps {
  width?: number
  height?: number
}

export default function ConnectomeViewer({ width = 450, height = 350 }: ConnectomeProps) {
  const [mode, setMode] = useState<'structural' | 'functional'>('structural')
  const [disease, setDisease] = useState('normal')
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const connections = useMemo(() => generateConnectome(disease), [disease])

  const filteredConns = useMemo(() =>
    connections.filter(c => c.type === mode || mode === 'structural'),
    [connections, mode]
  )

  const nodes: ForceNode[] = useMemo(() => {
    const initial = BRAIN_REGIONS.map(r => ({
      id: r.id,
      label: r.label,
      x: r.x * width,
      y: r.y * height,
      vx: 0, vy: 0,
      radius: 6 + r.centrality * 12,
      color: LOBE_COLORS[r.lobe] || '#94a3b8',
      group: r.lobe,
    }))

    const edges: ForceEdge[] = filteredConns.map(c => ({
      source: c.source,
      target: c.target,
      strength: c.strength,
      color: `rgba(148,163,184,${c.strength * 0.5})`,
    }))

    return simulateForce(initial, edges, width, height, 100)
  }, [width, height, filteredConns])

  // Circular connectogram coordinates
  const circularNodes = useMemo(() => {
    return BRAIN_REGIONS.map((r, i) => {
      const angle = (i / BRAIN_REGIONS.length) * Math.PI * 2 - Math.PI / 2
      const cx = width / 2 + Math.cos(angle) * (Math.min(width, height) / 2 - 40)
      const cy = height / 2 + Math.sin(angle) * (Math.min(width, height) / 2 - 40)
      return { ...r, cx, cy }
    })
  }, [width, height])

  const [layout, setLayout] = useState<'force' | 'circular'>('circular')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Brain Connectome</span>
        <div className="flex gap-1">
          {['structural', 'functional'].map(m => (
            <button key={m} onClick={() => setMode(m as any)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                mode === m ? 'bg-purple-900/40 border-purple-700/60 text-purple-400'
                  : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}>{m}</button>
          ))}
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          {['circular', 'force'].map(l => (
            <button key={l} onClick={() => setLayout(l as any)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                layout === l ? 'bg-indigo-900/40 border-indigo-700/60 text-indigo-400'
                  : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {['normal', 'alzheimers', 'epilepsy', 'depression', 'tbi'].map(d => (
          <button key={d} onClick={() => setDisease(d)}
            className={`px-2 py-0.5 text-[8px] font-mono rounded border transition-colors capitalize ${
              disease === d ? 'bg-purple-900/30 border-purple-700/50 text-purple-400'
                : 'border-slate-800 text-slate-700 hover:text-slate-500'
            }`}>{d === 'alzheimers' ? "Alzheimer's" : d === 'tbi' ? 'TBI' : d}</button>
        ))}
      </div>

      <svg width={width} height={height} className="rounded-lg" style={{ background: 'rgba(15,23,42,0.95)' }}>
        {/* Connections */}
        {filteredConns.map((conn, i) => {
          const src = layout === 'circular'
            ? circularNodes.find(n => n.id === conn.source)
            : nodes.find(n => n.id === conn.source)
          const tgt = layout === 'circular'
            ? circularNodes.find(n => n.id === conn.target)
            : nodes.find(n => n.id === conn.target)
          if (!src || !tgt) return null

          const sx = layout === 'circular' ? (src as any).cx : src.x
          const sy = layout === 'circular' ? (src as any).cy : src.y
          const tx = layout === 'circular' ? (tgt as any).cx : tgt.x
          const ty = layout === 'circular' ? (tgt as any).cy : tgt.y

          const isHovered = hoveredNode === conn.source || hoveredNode === conn.target
          const opacity = hoveredNode
            ? (isHovered ? conn.strength * 0.8 : conn.strength * 0.08)
            : conn.strength * 0.4

          // Curved line for circular layout
          if (layout === 'circular') {
            const midX = width / 2 + (sx + tx - width) * 0.15
            const midY = height / 2 + (sy + ty - height) * 0.15
            return (
              <path key={i}
                d={`M ${sx} ${sy} Q ${midX} ${midY} ${tx} ${ty}`}
                fill="none"
                stroke={conn.type === 'structural' ? '#8b5cf6' : '#6366f1'}
                strokeWidth={conn.strength * 2.5}
                opacity={opacity}
                className="transition-opacity duration-200"
              />
            )
          }

          return (
            <line key={i}
              x1={sx} y1={sy} x2={tx} y2={ty}
              stroke={conn.type === 'structural' ? '#8b5cf6' : '#6366f1'}
              strokeWidth={conn.strength * 2.5}
              opacity={opacity}
              className="transition-opacity duration-200"
            />
          )
        })}

        {/* Nodes */}
        {(layout === 'circular' ? circularNodes : nodes).map((n: any) => {
          const region = BRAIN_REGIONS.find(r => r.id === (n.id || n.id))!
          const cx = layout === 'circular' ? n.cx : n.x
          const cy = layout === 'circular' ? n.cy : n.y
          const r = 6 + region.centrality * 10
          const isHovered = hoveredNode === region.id
          const color = LOBE_COLORS[region.lobe] || '#94a3b8'

          return (
            <g key={region.id}
              onMouseEnter={() => setHoveredNode(region.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}>
              {/* Glow ring */}
              {isHovered && (
                <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={color} strokeWidth={1} opacity={0.3}>
                  <animate attributeName="r" values={`${r + 4};${r + 8};${r + 4}`} dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={cx} cy={cy} r={r}
                fill={`${color}${isHovered ? '60' : '25'}`}
                stroke={color}
                strokeWidth={isHovered ? 2 : 1.2}
                className="transition-all duration-200"
              />
              <text x={cx} y={cy + (layout === 'circular' ? r + 10 : 3)}
                textAnchor="middle" fill={color}
                fontSize={isHovered ? 9 : 7}
                fontFamily="DM Mono, monospace"
                fontWeight={isHovered ? '600' : '400'}
                className="transition-all duration-200">
                {region.label.length > 12 ? region.id.toUpperCase() : region.label}
              </text>
              {/* Centrality badge */}
              {isHovered && (
                <text x={cx} y={cy - r - 5}
                  textAnchor="middle" fill="rgba(148,163,184,0.6)"
                  fontSize={7} fontFamily="DM Mono, monospace">
                  C: {region.centrality.toFixed(2)}
                </text>
              )}
            </g>
          )
        })}

        {/* Lobe legend */}
        {Object.entries(LOBE_COLORS).map(([lobe, color], i) => (
          <g key={lobe} transform={`translate(8, ${height - 12 - i * 12})`}>
            <rect width={6} height={6} rx={1} fill={color} opacity={0.6} />
            <text x={10} y={5} fontSize={7} fill="rgba(148,163,184,0.4)" fontFamily="DM Mono, monospace" className="capitalize">{lobe}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
