// ═══════════════════════════════════════════════════════════════════════════════
//  MEDICAL DATA — Synthetic generators for clinical graphs
// ═══════════════════════════════════════════════════════════════════════════════

// ── Cardio: ECG ────────────────────────────────────────────────────────────────

export interface ECGParams {
  hr: number        // beats per minute
  pAmplitude: number // mV
  qrsAmplitude: number
  tAmplitude: number
  stDeviation: number // ST elevation/depression in mV
  prInterval: number  // ms
  qrsDuration: number // ms
  noise: number       // noise factor 0-1
}

export const ECG_PRESETS: Record<string, Partial<ECGParams>> = {
  normal:    { hr: 72, pAmplitude: 0.15, qrsAmplitude: 1.2, tAmplitude: 0.3, stDeviation: 0, prInterval: 160, qrsDuration: 90, noise: 0.02 },
  tachycardia: { hr: 130, pAmplitude: 0.12, qrsAmplitude: 1.1, tAmplitude: 0.25, stDeviation: 0.05, noise: 0.04 },
  stemi:     { hr: 88, pAmplitude: 0.14, qrsAmplitude: 1.0, tAmplitude: 0.5, stDeviation: 0.3, noise: 0.03 },
  afib:      { hr: 110, pAmplitude: 0.03, qrsAmplitude: 1.15, tAmplitude: 0.28, stDeviation: 0, prInterval: 0, noise: 0.08 },
  bradycardia: { hr: 45, pAmplitude: 0.18, qrsAmplitude: 1.3, tAmplitude: 0.35, stDeviation: 0, noise: 0.02 },
}

export function generateECGSample(t: number, params: ECGParams): number {
  const { hr, pAmplitude, qrsAmplitude, tAmplitude, stDeviation, prInterval, qrsDuration, noise } = params
  const cycleLen = 60 / hr // seconds per beat
  const phase = (t % cycleLen) / cycleLen // 0-1 within beat

  let v = 0

  // P wave (phase 0.0 - 0.12)
  if (phase < 0.12) {
    const p = phase / 0.12
    v = pAmplitude * Math.sin(p * Math.PI)
  }
  // PR segment (0.12 - 0.16)
  // depends on prInterval
  const prEnd = 0.12 + (prInterval / 1000) / cycleLen * 0.3

  // QRS complex
  const qrsStart = Math.max(prEnd, 0.16)
  const qrsEnd = qrsStart + (qrsDuration / 1000) / cycleLen * 0.5
  if (phase >= qrsStart && phase < qrsEnd) {
    const q = (phase - qrsStart) / (qrsEnd - qrsStart)
    if (q < 0.15) {
      v = -qrsAmplitude * 0.15 * Math.sin(q / 0.15 * Math.PI)
    } else if (q < 0.45) {
      v = qrsAmplitude * Math.sin((q - 0.15) / 0.30 * Math.PI)
    } else if (q < 0.65) {
      v = -qrsAmplitude * 0.2 * Math.sin((q - 0.45) / 0.20 * Math.PI)
    } else {
      v = stDeviation * ((q - 0.65) / 0.35)
    }
  }

  // ST segment (qrsEnd - 0.55)
  if (phase >= qrsEnd && phase < 0.55) {
    v = stDeviation
  }

  // T wave (0.55 - 0.75)
  if (phase >= 0.55 && phase < 0.75) {
    const tw = (phase - 0.55) / 0.20
    v = stDeviation + tAmplitude * Math.sin(tw * Math.PI)
  }

  // Add noise
  v += (Math.random() - 0.5) * noise * 2

  return v
}

export function getDefaultECGParams(): ECGParams {
  return {
    hr: 72, pAmplitude: 0.15, qrsAmplitude: 1.2, tAmplitude: 0.3,
    stDeviation: 0, prInterval: 160, qrsDuration: 90, noise: 0.02,
  }
}

// ── Cardio: Pressure-Volume Loop ───────────────────────────────────────────────

export interface PVLoopPoint { volume: number; pressure: number }

export interface PVLoopParams {
  edv: number    // end-diastolic volume (mL)
  esv: number    // end-systolic volume (mL)
  peakPressure: number // mmHg
  edp: number    // end-diastolic pressure (mmHg)
}

export const PV_PRESETS: Record<string, PVLoopParams> = {
  normal:        { edv: 120, esv: 50, peakPressure: 120, edp: 10 },
  heartFailure:  { edv: 180, esv: 130, peakPressure: 90, edp: 25 },
  aorticStenosis:{ edv: 130, esv: 40, peakPressure: 200, edp: 15 },
  mitralRegurg:  { edv: 160, esv: 70, peakPressure: 110, edp: 18 },
  hcm:           { edv: 100, esv: 30, peakPressure: 160, edp: 20 },
}

export function generatePVLoop(params: PVLoopParams, steps: number = 100): PVLoopPoint[] {
  const { edv, esv, peakPressure, edp } = params
  const sv = edv - esv
  const points: PVLoopPoint[] = []

  for (let i = 0; i < steps; i++) {
    const t = i / steps
    let volume: number, pressure: number

    if (t < 0.15) {
      // Isovolumetric contraction
      const p = t / 0.15
      volume = edv
      pressure = edp + (peakPressure * 0.7 - edp) * Math.sin(p * Math.PI / 2)
    } else if (t < 0.45) {
      // Ejection
      const p = (t - 0.15) / 0.30
      volume = edv - sv * Math.sin(p * Math.PI / 2)
      pressure = peakPressure * 0.7 + peakPressure * 0.3 * Math.sin(p * Math.PI * 0.6) 
    } else if (t < 0.60) {
      // Isovolumetric relaxation
      const p = (t - 0.45) / 0.15
      volume = esv
      pressure = peakPressure * (1 - Math.sin(p * Math.PI / 2) * 0.85)
    } else {
      // Filling
      const p = (t - 0.60) / 0.40
      volume = esv + sv * (1 - Math.cos(p * Math.PI)) / 2
      pressure = edp + (peakPressure * 0.12) * Math.sin(p * Math.PI * 0.5)
    }

    points.push({ volume, pressure })
  }

  return points
}

// ── Cardio: Wiggers Diagram ────────────────────────────────────────────────────

export interface WiggersFrame {
  time: number           // ms
  ecg: number            // mV
  aorticPressure: number // mmHg
  ventricularPressure: number // mmHg
  ventricularVolume: number   // mL
  atrialPressure: number     // mmHg
  phase: string
}

export function generateWiggersCycle(hr: number = 72, steps: number = 200): WiggersFrame[] {
  const cycleMs = (60 / hr) * 1000
  const frames: WiggersFrame[] = []
  const ecgParams = getDefaultECGParams()
  ecgParams.hr = hr

  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * cycleMs
    const phase = i / steps
    const ecg = generateECGSample(t / 1000, ecgParams)

    let ventricularPressure: number, aorticPressure: number, ventricularVolume: number, atrialPressure: number
    let phaseName: string

    if (phase < 0.08) {
      // Atrial contraction
      phaseName = 'Atrial Systole'
      ventricularPressure = 8 + phase / 0.08 * 4
      aorticPressure = 80 + (phase / 0.08) * 2
      ventricularVolume = 100 + (phase / 0.08) * 20
      atrialPressure = 5 + (phase / 0.08) * 7
    } else if (phase < 0.18) {
      // IVC
      phaseName = 'Isovolumetric Contraction'
      const p = (phase - 0.08) / 0.10
      ventricularPressure = 12 + p * 68
      aorticPressure = 80 + p * 2
      ventricularVolume = 120
      atrialPressure = 12 - p * 7
    } else if (phase < 0.42) {
      // Ejection
      phaseName = 'Ventricular Ejection'
      const p = (phase - 0.18) / 0.24
      ventricularPressure = 80 + 40 * Math.sin(p * Math.PI * 0.8)
      aorticPressure = 80 + 40 * Math.sin(p * Math.PI * 0.7)
      ventricularVolume = 120 - 70 * Math.sin(p * Math.PI / 2)
      atrialPressure = 5 + p * 8
    } else if (phase < 0.52) {
      // IVR
      phaseName = 'Isovolumetric Relaxation'
      const p = (phase - 0.42) / 0.10
      ventricularPressure = 100 * (1 - p * 0.88)
      aorticPressure = 100 - p * 20
      ventricularVolume = 50
      atrialPressure = 13 - p * 3
    } else {
      // Filling
      phaseName = 'Ventricular Filling'
      const p = (phase - 0.52) / 0.48
      ventricularPressure = 12 * (1 - Math.cos(p * Math.PI)) / 2 + 4
      aorticPressure = 80 + (1 - p) * 5
      ventricularVolume = 50 + 50 * p + 20 * Math.pow(p, 3)
      atrialPressure = 10 - 5 * p
    }

    frames.push({
      time: t,
      ecg,
      aorticPressure,
      ventricularPressure,
      ventricularVolume,
      atrialPressure,
      phase: phaseName,
    })
  }

  return frames
}

// ── Cardio: Hemodynamic Tracings ───────────────────────────────────────────────

export interface HemodynamicChannel {
  name: string
  color: string
  baseline: number
  amplitude: number
  shape: 'arterial' | 'venous' | 'pa' | 'wedge'
}

export const HEMODYNAMIC_CHANNELS: HemodynamicChannel[] = [
  { name: 'Aorta',     color: '#ef4444', baseline: 95,  amplitude: 35, shape: 'arterial' },
  { name: 'LV',        color: '#f97316', baseline: 60,  amplitude: 60, shape: 'arterial' },
  { name: 'PA',        color: '#3b82f6', baseline: 18,  amplitude: 12, shape: 'pa' },
  { name: 'RA',        color: '#8b5cf6', baseline: 5,   amplitude: 4,  shape: 'venous' },
  { name: 'PCWP',      color: '#06b6d4', baseline: 10,  amplitude: 5,  shape: 'wedge' },
]

export function generateHemodynamicSample(t: number, channel: HemodynamicChannel, hr: number = 72): number {
  const cycleLen = 60 / hr
  const phase = (t % cycleLen) / cycleLen
  const { baseline, amplitude, shape } = channel

  let v = baseline
  switch (shape) {
    case 'arterial':
      v = baseline + amplitude * Math.pow(Math.sin(phase * Math.PI), 1.5) * (phase < 0.4 ? 1 : 0.4)
      if (phase > 0.35 && phase < 0.45) v += amplitude * 0.15 // dicrotic notch
      break
    case 'venous':
      v = baseline + amplitude * (0.5 * Math.sin(phase * Math.PI * 2) + 0.3 * Math.sin(phase * Math.PI * 4 + 1))
      break
    case 'pa':
      v = baseline + amplitude * Math.sin(phase * Math.PI) * (phase < 0.5 ? 1 : 0.5)
      break
    case 'wedge':
      v = baseline + amplitude * (0.4 * Math.sin(phase * Math.PI * 2) + 0.2 * Math.sin(phase * Math.PI * 3))
      break
  }

  return v + (Math.random() - 0.5) * 1.5
}

// ── Cardio: Framingham Risk ────────────────────────────────────────────────────

export interface FraminghamData {
  age: number; totalChol: number; hdl: number; sbp: number;
  smoker: boolean; diabetic: boolean; score: number
}

export function generateFraminghamScatter(n: number = 50): FraminghamData[] {
  return Array.from({ length: n }, () => {
    const age = 35 + Math.random() * 40
    const totalChol = 150 + Math.random() * 150
    const hdl = 30 + Math.random() * 50
    const sbp = 100 + Math.random() * 60
    const smoker = Math.random() > 0.7
    const diabetic = Math.random() > 0.85
    const score = Math.min(30, Math.max(1,
      (age - 35) * 0.15 + (totalChol - 200) * 0.02 + (60 - hdl) * 0.05 +
      (sbp - 120) * 0.04 + (smoker ? 3 : 0) + (diabetic ? 4 : 0) +
      (Math.random() - 0.5) * 4
    ))
    return { age, totalChol, hdl, sbp, smoker, diabetic, score }
  })
}

// ── Neuro: Connectome ──────────────────────────────────────────────────────────

export interface BrainRegion {
  id: string; label: string; lobe: string
  x: number; y: number; centrality: number
}

export interface BrainConnection {
  source: string; target: string; strength: number; type: 'structural' | 'functional'
}

export const BRAIN_REGIONS: BrainRegion[] = [
  { id: 'pfc', label: 'Prefrontal Cortex', lobe: 'frontal', x: 0.5, y: 0.1, centrality: 0.92 },
  { id: 'mc', label: 'Motor Cortex', lobe: 'frontal', x: 0.4, y: 0.25, centrality: 0.78 },
  { id: 'bro', label: "Broca's Area", lobe: 'frontal', x: 0.25, y: 0.3, centrality: 0.65 },
  { id: 'sc', label: 'Somatosensory', lobe: 'parietal', x: 0.55, y: 0.25, centrality: 0.72 },
  { id: 'ppc', label: 'Posterior Parietal', lobe: 'parietal', x: 0.65, y: 0.3, centrality: 0.68 },
  { id: 'wer', label: "Wernicke's Area", lobe: 'temporal', x: 0.7, y: 0.5, centrality: 0.70 },
  { id: 'hip', label: 'Hippocampus', lobe: 'temporal', x: 0.5, y: 0.55, centrality: 0.88 },
  { id: 'amg', label: 'Amygdala', lobe: 'temporal', x: 0.4, y: 0.6, centrality: 0.82 },
  { id: 'vc', label: 'Visual Cortex', lobe: 'occipital', x: 0.5, y: 0.85, centrality: 0.75 },
  { id: 'cb', label: 'Cerebellum', lobe: 'cerebellum', x: 0.5, y: 0.95, centrality: 0.60 },
  { id: 'th', label: 'Thalamus', lobe: 'subcortical', x: 0.5, y: 0.45, centrality: 0.95 },
  { id: 'bg', label: 'Basal Ganglia', lobe: 'subcortical', x: 0.35, y: 0.45, centrality: 0.80 },
  { id: 'ins', label: 'Insula', lobe: 'temporal', x: 0.3, y: 0.5, centrality: 0.73 },
  { id: 'acc', label: 'Ant. Cingulate', lobe: 'frontal', x: 0.45, y: 0.35, centrality: 0.85 },
]

export function generateConnectome(diseaseState: string = 'normal'): BrainConnection[] {
  const connections: BrainConnection[] = []
  const disruptionMap: Record<string, string[]> = {
    alzheimers: ['hip', 'pfc', 'th', 'acc'],
    epilepsy: ['hip', 'amg', 'th'],
    depression: ['pfc', 'amg', 'acc', 'ins'],
    tbi: ['pfc', 'mc', 'sc'],
  }
  const disrupted = disruptionMap[diseaseState] || []

  for (let i = 0; i < BRAIN_REGIONS.length; i++) {
    for (let j = i + 1; j < BRAIN_REGIONS.length; j++) {
      const a = BRAIN_REGIONS[i], b = BRAIN_REGIONS[j]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      let strength = Math.max(0, 1 - dist * 2) * (0.3 + Math.random() * 0.7)

      // Disrupt connections for disease states
      if (disrupted.includes(a.id) || disrupted.includes(b.id)) {
        strength *= (0.2 + Math.random() * 0.3)
      }

      if (strength > 0.15) {
        connections.push({
          source: a.id, target: b.id, strength,
          type: Math.random() > 0.5 ? 'structural' : 'functional',
        })
      }
    }
  }
  return connections
}

// ── Neuro: Metrics ─────────────────────────────────────────────────────────────

export interface NeuroMetricsData {
  smallWorldness: number
  clusteringCoeff: number
  globalEfficiency: number
  pathLength: number
  modularity: number
  hubRegions: { region: string; betweenness: number }[]
}

export function generateNeuroMetrics(disease: string = 'normal'): NeuroMetricsData {
  const baselines: Record<string, Partial<NeuroMetricsData>> = {
    normal:     { smallWorldness: 2.8, clusteringCoeff: 0.45, globalEfficiency: 0.62, pathLength: 2.3, modularity: 0.42 },
    alzheimers: { smallWorldness: 1.6, clusteringCoeff: 0.28, globalEfficiency: 0.38, pathLength: 3.8, modularity: 0.55 },
    epilepsy:   { smallWorldness: 3.5, clusteringCoeff: 0.58, globalEfficiency: 0.55, pathLength: 2.1, modularity: 0.35 },
    depression: { smallWorldness: 2.2, clusteringCoeff: 0.35, globalEfficiency: 0.48, pathLength: 2.9, modularity: 0.48 },
    tbi:        { smallWorldness: 1.9, clusteringCoeff: 0.30, globalEfficiency: 0.35, pathLength: 3.5, modularity: 0.52 },
  }
  const b = baselines[disease] || baselines.normal!

  const jitter = (v: number) => v + (Math.random() - 0.5) * v * 0.1

  return {
    smallWorldness: jitter(b.smallWorldness!),
    clusteringCoeff: jitter(b.clusteringCoeff!),
    globalEfficiency: jitter(b.globalEfficiency!),
    pathLength: jitter(b.pathLength!),
    modularity: jitter(b.modularity!),
    hubRegions: BRAIN_REGIONS
      .sort((a, b) => b.centrality - a.centrality)
      .slice(0, 5)
      .map(r => ({ region: r.label, betweenness: jitter(r.centrality) })),
  }
}

// ── Pulmo: Spirometry ──────────────────────────────────────────────────────────

export interface SpirometryPoint { x: number; y: number }

export interface SpirometryParams {
  fvc: number     // L
  fev1: number    // L
  pef: number     // L/s
  fef2575: number // L/s (mid-flow)
  pattern: 'normal' | 'obstructive' | 'restrictive'
}

export const SPIROMETRY_PRESETS: Record<string, SpirometryParams> = {
  normal:      { fvc: 4.8, fev1: 3.9, pef: 9.5, fef2575: 4.5, pattern: 'normal' },
  obstructive: { fvc: 4.2, fev1: 2.0, pef: 5.0, fef2575: 1.5, pattern: 'obstructive' },
  restrictive: { fvc: 2.8, fev1: 2.3, pef: 7.0, fef2575: 3.5, pattern: 'restrictive' },
}

export function generateFlowVolumeLoop(params: SpirometryParams, steps: number = 200): SpirometryPoint[] {
  const { fvc, pef, pattern } = params
  const points: SpirometryPoint[] = []

  // Expiratory limb
  for (let i = 0; i < steps / 2; i++) {
    const t = i / (steps / 2)
    const vol = t * fvc
    let flow: number

    switch (pattern) {
      case 'obstructive':
        // Scooped-out appearance
        flow = pef * Math.pow(1 - t, 0.4) * Math.exp(-t * 2.5)
        if (t < 0.1) flow = pef * (t / 0.1)
        break
      case 'restrictive':
        // Miniature normal shape ("witch's hat")
        flow = pef * Math.pow(1 - t, 0.8)
        if (t < 0.08) flow = pef * (t / 0.08)
        break
      default:
        // Normal
        flow = pef * Math.pow(1 - t, 0.7)
        if (t < 0.08) flow = pef * (t / 0.08)
    }
    points.push({ x: vol, y: flow })
  }

  // Inspiratory limb (roughly semicircular)
  for (let i = steps / 2; i < steps; i++) {
    const t = (i - steps / 2) / (steps / 2)
    const vol = fvc * (1 - t)
    const flow = -pef * 0.7 * Math.sin(t * Math.PI)
    points.push({ x: vol, y: flow })
  }

  return points
}

export function generateVolumeTimeCurve(params: SpirometryParams, steps: number = 200): SpirometryPoint[] {
  const { fvc, fev1, pattern } = params
  const points: SpirometryPoint[] = []
  const totalTime = 6 // seconds

  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * totalTime
    let vol: number

    switch (pattern) {
      case 'obstructive':
        // Slow rise, doesn't plateau quickly
        vol = fvc * (1 - Math.exp(-t * 0.5))
        break
      case 'restrictive':
        // Fast rise but small total volume
        vol = fvc * (1 - Math.exp(-t * 2.0))
        break
      default:
        vol = fvc * (1 - Math.exp(-t * 1.2))
    }

    points.push({ x: t, y: Math.min(fvc, vol) })
  }

  return points
}

// ── Pulmo: Pressure-Volume (transpulmonary) ────────────────────────────────────

export interface LungPVParams {
  compliance: number // mL/cmH2O
  frc: number        // functional residual capacity (mL)
  tlc: number        // total lung capacity (mL)
  pattern: 'normal' | 'fibrosis' | 'emphysema'
}

export const LUNG_PV_PRESETS: Record<string, LungPVParams> = {
  normal:    { compliance: 200, frc: 2400, tlc: 6000, pattern: 'normal' },
  fibrosis:  { compliance: 80,  frc: 1800, tlc: 3500, pattern: 'fibrosis' },
  emphysema: { compliance: 350, frc: 3500, tlc: 7500, pattern: 'emphysema' },
}

export function generateLungPVLoop(params: LungPVParams, steps: number = 100): SpirometryPoint[] {
  const { compliance, frc, tlc } = params
  const points: SpirometryPoint[] = []
  const maxPressure = (tlc - frc) / compliance * 10

  // Inspiration
  for (let i = 0; i < steps / 2; i++) {
    const t = i / (steps / 2)
    const pressure = t * maxPressure
    const volume = frc + (tlc - frc) * (1 - Math.exp(-t * 2.5)) * 0.9
    points.push({ x: pressure, y: volume })
  }

  // Expiration (hysteresis — curve above inspiration)
  for (let i = steps / 2; i < steps; i++) {
    const t = (i - steps / 2) / (steps / 2)
    const pressure = maxPressure * (1 - t)
    const volume = frc + (tlc - frc) * (1 - Math.pow(t, 1.5)) * 0.95
    points.push({ x: pressure, y: volume })
  }

  return points
}

// ── Color Palettes ─────────────────────────────────────────────────────────────

export const LOBE_COLORS: Record<string, string> = {
  frontal: '#ef4444',
  parietal: '#f59e0b',
  temporal: '#3b82f6',
  occipital: '#10b981',
  cerebellum: '#8b5cf6',
  subcortical: '#ec4899',
}

export const CATEGORY_COLORS = {
  cardio: { primary: '#ef4444', secondary: '#f97316', accent: '#fbbf24', bg: 'rgba(239,68,68,0.08)' },
  neuro:  { primary: '#8b5cf6', secondary: '#6366f1', accent: '#a78bfa', bg: 'rgba(139,92,246,0.08)' },
  pulmo:  { primary: '#06b6d4', secondary: '#10b981', accent: '#2dd4bf', bg: 'rgba(6,182,212,0.08)' },
}
