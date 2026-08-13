import { OrganId } from './twins';

export type ViewMode = 'interior' | 'exterior';

export interface Biomarker {
  name: string;
  value: number;
  unit: string;
  minNormal: number;
  maxNormal: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  accuracy: string;
  type: string;
}

export interface ClinicalGraph {
  id: string;
  title: string;
  description: string;
  type: string;
  preferredView: ViewMode;
}

export interface OrganClinicalData {
  id: OrganId;
  biomarkers: Biomarker[];
  aiModels: AIModel[];
  graphs: ClinicalGraph[];
  findings: {
    code: string;
    description: string;
    viewMode: ViewMode;
  }[];
}

export const ORGAN_CLINICAL_DATA: Record<string, OrganClinicalData> = {
  heart: {
    id: 'heart',
    biomarkers: [
      { name: 'Troponin T', value: 0.01, unit: 'ng/mL', minNormal: 0, maxNormal: 0.04, status: 'normal' },
      { name: 'BNP', value: 85, unit: 'pg/mL', minNormal: 0, maxNormal: 100, status: 'normal' },
      { name: 'Ejection Fraction', value: 55, unit: '%', minNormal: 50, maxNormal: 70, status: 'normal' },
      { name: 'Cardiac Output', value: 5.2, unit: 'L/min', minNormal: 4.0, maxNormal: 8.0, status: 'normal' },
      { name: 'CK-MB', value: 2.1, unit: 'ng/mL', minNormal: 0, maxNormal: 3.0, status: 'normal' },
      { name: 'CRP', value: 1.2, unit: 'mg/L', minNormal: 0, maxNormal: 3.0, status: 'normal' },
    ],
    aiModels: [
      { id: 'h1', name: 'MRE Elastography', description: 'Myocardial stiffness map', accuracy: '96%', type: 'Physics-Informed NN' },
      { id: 'h2', name: 'CFD Simulator', description: 'Coronary flow dynamics', accuracy: '92%', type: '3D CNN' },
      { id: 'h3', name: 'Arrhythmia GCN', description: 'Electrical propagation network', accuracy: '98%', type: 'Graph Neural Network' },
      { id: 'h4', name: 'Ischemia Detector', description: 'Perfusion deficit locator', accuracy: '94%', type: 'Vision Transformer' },
    ],
    graphs: [
      { id: 'hg1', title: 'Pressure-Volume (PV) Loops', description: 'Plots pressure against volume inside the left ventricle.', type: 'pv-loop', preferredView: 'interior' },
      { id: 'hg2', title: 'Endocardial Voltage Maps', description: 'Electrical scar tissue inside heart chambers.', type: 'voltage-map', preferredView: 'interior' },
      { id: 'hg3', title: 'Cardiac MRI Strain Analysis', description: 'Map outer heart muscle motion (Bullseye Plots).', type: 'bullseye', preferredView: 'exterior' },
      { id: 'hg4', title: 'Polar Maps of Perfusion', description: 'Blood flow to the outside heart muscle.', type: 'polar', preferredView: 'exterior' },
    ],
    findings: [
      { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', viewMode: 'exterior' },
      { code: 'I48.91', description: 'Unspecified atrial fibrillation', viewMode: 'interior' },
    ],
  },
  brain: {
    id: 'brain',
    biomarkers: [
      { name: 'ICP', value: 12, unit: 'mmHg', minNormal: 7, maxNormal: 15, status: 'normal' },
      { name: 'CPP', value: 75, unit: 'mmHg', minNormal: 60, maxNormal: 80, status: 'normal' },
      { name: 'Tau Protein', value: 150, unit: 'pg/mL', minNormal: 0, maxNormal: 300, status: 'normal' },
      { name: 'NfL', value: 8, unit: 'pg/mL', minNormal: 0, maxNormal: 15, status: 'normal' },
      { name: 'O2 Extraction', value: 35, unit: '%', minNormal: 25, maxNormal: 45, status: 'normal' },
      { name: 'Alpha Peak', value: 10, unit: 'Hz', minNormal: 8, maxNormal: 12, status: 'normal' },
    ],
    aiModels: [
      { id: 'b1', name: 'GCN Connectivity', description: 'Functional network analysis', accuracy: '91%', type: 'Graph Convolutional Net' },
      { id: 'b2', name: 'Cortical Morphometry', description: 'Thickness and volume tracking', accuracy: '95%', type: '3D U-Net' },
      { id: 'b3', name: 'Seizure Predictor', description: 'Pre-ictal state detection', accuracy: '89%', type: 'LSTM + Attention' },
      { id: 'b4', name: 'Lesion Segmenter', description: 'White matter hyperintensity mapping', accuracy: '97%', type: 'Ensemble CNN' },
    ],
    graphs: [
      { id: 'bg1', title: 'Functional Connectivity Matrix', description: 'Statistical correlations between regions.', type: 'connectivity-matrix', preferredView: 'interior' },
      { id: 'bg2', title: 'Diffusion Tensor Tractography', description: 'Physical white matter tracts mapping.', type: 'tractography', preferredView: 'interior' },
      { id: 'bg3', title: 'Intracranial EEG Heatmaps', description: 'Topographic brain surface voltage mapping.', type: 'eeg-heatmap', preferredView: 'exterior' },
      { id: 'bg4', title: 'Cortical Atrophy Analysis', description: 'Surface-based morphometry mesh.', type: 'morphometry', preferredView: 'exterior' },
    ],
    findings: [
      { code: 'G40.909', description: 'Epilepsy, unspecified', viewMode: 'interior' },
      { code: 'G30.9', description: 'Alzheimer\'s disease, unspecified', viewMode: 'exterior' },
    ],
  },
  lungs: {
    id: 'lungs',
    biomarkers: [
      { name: 'SpO2', value: 98, unit: '%', minNormal: 95, maxNormal: 100, status: 'normal' },
      { name: 'PaO2', value: 90, unit: 'mmHg', minNormal: 75, maxNormal: 100, status: 'normal' },
      { name: 'PaCO2', value: 40, unit: 'mmHg', minNormal: 35, maxNormal: 45, status: 'normal' },
      { name: 'FEV1', value: 3.2, unit: 'L', minNormal: 2.5, maxNormal: 4.0, status: 'normal' },
      { name: 'FVC', value: 4.5, unit: 'L', minNormal: 3.5, maxNormal: 5.0, status: 'normal' },
      { name: 'D-dimer', value: 250, unit: 'ng/mL', minNormal: 0, maxNormal: 500, status: 'normal' },
    ],
    aiModels: [
      { id: 'l1', name: 'Nodule Detector', description: 'Malignancy risk scoring', accuracy: '94%', type: '3D RetinaNet' },
      { id: 'l2', name: 'Airway Flow CFD', description: 'Resistance mapping', accuracy: '88%', type: 'Physics NN' },
      { id: 'l3', name: 'Pneumonia Classifier', description: 'Infiltrate localization', accuracy: '96%', type: 'DenseNet-121' },
      { id: 'l4', name: 'Fibrosis Quantifier', description: 'HRCT texture analysis', accuracy: '92%', type: 'Texture-CNN' },
    ],
    graphs: [
      { id: 'lg1', title: 'Density Histogram', description: 'Parenchymal attenuation spread.', type: 'density-histogram', preferredView: 'interior' },
      { id: 'lg2', title: 'Airway Resistance Tree', description: 'Bronchial flow impedance.', type: 'resistance-tree', preferredView: 'interior' },
      { id: 'lg3', title: 'Pleural Mechanics', description: 'Chest wall expansion vectors.', type: 'pleural-mechanics', preferredView: 'exterior' },
      { id: 'lg4', title: 'Ventilation/Perfusion', description: 'V/Q mismatch mapping.', type: 'vq-map', preferredView: 'exterior' },
    ],
    findings: [
      { code: 'J44.9', description: 'Chronic obstructive pulmonary disease', viewMode: 'interior' },
      { code: 'J18.9', description: 'Pneumonia, unspecified organism', viewMode: 'exterior' },
    ],
  },
  kidneys: {
    id: 'kidneys',
    biomarkers: [
      { name: 'eGFR', value: 110, unit: 'mL/min', minNormal: 90, maxNormal: 120, status: 'normal' },
      { name: 'Creatinine', value: 0.9, unit: 'mg/dL', minNormal: 0.7, maxNormal: 1.3, status: 'normal' },
      { name: 'BUN', value: 15, unit: 'mg/dL', minNormal: 7, maxNormal: 20, status: 'normal' },
      { name: 'Urine Albumin', value: 10, unit: 'mg/g', minNormal: 0, maxNormal: 30, status: 'normal' },
      { name: 'Serum Potassium', value: 4.2, unit: 'mEq/L', minNormal: 3.6, maxNormal: 5.2, status: 'normal' },
      { name: 'Serum Sodium', value: 140, unit: 'mEq/L', minNormal: 135, maxNormal: 145, status: 'normal' },
    ],
    aiModels: [
      { id: 'k1', name: 'KDIGO Classifier', description: 'AKI staging predictor', accuracy: '93%', type: 'Gradient Boosting' },
      { id: 'k2', name: 'Glomerular Tracker', description: 'Filtration rate forecasting', accuracy: '90%', type: 'Temporal CNN' },
      { id: 'k3', name: 'Cyst Segmenter', description: 'Volumetric cyst burden', accuracy: '95%', type: 'V-Net' },
      { id: 'k4', name: 'Perfusion Mapper', description: 'Cortical blood flow analysis', accuracy: '89%', type: 'Spatial-Temporal Net' },
    ],
    graphs: [
      { id: 'kg1', title: 'KDIGO Risk Heatgrid', description: 'Acute kidney injury staging timeline.', type: 'heatgrid', preferredView: 'exterior' },
      { id: 'kg2', title: 'Nephron Density Map', description: 'Functional unit distribution.', type: 'nephron-map', preferredView: 'interior' },
      { id: 'kg3', title: 'Renal Plasma Flow', description: 'Vascular perfusion curves.', type: 'flow-curve', preferredView: 'interior' },
      { id: 'kg4', title: 'Calyceal Pressure', description: 'Urine collection dynamics.', type: 'pressure-map', preferredView: 'interior' },
    ],
    findings: [
      { code: 'N18.9', description: 'Chronic kidney disease, unspecified', viewMode: 'interior' },
      { code: 'N17.9', description: 'Acute kidney failure, unspecified', viewMode: 'exterior' },
    ],
  },
  liver: {
    id: 'liver',
    biomarkers: [
      { name: 'ALT', value: 25, unit: 'U/L', minNormal: 7, maxNormal: 56, status: 'normal' },
      { name: 'AST', value: 20, unit: 'U/L', minNormal: 10, maxNormal: 40, status: 'normal' },
      { name: 'Bilirubin', value: 0.8, unit: 'mg/dL', minNormal: 0.1, maxNormal: 1.2, status: 'normal' },
      { name: 'Albumin', value: 4.2, unit: 'g/dL', minNormal: 3.5, maxNormal: 5.5, status: 'normal' },
      { name: 'ALP', value: 80, unit: 'U/L', minNormal: 44, maxNormal: 147, status: 'normal' },
      { name: 'INR', value: 1.0, unit: 'Ratio', minNormal: 0.8, maxNormal: 1.1, status: 'normal' },
    ],
    aiModels: [
      { id: 'li1', name: 'Fibrosis Scorer', description: 'Tissue stiffness quant', accuracy: '92%', type: 'Multi-Modal CNN' },
      { id: 'li2', name: 'Steatosis Quantifier', description: 'Fat fraction mapping', accuracy: '96%', type: 'Fat-Water MRI Net' },
      { id: 'li3', name: 'HCC Detector', description: 'Lesion classification', accuracy: '94%', type: '3D Mask R-CNN' },
      { id: 'li4', name: 'Portal Flow Sim', description: 'Venous pressure dynamics', accuracy: '87%', type: 'Physics-GNN' },
    ],
    graphs: [
      { id: 'lig1', title: 'Fibrosis Gauge', description: 'Elastography stiffness spectrum.', type: 'gauge', preferredView: 'interior' },
      { id: 'lig2', title: 'Portal Vein Hemodynamics', description: 'Flow velocity and resistance.', type: 'hemodynamics', preferredView: 'interior' },
      { id: 'lig3', title: 'Metabolic Activity Map', description: 'Hepatic lobule function distribution.', type: 'metabolic-map', preferredView: 'exterior' },
      { id: 'lig4', title: 'Biliary Tree Topology', description: 'Ductal dilation network.', type: 'biliary-tree', preferredView: 'interior' },
    ],
    findings: [
      { code: 'K76.0', description: 'Fatty (change of) liver, not elsewhere classified', viewMode: 'interior' },
      { code: 'K74.60', description: 'Unspecified cirrhosis of liver', viewMode: 'exterior' },
    ],
  },
  pancreas: {
    id: 'pancreas',
    biomarkers: [
      { name: 'Glucose', value: 95, unit: 'mg/dL', minNormal: 70, maxNormal: 99, status: 'normal' },
      { name: 'HbA1c', value: 5.2, unit: '%', minNormal: 4.0, maxNormal: 5.6, status: 'normal' },
      { name: 'Insulin', value: 10, unit: 'mIU/L', minNormal: 2.6, maxNormal: 24.9, status: 'normal' },
      { name: 'C-Peptide', value: 1.5, unit: 'ng/mL', minNormal: 1.1, maxNormal: 4.4, status: 'normal' },
      { name: 'Amylase', value: 60, unit: 'U/L', minNormal: 30, maxNormal: 110, status: 'normal' },
      { name: 'Lipase', value: 40, unit: 'U/L', minNormal: 10, maxNormal: 73, status: 'normal' },
    ],
    aiModels: [
      { id: 'p1', name: 'Islet Mass Estimator', description: 'Beta cell volume', accuracy: '88%', type: 'Probabilistic CNN' },
      { id: 'p2', name: 'Glycemic Forecaster', description: 'Time-series glucose prediction', accuracy: '91%', type: 'Transformer' },
      { id: 'p3', name: 'Pancreatitis Risk', description: 'Inflammation scoring', accuracy: '93%', type: 'Ensemble Tree' },
      { id: 'p4', name: 'Ductal Segmenter', description: 'Main pancreatic duct mapping', accuracy: '95%', type: 'U-Net' },
    ],
    graphs: [
      { id: 'pg1', title: 'Endocrine Network Diagram', description: 'Hormone regulatory feedback loops.', type: 'network-diagram', preferredView: 'interior' },
      { id: 'pg2', title: 'Glycemic Variance', description: 'Continuous glucose monitoring traces.', type: 'variance-plot', preferredView: 'exterior' },
      { id: 'pg3', title: 'Acinar Cell Density', description: 'Exocrine function distribution.', type: 'density-map', preferredView: 'interior' },
      { id: 'pg4', title: 'Ductal Fluid Dynamics', description: 'Pancreatic juice flow rate.', type: 'fluid-dynamics', preferredView: 'interior' },
    ],
    findings: [
      { code: 'E11.9', description: 'Type 2 diabetes mellitus', viewMode: 'exterior' },
      { code: 'K85.9', description: 'Acute pancreatitis, unspecified', viewMode: 'interior' },
    ],
  },
  intestine: {
    id: 'intestine',
    biomarkers: [
      { name: 'Calprotectin', value: 25, unit: 'mcg/g', minNormal: 0, maxNormal: 50, status: 'normal' },
      { name: 'Lactoferrin', value: 3.5, unit: 'mcg/g', minNormal: 0, maxNormal: 7.2, status: 'normal' },
      { name: 'Zonulin', value: 35, unit: 'ng/mL', minNormal: 0, maxNormal: 45, status: 'normal' },
      { name: 'DAO', value: 15, unit: 'U/mL', minNormal: 10, maxNormal: 30, status: 'normal' },
      { name: 'IgA', value: 150, unit: 'mg/dL', minNormal: 90, maxNormal: 400, status: 'normal' },
      { name: 'Transit Time', value: 36, unit: 'hrs', minNormal: 30, maxNormal: 40, status: 'normal' },
    ],
    aiModels: [
      { id: 'in1', name: 'Microbiome Profiler', description: 'Flora diversity index', accuracy: '90%', type: 'Deep Autoencoder' },
      { id: 'in2', name: 'Motility Analyzer', description: 'Peristalsis wave mapping', accuracy: '89%', type: 'Spatiotemporal CNN' },
      { id: 'in3', name: 'Mucosal Integrator', description: 'Barrier function scoring', accuracy: '94%', type: 'Graph Attention Net' },
      { id: 'in4', name: 'Polyp Detector', description: 'Endoscopic anomaly ID', accuracy: '98%', type: 'YOLOv8' },
    ],
    graphs: [
      { id: 'ing1', title: 'Microbiome Network', description: 'Bacterial taxa interaction map.', type: 'microbiome-network', preferredView: 'interior' },
      { id: 'ing2', title: 'Peristaltic Waveform', description: 'Smooth muscle contraction rhythm.', type: 'peristalsis', preferredView: 'exterior' },
      { id: 'ing3', title: 'Mucosal Permeability', description: 'Epithelial tight junction integrity.', type: 'permeability', preferredView: 'interior' },
      { id: 'ing4', title: 'Absorptive Surface Area', description: 'Villi health distribution.', type: 'villi-map', preferredView: 'interior' },
    ],
    findings: [
      { code: 'K50.90', description: 'Crohn\'s disease, unspecified', viewMode: 'interior' },
      { code: 'K58.0', description: 'Irritable bowel syndrome with diarrhea', viewMode: 'exterior' },
    ],
  },
  skeleton: {
    id: 'skeleton',
    biomarkers: [
      { name: 'Calcium', value: 9.5, unit: 'mg/dL', minNormal: 8.5, maxNormal: 10.2, status: 'normal' },
      { name: 'Vitamin D', value: 40, unit: 'ng/mL', minNormal: 20, maxNormal: 50, status: 'normal' },
      { name: 'ALP', value: 85, unit: 'U/L', minNormal: 44, maxNormal: 147, status: 'normal' },
      { name: 'CTX', value: 300, unit: 'pg/mL', minNormal: 100, maxNormal: 600, status: 'normal' },
      { name: 'P1NP', value: 45, unit: 'ng/mL', minNormal: 15, maxNormal: 80, status: 'normal' },
      { name: 'PTH', value: 35, unit: 'pg/mL', minNormal: 15, maxNormal: 65, status: 'normal' },
    ],
    aiModels: [
      { id: 's1', name: 'BMD Predictor', description: 'T-score forecasting', accuracy: '95%', type: 'Multi-layer Perceptron' },
      { id: 's2', name: 'Fracture Risk Net', description: 'Biomechanical stress sim', accuracy: '91%', type: 'GNN + Physics' },
      { id: 's3', name: 'Osteoarthritis Grade', description: 'Joint space narrowing', accuracy: '93%', type: 'CNN Classifier' },
      { id: 's4', name: 'Kinematic Analyzer', description: 'Gait & posture vectors', accuracy: '88%', type: 'Temporal CNN' },
    ],
    graphs: [
      { id: 'sg1', title: 'Kinematic Line Chart', description: 'Joint angle trajectories during gait.', type: 'kinematic-line', preferredView: 'exterior' },
      { id: 'sg2', title: 'Trabecular Density Histogram', description: 'Microarchitecture voxel distribution.', type: 'density-histogram', preferredView: 'interior' },
      { id: 'sg3', title: 'Stress Distribution Mesh', description: 'Finite element analysis map.', type: 'stress-mesh', preferredView: 'interior' },
      { id: 'sg4', title: 'Bone Remodeling Rate', description: 'Osteoblast/clast activity ratio.', type: 'remodeling-rate', preferredView: 'interior' },
    ],
    findings: [
      { code: 'M81.0', description: 'Age-related osteoporosis without current pathological fracture', viewMode: 'interior' },
      { code: 'M15.9', description: 'Polyosteoarthritis, unspecified', viewMode: 'exterior' },
    ],
  },
};
