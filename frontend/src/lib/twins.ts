export type TwinCategory = "cardio" | "neuro" | "pulmo"

export interface TwinDefinition {
  id: string
  name: string
  category: TwinCategory
  asset: string
  source: string
  description: string
  accent: string
  renderMode?: "pbr" | "xray"
}

export const TWIN_DEFINITIONS: TwinDefinition[] = [
  {
    id: "heart-anatomy",
    name: "Heart anatomy",
    category: "cardio",
    asset: "/Heart_anotomy.glb",
    source: "Heart_anotomy.blend",
    description: "Whole-heart anatomy with preserved PBR material maps.",
    accent: "#fb7185",
  },
  {
    id: "heart-interior",
    name: "Interior heart",
    category: "cardio",
    asset: "/Interior_Heart.glb",
    source: "interior_heart.blend",
    description: "Interior cardiac chambers and valve structures.",
    accent: "#f97316",
  },
  {
    id: "heart-exterior",
    name: "Exterior heart",
    category: "cardio",
    asset: "/Exterior_Heart.glb",
    source: "exterior_heart.blend",
    description: "External myocardium and coronary surface anatomy.",
    accent: "#ef4444",
  },
  {
    id: "brain",
    name: "Brain",
    category: "neuro",
    asset: "/Brain.glb",
    source: "Brain.blend",
    description: "Neuroanatomy twin for structural and functional connectivity views.",
    accent: "#a78bfa",
  },
  {
    id: "lungs",
    name: "Lungs",
    category: "pulmo",
    asset: "/Lungs.glb",
    source: "lungs.blend",
    description: "Pulmonary anatomy twin with native material maps.",
    accent: "#22d3ee",
  },
  {
    id: "xray-lungs",
    name: "X-ray lungs",
    category: "pulmo",
    asset: "/Lungs.glb",
    source: "X-ray_lungs.blend",
    description: "Radiographic inspection mode using the isolated lung twin.",
    accent: "#2dd4bf",
    renderMode: "xray",
  },
]

export const CATEGORY_META: Record<TwinCategory, { label: string; color: string; description: string }> = {
  cardio: { label: "Cardio Twin", color: "#fb7185", description: "Cardiac anatomy, signals, and hemodynamics" },
  neuro: { label: "Neuro Twin", color: "#a78bfa", description: "Neuroanatomy and connectome analysis" },
  pulmo: { label: "Pulmo Twin", color: "#22d3ee", description: "Lung anatomy and pulmonary function" },
}
