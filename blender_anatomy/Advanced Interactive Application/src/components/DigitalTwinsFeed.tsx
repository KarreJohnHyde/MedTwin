import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ═══════════════════════════════════════════════════════════════════════════════
//  MINI 3D ORGAN VIEWER — Renders real .glb Blender models inline
// ═══════════════════════════════════════════════════════════════════════════════
const MiniOrganViewer: React.FC<{ glbPath: string; accentHex: string }> = ({ glbPath, accentHex }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 100);
    camera.position.set(0, 0, 3.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.PointLight(new THREE.Color(accentHex).getHex(), 1.5, 10);
    rim.position.set(-2, -1, 2);
    scene.add(rim);

    // Load GLB
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);

    let model: THREE.Object3D | null = null;

    loader.load(
      glbPath,
      (gltf) => {
        model = gltf.scene;
        // Auto-center and scale
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.0 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        scene.add(model);
      },
      undefined,
      (err) => console.warn('Mini viewer load error:', err)
    );

    // Animate (slow auto-rotate)
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (model) model.rotation.y += 0.006;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [glbPath, accentHex]);

  return <div ref={mountRef} className="w-full h-full" />;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  LIVE WAVEFORM CANVAS
// ═══════════════════════════════════════════════════════════════════════════════
const LiveWaveform: React.FC<{
  type: 'ecg' | 'eeg' | 'pleth' | 'renal' | 'hepatic';
  color: string;
  glowColor: string;
  riskFactor: number;
}> = ({ type, color, glowColor, riskFactor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let offset = 0;
    const points: number[] = new Array(250).fill(0);
    const maxPoints = 250;

    const generateSample = (): number => {
      switch (type) {
        case 'ecg': {
          const phase = offset % 90;
          if (phase < 4) return Math.sin(phase * 1.2) * 35 * (1 + riskFactor * 0.4);
          if (phase < 8) return -Math.sin((phase - 4) * 0.9) * 12;
          return (Math.random() - 0.5) * 3;
        }
        case 'eeg':
          return Math.sin(offset * 0.12) * 8 + Math.sin(offset * 0.47) * 6
            + Math.cos(offset * 0.31) * 4 + (Math.random() - 0.5) * 12 * (1 + riskFactor);
        case 'pleth':
          return Math.sin(offset * 0.055) * 22 * (1 - riskFactor * 0.3)
            + Math.sin(offset * 0.11) * 6 + (Math.random() - 0.5) * 2;
        case 'renal':
          return Math.sin(offset * 0.08) * 15 + Math.cos(offset * 0.15) * 8
            + (Math.random() - 0.5) * 6 * (1 + riskFactor);
        case 'hepatic':
          return Math.sin(offset * 0.06) * 10 + Math.sin(offset * 0.22) * 12 * riskFactor
            + (Math.random() - 0.5) * 4;
        default: return 0;
      }
    };

    const draw = () => {
      points.push(generateSample());
      if (points.length > maxPoints) points.shift();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = 'rgba(148,163,184,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 16) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
      for (let y = 0; y < canvas.height; y += 16) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
      ctx.stroke();

      // Trace
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 8;
      ctx.shadowColor = glowColor;
      for (let i = 0; i < points.length; i++) {
        const x = (i / maxPoints) * canvas.width;
        const y = canvas.height / 2 - points[i];
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      offset++;
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line
    var animId = 0; // hoisted for cleanup
  }, [type, color, glowColor, riskFactor]);

  // Fix: proper cleanup
  useEffect(() => {
    return () => {};
  }, []);

  return (
    <canvas ref={canvasRef} width={480} height={100}
      className="w-full h-full rounded" />
  );
};

// Simpler version with correct cleanup:
const LiveWaveformFixed: React.FC<{
  type: 'ecg' | 'eeg' | 'pleth' | 'renal' | 'hepatic';
  color: string;
  glowColor: string;
  riskFactor: number;
}> = ({ type, color, glowColor, riskFactor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let offset = 0;
    const points: number[] = new Array(250).fill(0);
    const maxPoints = 250;

    const gen = (): number => {
      switch (type) {
        case 'ecg': {
          const p = offset % 90;
          if (p < 4) return Math.sin(p * 1.2) * 35 * (1 + riskFactor * 0.4);
          if (p < 8) return -Math.sin((p - 4) * 0.9) * 12;
          return (Math.random() - 0.5) * 3;
        }
        case 'eeg':
          return Math.sin(offset * 0.12) * 8 + Math.sin(offset * 0.47) * 6
            + Math.cos(offset * 0.31) * 4 + (Math.random() - 0.5) * 12 * (1 + riskFactor);
        case 'pleth':
          return Math.sin(offset * 0.055) * 22 * (1 - riskFactor * 0.3)
            + Math.sin(offset * 0.11) * 6 + (Math.random() - 0.5) * 2;
        case 'renal':
          return Math.sin(offset * 0.08) * 15 + Math.cos(offset * 0.15) * 8
            + (Math.random() - 0.5) * 6 * (1 + riskFactor);
        case 'hepatic':
          return Math.sin(offset * 0.06) * 10 + Math.sin(offset * 0.22) * 12 * riskFactor
            + (Math.random() - 0.5) * 4;
        default: return 0;
      }
    };

    const draw = () => {
      points.push(gen());
      if (points.length > maxPoints) points.shift();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(148,163,184,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 16) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
      for (let y = 0; y < canvas.height; y += 16) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 8;
      ctx.shadowColor = glowColor;
      for (let i = 0; i < points.length; i++) {
        const x = (i / maxPoints) * canvas.width;
        const y = canvas.height / 2 - points[i];
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      offset++;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [type, color, glowColor, riskFactor]);

  return (
    <canvas ref={canvasRef} width={480} height={100}
      className="w-full h-full rounded" />
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  METRIC TILE
// ═══════════════════════════════════════════════════════════════════════════════
const MetricTile: React.FC<{
  label: string; value: string; unit: string; alert?: boolean;
}> = ({ label, value, unit, alert }) => (
  <div className="flex flex-col">
    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">{label}</div>
    <div className={`text-lg font-black ${alert ? 'text-red-400' : 'text-white'}`}>
      {value} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE ATTRIBUTION BAR
// ═══════════════════════════════════════════════════════════════════════════════
const FeatureBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="flex items-center gap-2">
    <div className="text-[9px] font-mono text-slate-500 w-24 truncate">{label}</div>
    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
    <div className="text-[9px] font-mono text-slate-500 w-8 text-right">{value}%</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  TWIN DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════
interface TwinDef {
  id: string;
  icon: string;
  label: string;
  system: string;
  glb: string;                 // Real Blender .glb path
  algo: string;
  algoType: string;
  waveType: 'ecg' | 'eeg' | 'pleth' | 'renal' | 'hepatic';
  waveLabel: string;
  accentHex: string;
  glowHex: string;
  borderHover: string;
  tagClasses: string;
  glowBg: string;
  metrics: (r: number) => { label: string; value: string; unit: string; alert: boolean }[];
  features: { name: string; weight: number }[];
}

const TWINS: TwinDef[] = [
  {
    id: 'cardio', icon: '🫀', label: 'Cardio-Twin', system: 'Cardiovascular System',
    glb: '/assets/Heart_anotomy.glb',
    algo: 'Cardio-ResNet-50', algoType: 'Deep Residual CNN',
    waveType: 'ecg', waveLabel: 'ECG TELEMETRY',
    accentHex: '#2dd4bf', glowHex: 'rgba(45,212,191,0.5)',
    borderHover: 'hover:border-teal-500/60',
    tagClasses: 'text-teal-400 bg-teal-950/40 border-teal-900/50',
    glowBg: 'bg-teal-500/10',
    metrics: r => [
      { label: 'LVEF', value: (65 - r * 30).toFixed(0), unit: '%', alert: (65 - r * 30) < 40 },
      { label: 'Stroke Volume', value: (70 - r * 20).toFixed(0), unit: 'mL/beat', alert: false },
      { label: 'QRS Width', value: (88 + r * 40).toFixed(0), unit: 'ms', alert: (88 + r * 40) > 120 },
      { label: 'Cardiac Output', value: (5.2 - r * 1.8).toFixed(1), unit: 'L/min', alert: (5.2 - r * 1.8) < 4 },
    ],
    features: [
      { name: 'Septal Thickness', weight: 88 }, { name: 'Wall Motion', weight: 74 },
      { name: 'LV Volume', weight: 61 }, { name: 'Ejection Fraction', weight: 55 },
    ],
  },
  {
    id: 'neuro', icon: '🧠', label: 'Neuro-Twin', system: 'Central Nervous System',
    glb: '/assets/Brain.glb',
    algo: 'Neuro-Transformer v4', algoType: 'Vision Transformer + Attention',
    waveType: 'eeg', waveLabel: 'EEG FREQUENCY BANDS',
    accentHex: '#a855f7', glowHex: 'rgba(168,85,247,0.5)',
    borderHover: 'hover:border-purple-500/60',
    tagClasses: 'text-purple-400 bg-purple-950/40 border-purple-900/50',
    glowBg: 'bg-purple-500/10',
    metrics: r => [
      { label: 'ICP', value: (12 + r * 18).toFixed(1), unit: 'mmHg', alert: (12 + r * 18) > 20 },
      { label: 'O₂ Extraction', value: (35 - r * 12).toFixed(1), unit: '%', alert: (35 - r * 12) < 25 },
      { label: 'Alpha Power', value: (8.5 - r * 3).toFixed(1), unit: 'μV²', alert: false },
      { label: 'Cortical Spikes', value: (2 + r * 20).toFixed(0), unit: '/hr', alert: (2 + r * 20) > 12 },
    ],
    features: [
      { name: 'Cortical Thickness', weight: 91 }, { name: 'White Matter', weight: 82 },
      { name: 'Ventricular Vol.', weight: 68 }, { name: 'Lesion Segm.', weight: 57 },
    ],
  },
  {
    id: 'pulmo', icon: '🫁', label: 'Pulmonary-Twin', system: 'Respiratory System',
    glb: '/assets/Lungs.glb',
    algo: 'Pulmo-ViT', algoType: 'Vision Transformer',
    waveType: 'pleth', waveLabel: 'PLETHYSMOGRAPH',
    accentHex: '#10b981', glowHex: 'rgba(16,185,129,0.5)',
    borderHover: 'hover:border-emerald-500/60',
    tagClasses: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50',
    glowBg: 'bg-emerald-500/10',
    metrics: r => [
      { label: 'FEV1', value: (3.5 - r * 1.5).toFixed(2), unit: 'L', alert: (3.5 - r * 1.5) < 2.5 },
      { label: 'Tidal Volume', value: (500 - r * 120).toFixed(0), unit: 'mL', alert: false },
      { label: 'SpO₂', value: (98 - r * 6).toFixed(1), unit: '%', alert: (98 - r * 6) < 94 },
      { label: 'RR', value: (14 + r * 12).toFixed(0), unit: 'br/min', alert: (14 + r * 12) > 22 },
    ],
    features: [
      { name: 'Airway Patency', weight: 85 }, { name: 'Parenchymal', weight: 78 },
      { name: 'Pleural Analysis', weight: 63 }, { name: 'Diaphragm', weight: 49 },
    ],
  },
  {
    id: 'renal', icon: '🩸', label: 'Renal-Twin', system: 'Urinary System (Kidneys)',
    glb: '/assets/Kidney.glb',
    algo: 'Renal-GNN', algoType: 'Graph Neural Network',
    waveType: 'renal', waveLabel: 'GLOMERULAR FILTRATION',
    accentHex: '#3b82f6', glowHex: 'rgba(59,130,246,0.5)',
    borderHover: 'hover:border-blue-500/60',
    tagClasses: 'text-blue-400 bg-blue-950/40 border-blue-900/50',
    glowBg: 'bg-blue-500/10',
    metrics: r => [
      { label: 'eGFR', value: (110 - r * 65).toFixed(0), unit: 'mL/min', alert: (110 - r * 65) < 60 },
      { label: 'BUN', value: (15 + r * 35).toFixed(0), unit: 'mg/dL', alert: (15 + r * 35) > 30 },
      { label: 'Creatinine', value: (0.9 + r * 2.5).toFixed(2), unit: 'mg/dL', alert: (0.9 + r * 2.5) > 1.5 },
      { label: 'Na⁺ Filtration', value: (140 - r * 10).toFixed(0), unit: 'mEq/L', alert: false },
    ],
    features: [
      { name: 'Cortex Density', weight: 87 }, { name: 'Pelvis Shape', weight: 72 },
      { name: 'Vascular Flow', weight: 64 }, { name: 'Cyst Detection', weight: 51 },
    ],
  },
  {
    id: 'hepatic', icon: '🧪', label: 'Hepatic-Twin', system: 'Hepatobiliary System (Liver)',
    glb: '/assets/Liver.glb',
    algo: 'Hepa-CNN 3D', algoType: '3D Convolutional Network',
    waveType: 'hepatic', waveLabel: 'ENZYME KINETICS',
    accentHex: '#f59e0b', glowHex: 'rgba(245,158,11,0.5)',
    borderHover: 'hover:border-amber-500/60',
    tagClasses: 'text-amber-400 bg-amber-950/40 border-amber-900/50',
    glowBg: 'bg-amber-500/10',
    metrics: r => [
      { label: 'ALT', value: (25 + r * 160).toFixed(0), unit: 'U/L', alert: (25 + r * 160) > 56 },
      { label: 'AST', value: (20 + r * 130).toFixed(0), unit: 'U/L', alert: (20 + r * 130) > 40 },
      { label: 'Bilirubin', value: (0.8 + r * 3.5).toFixed(1), unit: 'mg/dL', alert: (0.8 + r * 3.5) > 1.2 },
      { label: 'Albumin', value: (4.2 - r * 1.5).toFixed(1), unit: 'g/dL', alert: (4.2 - r * 1.5) < 3.5 },
    ],
    features: [
      { name: 'Steatosis Grade', weight: 90 }, { name: 'Fibrosis Score', weight: 83 },
      { name: 'Portal Flow', weight: 67 }, { name: 'Lesion Class.', weight: 55 },
    ],
  },
  {
    id: 'skeletal', icon: '🦴', label: 'Skeletal-Twin', system: 'Musculoskeletal System',
    glb: '/assets/Skeleton.glb',
    algo: 'Osteo-Net', algoType: 'U-Net Segmentation',
    waveType: 'renal', waveLabel: 'DENSITY OSCILLATION',
    accentHex: '#94a3b8', glowHex: 'rgba(148,163,184,0.4)',
    borderHover: 'hover:border-slate-400/60',
    tagClasses: 'text-slate-400 bg-slate-800/80 border-slate-700',
    glowBg: 'bg-slate-500/10',
    metrics: r => [
      { label: 'BMD T-Score', value: (-0.5 - r * 2.2).toFixed(1), unit: 'SD', alert: (-0.5 - r * 2.2) < -2.5 },
      { label: 'Fracture Risk', value: (r * 100).toFixed(1), unit: '%', alert: r > 0.5 },
      { label: 'Cortical Width', value: (4.5 - r * 1.8).toFixed(1), unit: 'mm', alert: false },
      { label: 'Joint Space', value: (3.2 - r * 1.2).toFixed(1), unit: 'mm', alert: (3.2 - r * 1.2) < 2 },
    ],
    features: [
      { name: 'Trabecular Struct.', weight: 84 }, { name: 'Cortical Rim', weight: 76 },
      { name: 'Erosion Detect.', weight: 62 }, { name: 'Alignment', weight: 48 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  TWIN CARD
// ═══════════════════════════════════════════════════════════════════════════════
const TwinCard: React.FC<{ twin: TwinDef; risk: number }> = ({ twin, risk }) => {
  const metrics = useMemo(() => twin.metrics(risk), [twin, risk]);
  const hasAlert = metrics.some(m => m.alert);

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-700/50 ${twin.borderHover} transition-all duration-300 relative overflow-hidden`}
      style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(12px)' }}>

      {/* Ambient glow */}
      <div className={`absolute -top-8 -right-8 w-40 h-40 ${twin.glowBg} blur-3xl rounded-full pointer-events-none`} />

      {/* ── TOP: 3D Model + Header ── */}
      <div className="relative h-48 overflow-hidden rounded-t-2xl border-b border-slate-800/50">
        <MiniOrganViewer glbPath={twin.glb} accentHex={twin.accentHex} />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(15,23,42,0.95)] via-transparent to-transparent pointer-events-none" />
        {/* Status dot */}
        <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${hasAlert ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
        {/* Label overlay */}
        <div className="absolute bottom-3 left-4 right-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 drop-shadow-lg">
            <span className="text-xl">{twin.icon}</span> {twin.label}
          </h2>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{twin.system}</div>
        </div>
      </div>

      {/* ── Algorithm Badge ── */}
      <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
        <div className={`text-[10px] font-mono px-2 py-0.5 rounded border ${twin.tagClasses}`}>
          {twin.algo}
        </div>
        <div className="text-[10px] font-mono text-slate-600">{twin.algoType}</div>
      </div>

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pt-3 pb-2">
        {metrics.map(m => (
          <MetricTile key={m.label} label={m.label} value={m.value} unit={m.unit} alert={m.alert} />
        ))}
      </div>

      {/* ── Feature Attribution ── */}
      <div className="px-4 pb-2 space-y-1">
        <div className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-1">Feature Attribution</div>
        {twin.features.map(f => (
          <FeatureBar key={f.name} label={f.name} value={f.weight} color={twin.accentHex} />
        ))}
      </div>

      {/* ── Live Waveform ── */}
      <div className="mt-auto mx-4 mb-4 h-[90px] bg-slate-950/70 rounded-lg border border-slate-800/80 relative overflow-hidden">
        <div className="absolute top-1.5 left-2 flex items-center gap-1.5 z-10">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: twin.accentHex }} />
          <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{twin.waveLabel}</span>
        </div>
        <LiveWaveformFixed type={twin.waveType} color={twin.accentHex} glowColor={twin.glowHex} riskFactor={risk} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN FEED EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const DigitalTwinsFeed: React.FC<{ riskScore: number }> = ({ riskScore }) => {
  const risk = Math.min(1, Math.max(0, riskScore / 100));

  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 py-14">
      {/* Section Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-300 to-slate-200 tracking-tight">
          Isolated Sub-Model Analytics
        </h1>
        <p className="text-slate-500 font-mono text-sm mt-1.5 tracking-wide">
          INDIVIDUAL ORGAN TWIN DIAGNOSTICS · EMBEDDED INFERENCE MODELS · LIVE TELEMETRY
        </p>
      </div>

      {/* Twin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {TWINS.map(twin => (
          <TwinCard key={twin.id} twin={twin} risk={risk} />
        ))}
      </div>
    </section>
  );
};
