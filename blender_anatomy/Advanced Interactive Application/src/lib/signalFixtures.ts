export interface SignalDataPoint {
  time: number;
  value: number;
}

export interface SignalTrace {
  id: string;
  name: string;
  unit: string;
  data: SignalDataPoint[];
  synthetic: boolean;
  color: string;
  yAxisDomain: [number, number];
}

// Generate basic synthetic traces
const generateTrace = (generator: (t: number) => number, points: number = 100): SignalDataPoint[] => {
  return Array.from({ length: points }, (_, i) => ({
    time: i,
    value: generator(i)
  }));
};

export const SIGNAL_FIXTURES: Record<string, SignalTrace> = {
  ECG: {
    id: "ECG",
    name: "Electrocardiogram (Lead II)",
    unit: "mV",
    synthetic: true,
    color: "#2dd4bf", // teal-400
    yAxisDomain: [-1.5, 2.5],
    data: generateTrace((t) => {
      // Mock QRS complex
      const phase = t % 100;
      if (phase > 10 && phase < 15) return 0.2; // P wave
      if (phase > 25 && phase < 28) return -0.2; // Q wave
      if (phase >= 28 && phase < 32) return 1.8; // R wave
      if (phase >= 32 && phase < 35) return -0.4; // S wave
      if (phase > 50 && phase < 65) return 0.3; // T wave
      return (Math.random() - 0.5) * 0.05; // noise
    }, 300)
  },
  BloodPressure: {
    id: "BloodPressure",
    name: "Arterial Blood Pressure",
    unit: "mmHg",
    synthetic: true,
    color: "#f87171", // red-400
    yAxisDomain: [60, 140],
    data: generateTrace((t) => {
      const phase = t % 100;
      // Dicrotic notch mock
      if (phase < 30) return 80 + (phase * 1.5); // Systolic up
      if (phase >= 30 && phase < 50) return 125 - ((phase - 30) * 1.5); // Down
      if (phase >= 50 && phase < 60) return 95 + ((phase - 50) * 0.5); // Notch
      return 100 - ((phase - 60) * 0.5) + (Math.random() * 2); // Diastolic decay
    }, 300)
  },
  SpO2: {
    id: "SpO2",
    name: "Peripheral Oxygen Saturation",
    unit: "%",
    synthetic: true,
    color: "#60a5fa", // blue-400
    yAxisDomain: [90, 100],
    data: generateTrace(() => 97 + (Math.random() * 1.5), 300)
  },
  EEG: {
    id: "EEG",
    name: "Electroencephalogram (Frontal)",
    unit: "µV",
    synthetic: true,
    color: "#c084fc", // purple-400
    yAxisDomain: [-50, 50],
    data: generateTrace((t) => Math.sin(t * 0.2) * 15 + Math.sin(t * 0.8) * 10 + (Math.random() - 0.5) * 20, 300)
  },
  ICP: {
    id: "ICP",
    name: "Intracranial Pressure",
    unit: "mmHg",
    synthetic: true,
    color: "#fb923c", // orange-400
    yAxisDomain: [0, 25],
    data: generateTrace((t) => {
      const phase = t % 100;
      const base = 12;
      if (phase < 20) return base + (phase * 0.2); // P1 (Percussion)
      if (phase >= 20 && phase < 40) return base + 4 - ((phase - 20) * 0.1); // P2 (Tidal)
      if (phase >= 40 && phase < 60) return base + 2 - ((phase - 40) * 0.15); // P3 (Dicrotic)
      return base - ((phase - 60) * 0.02) + (Math.random()); 
    }, 300)
  },
  RespiratoryRate: {
    id: "RespiratoryRate",
    name: "Respiratory Rate",
    unit: "bpm",
    synthetic: true,
    color: "#a3e635", // lime-400
    yAxisDomain: [10, 30],
    data: generateTrace(() => 16 + (Math.random() - 0.5), 100)
  },
  TidalVolume: {
    id: "TidalVolume",
    name: "Tidal Volume",
    unit: "mL",
    synthetic: true,
    color: "#34d399", // emerald-400
    yAxisDomain: [300, 700],
    data: generateTrace((t) => 500 + Math.sin(t * 0.1) * 150 + (Math.random() - 0.5) * 20, 300)
  },
  GFR: {
    id: "GFR",
    name: "Glomerular Filtration Rate",
    unit: "mL/min/1.73m²",
    synthetic: true,
    color: "#fcd34d", // amber-300
    yAxisDomain: [60, 120],
    data: generateTrace(() => 95 + (Math.random() - 0.5) * 2, 50)
  },
  Creatinine: {
    id: "Creatinine",
    name: "Serum Creatinine",
    unit: "mg/dL",
    synthetic: true,
    color: "#f87171", // red-400
    yAxisDomain: [0.5, 1.5],
    data: generateTrace(() => 0.9 + (Math.random() - 0.5) * 0.05, 50)
  },
  AST: {
    id: "AST",
    name: "Aspartate Aminotransferase",
    unit: "U/L",
    synthetic: true,
    color: "#fbbf24", // amber-400
    yAxisDomain: [10, 40],
    data: generateTrace(() => 22 + (Math.random() - 0.5) * 3, 50)
  },
  ALT: {
    id: "ALT",
    name: "Alanine Aminotransferase",
    unit: "U/L",
    synthetic: true,
    color: "#fb923c", // orange-400
    yAxisDomain: [7, 56],
    data: generateTrace(() => 28 + (Math.random() - 0.5) * 4, 50)
  },
  Insulin: {
    id: "Insulin",
    name: "Serum Insulin",
    unit: "µU/mL",
    synthetic: true,
    color: "#818cf8", // indigo-400
    yAxisDomain: [2, 25],
    data: generateTrace(() => 10 + (Math.random() - 0.5) * 2, 50)
  },
  Glucose: {
    id: "Glucose",
    name: "Blood Glucose",
    unit: "mg/dL",
    synthetic: true,
    color: "#a78bfa", // violet-400
    yAxisDomain: [70, 140],
    data: generateTrace(() => 95 + (Math.random() - 0.5) * 5, 50)
  },
  Motility: {
    id: "Motility",
    name: "Intestinal Motility",
    unit: "cmH2O",
    synthetic: true,
    color: "#a3e635", // lime-400
    yAxisDomain: [0, 50],
    data: generateTrace((t) => 10 + Math.sin(t * 0.05) * 20 + (Math.random() - 0.5) * 5, 300)
  },
  BoneDensity: {
    id: "BoneDensity",
    name: "Bone Mineral Density (T-Score)",
    unit: "SD",
    synthetic: true,
    color: "#cbd5e1", // slate-300
    yAxisDomain: [-3, 2],
    data: generateTrace(() => -0.5 + (Math.random() - 0.5) * 0.1, 50)
  }
};
