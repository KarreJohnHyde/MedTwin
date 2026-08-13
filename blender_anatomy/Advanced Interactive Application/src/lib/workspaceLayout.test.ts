import { describe, expect, it } from "vitest"
import {
  collectLeaves,
  countLeaves,
  createLeaf,
  createPresetLayout,
  isWorkspaceNode,
  joinSplit,
  removeLeaf,
  splitLeaf,
  updateLeafContext,
  updateSplitRatio,
  type ViewportSplit,
} from "./workspaceLayout"

describe("Blender workspace split tree", () => {
  it("splits a focused leaf without mutating the original leaf identity", () => {
    const root = createLeaf("heart", "heart-cell")
    const split = splitLeaf(
      root,
      "heart-cell",
      "horizontal",
      "brain",
      "brain-cell",
    )
    expect(countLeaves(split)).toBe(2)
    expect(collectLeaves(split).map((leaf) => leaf.id)).toEqual([
      "heart-cell",
      "brain-cell",
    ])
    expect(root).toEqual(createLeaf("heart", "heart-cell"))
  })

  it("updates only the selected cell context", () => {
    const root = splitLeaf(
      createLeaf("heart", "a"),
      "a",
      "horizontal",
      "brain",
      "b",
    )
    const updated = updateLeafContext(root, "a", "lungs", "pulmo-densenet")
    expect(collectLeaves(updated).find((leaf) => leaf.id === "a")?.organ).toBe(
      "lungs",
    )
    expect(collectLeaves(updated).find((leaf) => leaf.id === "b")?.organ).toBe(
      "brain",
    )
  })

  it("collapses splits cleanly when an area is closed or joined", () => {
    const root = splitLeaf(
      createLeaf("heart", "a"),
      "a",
      "vertical",
      "brain",
      "b",
    ) as ViewportSplit
    expect(removeLeaf(root, "b")).toMatchObject({ kind: "leaf", id: "a" })
    expect(joinSplit(root, root.id, "second")).toMatchObject({
      kind: "leaf",
      id: "b",
    })
  })

  it("clamps divider ratios and supports the six-area performance cap", () => {
    const root = createPresetLayout(6)
    expect(countLeaves(root)).toBe(6)
    if (root.kind !== "split") throw new Error("Expected split root")
    expect((updateSplitRatio(root, root.id, 4) as ViewportSplit).ratio).toBe(20)
    expect((updateSplitRatio(root, root.id, 96) as ViewportSplit).ratio).toBe(
      80,
    )
  })

  it("rejects invalid persisted layouts", () => {
    expect(isWorkspaceNode(createPresetLayout(4))).toBe(true)
    expect(
      isWorkspaceNode({
        kind: "leaf",
        id: "bad",
        organ: "heart",
        modelId: "pulmo-densenet",
      }),
    ).toBe(false)
    expect(
      isWorkspaceNode({
        kind: "split",
        id: "bad",
        axis: "diagonal",
        ratio: 50,
      }),
    ).toBe(false)
  })
})
