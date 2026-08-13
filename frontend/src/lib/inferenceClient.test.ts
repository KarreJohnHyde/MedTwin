import { describe, expect, it } from "vitest"
import { localPreview } from "./inferenceClient"

describe("local fusion contract", () => {
  it("provides versioned models and complete validation evidence", () => {
    const result = localPreview("skeletal", 0.7, 8)
    expect(result.mode).toBe("synthetic-research-simulation")
    expect(result.models).toHaveLength(5)
    expect(result.models.every((model) => model.approval === "research-only")).toBe(true)
    expect(result.forecast).toHaveLength(9)
    expect(result.validation.calibration).toHaveLength(11)
    expect(result.validation.precision_recall).toHaveLength(11)
    expect(result.validation.subgroups).toHaveLength(4)
    expect(result.audit.identity_fields_processed).toBe(0)
  })
})
