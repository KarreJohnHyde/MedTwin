// ═══════════════════════════════════════════════════════════════════════════════
//  GRAPH UTILITIES — Shared rendering infrastructure for clinical graphs
// ═══════════════════════════════════════════════════════════════════════════════

// ── Canvas Graph Renderer ──────────────────────────────────────────────────────

export interface GraphConfig {
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
  xRange: [number, number]
  yRange: [number, number]
  gridColor: string
  axisColor: string
  backgroundColor: string
  gridLines: boolean
  gridSpacingX?: number
  gridSpacingY?: number
}

export const defaultGraphConfig: GraphConfig = {
  width: 400, height: 250,
  padding: { top: 20, right: 20, bottom: 35, left: 50 },
  xRange: [0, 100], yRange: [0, 100],
  gridColor: 'rgba(45,212,191,0.06)',
  axisColor: 'rgba(148,163,184,0.3)',
  backgroundColor: 'transparent',
  gridLines: true,
}

export function getPlotArea(config: GraphConfig) {
  const { width, height, padding } = config
  return {
    x: padding.left,
    y: padding.top,
    w: width - padding.left - padding.right,
    h: height - padding.top - padding.bottom,
  }
}

export function toCanvasX(value: number, config: GraphConfig): number {
  const area = getPlotArea(config)
  return area.x + ((value - config.xRange[0]) / (config.xRange[1] - config.xRange[0])) * area.w
}

export function toCanvasY(value: number, config: GraphConfig): number {
  const area = getPlotArea(config)
  return area.y + area.h - ((value - config.yRange[0]) / (config.yRange[1] - config.yRange[0])) * area.h
}

export function drawGrid(ctx: CanvasRenderingContext2D, config: GraphConfig) {
  const area = getPlotArea(config)
  const { xRange, yRange, gridColor, axisColor } = config

  // Background
  if (config.backgroundColor !== 'transparent') {
    ctx.fillStyle = config.backgroundColor
    ctx.fillRect(0, 0, config.width, config.height)
  }

  if (!config.gridLines) return

  const xSpacing = config.gridSpacingX || (xRange[1] - xRange[0]) / 8
  const ySpacing = config.gridSpacingY || (yRange[1] - yRange[0]) / 6

  // Vertical grid
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 0.5
  for (let x = xRange[0]; x <= xRange[1]; x += xSpacing) {
    const cx = toCanvasX(x, config)
    ctx.beginPath(); ctx.moveTo(cx, area.y); ctx.lineTo(cx, area.y + area.h); ctx.stroke()
  }

  // Horizontal grid
  for (let y = yRange[0]; y <= yRange[1]; y += ySpacing) {
    const cy = toCanvasY(y, config)
    ctx.beginPath(); ctx.moveTo(area.x, cy); ctx.lineTo(area.x + area.w, cy); ctx.stroke()
  }

  // Axes
  ctx.strokeStyle = axisColor
  ctx.lineWidth = 1
  // X axis
  ctx.beginPath(); ctx.moveTo(area.x, area.y + area.h); ctx.lineTo(area.x + area.w, area.y + area.h); ctx.stroke()
  // Y axis
  ctx.beginPath(); ctx.moveTo(area.x, area.y); ctx.lineTo(area.x, area.y + area.h); ctx.stroke()
}

export function drawAxisLabels(
  ctx: CanvasRenderingContext2D,
  config: GraphConfig,
  xLabel: string,
  yLabel: string,
  xTicks?: { value: number; label: string }[],
  yTicks?: { value: number; label: string }[],
) {
  const area = getPlotArea(config)

  ctx.font = '9px "DM Mono", monospace'
  ctx.fillStyle = 'rgba(148,163,184,0.5)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  // X-axis label
  ctx.fillText(xLabel, area.x + area.w / 2, area.y + area.h + 22)

  // Y-axis label (rotated)
  ctx.save()
  ctx.translate(8, area.y + area.h / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(yLabel, 0, 0)
  ctx.restore()

  // X ticks
  if (xTicks) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const tick of xTicks) {
      const cx = toCanvasX(tick.value, config)
      ctx.fillText(tick.label, cx, area.y + area.h + 4)
    }
  }

  // Y ticks
  if (yTicks) {
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const tick of yTicks) {
      const cy = toCanvasY(tick.value, config)
      ctx.fillText(tick.label, area.x - 6, cy)
    }
  }
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  config: GraphConfig,
  data: { x: number; y: number }[],
  color: string,
  lineWidth: number = 1.5,
  glow: boolean = false,
) {
  if (data.length < 2) return

  if (glow) {
    ctx.shadowBlur = 8
    ctx.shadowColor = color
  }

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()

  for (let i = 0; i < data.length; i++) {
    const cx = toCanvasX(data[i].x, config)
    const cy = toCanvasY(data[i].y, config)
    if (i === 0) ctx.moveTo(cx, cy)
    else ctx.lineTo(cx, cy)
  }

  ctx.stroke()
  ctx.shadowBlur = 0
}

export function drawFilledArea(
  ctx: CanvasRenderingContext2D,
  config: GraphConfig,
  data: { x: number; y: number }[],
  color: string,
  opacity: number = 0.15,
) {
  if (data.length < 2) return
  const area = getPlotArea(config)

  ctx.fillStyle = color.replace(')', `,${opacity})`).replace('rgb', 'rgba')
  ctx.beginPath()
  ctx.moveTo(toCanvasX(data[0].x, config), area.y + area.h)

  for (const pt of data) {
    ctx.lineTo(toCanvasX(pt.x, config), toCanvasY(pt.y, config))
  }

  ctx.lineTo(toCanvasX(data[data.length - 1].x, config), area.y + area.h)
  ctx.closePath()
  ctx.fill()
}

export function drawDot(
  ctx: CanvasRenderingContext2D,
  config: GraphConfig,
  x: number,
  y: number,
  radius: number,
  color: string,
  glow: boolean = true,
) {
  const cx = toCanvasX(x, config)
  const cy = toCanvasY(y, config)

  if (glow) {
    ctx.shadowBlur = 10
    ctx.shadowColor = color
  }

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  config: GraphConfig,
  x: number,
  y: number,
  label: string,
  color: string,
) {
  const cx = toCanvasX(x, config)
  const cy = toCanvasY(y, config)

  ctx.font = '8px "DM Mono", monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(label, cx, cy - 8)

  // Small vertical line
  ctx.strokeStyle = color
  ctx.lineWidth = 0.5
  ctx.setLineDash([2, 2])
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, cy - 5)
  ctx.stroke()
  ctx.setLineDash([])
}

// ── SVG Force-Directed Graph ───────────────────────────────────────────────────

export interface ForceNode {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  group: string
}

export interface ForceEdge {
  source: string
  target: string
  strength: number
  color: string
}

export function simulateForce(
  nodes: ForceNode[],
  edges: ForceEdge[],
  width: number,
  height: number,
  iterations: number = 1,
): ForceNode[] {
  const repulsion = 2000
  const attraction = 0.005
  const damping = 0.85
  const centerPull = 0.01

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dist = Math.max(1, Math.hypot(dx, dy))
        const force = repulsion / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        nodes[i].vx += fx; nodes[i].vy += fy
        nodes[j].vx -= fx; nodes[j].vy -= fy
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const source = nodes.find(n => n.id === edge.source)
      const target = nodes.find(n => n.id === edge.target)
      if (!source || !target) continue
      const dx = target.x - source.x
      const dy = target.y - source.y
      const force = attraction * edge.strength
      source.vx += dx * force; source.vy += dy * force
      target.vx -= dx * force; target.vy -= dy * force
    }

    // Center pull & damping
    for (const node of nodes) {
      node.vx += (width / 2 - node.x) * centerPull
      node.vy += (height / 2 - node.y) * centerPull
      node.vx *= damping
      node.vy *= damping
      node.x += node.vx
      node.y += node.vy
      // Clamp
      node.x = Math.max(30, Math.min(width - 30, node.x))
      node.y = Math.max(30, Math.min(height - 30, node.y))
    }
  }

  return nodes
}

// ── Phase label helper for Wiggers ─────────────────────────────────────────────

export const CARDIAC_PHASES = [
  { start: 0, end: 0.08, label: 'Atrial Systole', color: 'rgba(251,191,36,0.15)' },
  { start: 0.08, end: 0.18, label: 'IVC', color: 'rgba(248,113,113,0.15)' },
  { start: 0.18, end: 0.42, label: 'Ejection', color: 'rgba(239,68,68,0.2)' },
  { start: 0.42, end: 0.52, label: 'IVR', color: 'rgba(99,102,241,0.15)' },
  { start: 0.52, end: 1.0, label: 'Filling', color: 'rgba(45,212,191,0.12)' },
]
