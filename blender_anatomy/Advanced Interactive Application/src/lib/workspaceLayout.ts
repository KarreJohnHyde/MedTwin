import { getDefaultModel, ORGAN_REGISTRY, type OrganId } from "./twins"

export const MAX_VIEWPORTS = 6
export type SplitAxis = "horizontal" | "vertical"

export interface ViewportLeaf {
  kind: "leaf"
  id: string
  organ: OrganId
  modelId: string
}

export interface ViewportSplit {
  kind: "split"
  id: string
  axis: SplitAxis
  ratio: number
  first: WorkspaceNode
  second: WorkspaceNode
}

export type WorkspaceNode = ViewportLeaf | ViewportSplit

let sequence = 0
export function createWorkspaceId(prefix: "leaf" | "split") {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`
}

export function createLeaf(
  organ: OrganId,
  id = createWorkspaceId("leaf"),
): ViewportLeaf {
  return { kind: "leaf", id, organ, modelId: getDefaultModel(organ).id }
}

export function countLeaves(node: WorkspaceNode): number {
  return node.kind === "leaf"
    ? 1
    : countLeaves(node.first) + countLeaves(node.second)
}

export function collectLeaves(node: WorkspaceNode): ViewportLeaf[] {
  return node.kind === "leaf"
    ? [node]
    : [...collectLeaves(node.first), ...collectLeaves(node.second)]
}

export function updateLeafOrgan(
  node: WorkspaceNode,
  leafId: string,
  organ: OrganId,
): WorkspaceNode {
  if (node.kind === "leaf") {
    return node.id === leafId
      ? { ...node, organ, modelId: getDefaultModel(organ).id }
      : node
  }
  return {
    ...node,
    first: updateLeafOrgan(node.first, leafId, organ),
    second: updateLeafOrgan(node.second, leafId, organ),
  }
}

export function updateLeafContext(
  node: WorkspaceNode,
  leafId: string,
  organ: OrganId,
  modelId: string,
): WorkspaceNode {
  if (!ORGAN_REGISTRY[organ].models.some((model) => model.id === modelId))
    return node
  if (node.kind === "leaf")
    return node.id === leafId ? { ...node, organ, modelId } : node
  return {
    ...node,
    first: updateLeafContext(node.first, leafId, organ, modelId),
    second: updateLeafContext(node.second, leafId, organ, modelId),
  }
}

export function splitLeaf(
  node: WorkspaceNode,
  leafId: string,
  axis: SplitAxis,
  newOrgan: OrganId,
  newLeafId = createWorkspaceId("leaf"),
): WorkspaceNode {
  if (countLeaves(node) >= MAX_VIEWPORTS) return node
  if (node.kind === "leaf") {
    if (node.id !== leafId) return node
    return {
      kind: "split",
      id: createWorkspaceId("split"),
      axis,
      ratio: 50,
      first: node,
      second: createLeaf(newOrgan, newLeafId),
    }
  }
  return {
    ...node,
    first: splitLeaf(node.first, leafId, axis, newOrgan, newLeafId),
    second: splitLeaf(node.second, leafId, axis, newOrgan, newLeafId),
  }
}

export function removeLeaf(
  node: WorkspaceNode,
  leafId: string,
): WorkspaceNode | null {
  if (node.kind === "leaf") return node.id === leafId ? null : node
  const first = removeLeaf(node.first, leafId)
  const second = removeLeaf(node.second, leafId)
  if (!first) return second
  if (!second) return first
  return { ...node, first, second }
}

export function joinSplit(
  node: WorkspaceNode,
  splitId: string,
  keep: "first" | "second",
): WorkspaceNode {
  if (node.kind === "leaf") return node
  if (node.id === splitId) return node[keep]
  return {
    ...node,
    first: joinSplit(node.first, splitId, keep),
    second: joinSplit(node.second, splitId, keep),
  }
}

export function updateSplitRatio(
  node: WorkspaceNode,
  splitId: string,
  ratio: number,
): WorkspaceNode {
  if (node.kind === "leaf") return node
  if (node.id === splitId)
    return { ...node, ratio: Math.min(80, Math.max(20, ratio)) }
  return {
    ...node,
    first: updateSplitRatio(node.first, splitId, ratio),
    second: updateSplitRatio(node.second, splitId, ratio),
  }
}

export function createPresetLayout(count: 1 | 2 | 4 | 6): WorkspaceNode {
  const organs = (Object.keys(ORGAN_REGISTRY) as OrganId[]).slice(0, count)
  const build = (items: OrganId[], depth: number): WorkspaceNode => {
    if (items.length === 1) return createLeaf(items[0])
    const midpoint = Math.ceil(items.length / 2)
    return {
      kind: "split",
      id: createWorkspaceId("split"),
      axis: depth % 2 === 0 ? "horizontal" : "vertical",
      ratio: (midpoint / items.length) * 100,
      first: build(items.slice(0, midpoint), depth + 1),
      second: build(items.slice(midpoint), depth + 1),
    }
  }
  return build(organs, 0)
}

export function isWorkspaceNode(value: unknown): value is WorkspaceNode {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<WorkspaceNode>
  if (candidate.kind === "leaf") {
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.organ !== "string" ||
      !(candidate.organ in ORGAN_REGISTRY)
    )
      return false
    const organ = candidate.organ as OrganId
    return (
      typeof candidate.modelId === "string" &&
      ORGAN_REGISTRY[organ].models.some(
        (model) => model.id === candidate.modelId,
      )
    )
  }
  if (candidate.kind === "split") {
    const split = candidate as Partial<ViewportSplit>
    return (
      typeof split.id === "string" &&
      (split.axis === "horizontal" || split.axis === "vertical") &&
      typeof split.ratio === "number" &&
      split.ratio >= 20 &&
      split.ratio <= 80 &&
      isWorkspaceNode(split.first) &&
      isWorkspaceNode(split.second)
    )
  }
  return false
}
