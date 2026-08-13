export type AnatomyId = "heart" | "brain" | "nervous" | "skeletal" | "lungs" | "renal" | "digestive"

export type ViewMode = "exterior" | "interior" | "xray" | "mesh"

export interface AnatomyDefinition {
  id: AnatomyId
  label: string
  shortLabel: string
  system: string
  description: string
  source: string
  color: string
  secondaryColor: string
  focus: string
  metricLabel: string
  metricValue: string
}

export const ANATOMIES: AnatomyDefinition[] = [
  {
    id: "heart",
    label: "Heart",
    shortLabel: "Cardiac",
    system: "Cardiovascular system",
    description:
      "Chambers, myocardium, coronary surface and perfusion territories.",
    source: "Procedural twin / GLB-ready",
    color: "#ff6b7a",
    secondaryColor: "#ffb35c",
    focus: "Myocardial perfusion",
    metricLabel: "Ejection fraction",
    metricValue: "58%",
  },
  {
    id: "brain",
    label: "Brain",
    shortLabel: "Neuro",
    system: "Central nervous system",
    description:
      "Cortical regions, deep structures, connectome and focal ROI analysis.",
    source: "Procedural twin / GLB-ready",
    color: "#c784ff",
    secondaryColor: "#5dd7ff",
    focus: "Tissue morphology",
    metricLabel: "Network efficiency",
    metricValue: "0.71",
  },
  {
    id: "nervous",
    label: "Nervous system",
    shortLabel: "Neural",
    system: "Peripheral nervous system",
    description: "Brain, spinal axis and peripheral conduction pathways.",
    source: "Procedural neural mesh",
    color: "#ffd75c",
    secondaryColor: "#5dd7ff",
    focus: "Signal conduction",
    metricLabel: "Path integrity",
    metricValue: "84%",
  },
  {
    id: "skeletal",
    label: "Skeletal system",
    shortLabel: "Skeletal",
    system: "Musculoskeletal system",
    description:
      "Axial and appendicular skeleton with joint and cortical stress ROIs.",
    source: "Procedural skeletal mesh",
    color: "#f1e8d2",
    secondaryColor: "#ff9f43",
    focus: "Cortical integrity",
    metricLabel: "Bone density index",
    metricValue: "0.89",
  },
  {
    id: "lungs",
    label: "Lungs",
    shortLabel: "Pulmonary",
    system: "Respiratory system",
    description:
      "Lobar volume, airway tree, opacity regions and spread simulation.",
    source: "Procedural twin / GLB-ready",
    color: "#5dd7ff",
    secondaryColor: "#5ee0a0",
    focus: "Regional ventilation",
    metricLabel: "FEV1 / FVC",
    metricValue: "0.78",
  },
  {
    id: "renal",
    label: "Kidneys",
    shortLabel: "Renal",
    system: "Urinary system",
    description:
      "Bilateral renal morphology, parenchyma and perfusion territories.",
    source: "Procedural renal mesh",
    color: "#e88995",
    secondaryColor: "#70d6c2",
    focus: "Parenchymal perfusion",
    metricLabel: "Filtration index",
    metricValue: "92",
  },
  {
    id: "digestive",
    label: "Digestive tract",
    shortLabel: "Gastro",
    system: "Digestive system",
    description:
      "Stomach, intestinal tract and localized tissue response mapping.",
    source: "Procedural digestive mesh",
    color: "#ff9f72",
    secondaryColor: "#e7c85d",
    focus: "Tissue morphology",
    metricLabel: "Motility index",
    metricValue: "0.74",
  },
]

export const ANATOMY_BY_ID = Object.fromEntries(
  ANATOMIES.map((anatomy) => [anatomy.id, anatomy]),
) as Record<AnatomyId, AnatomyDefinition>
