import { describe, expect, it } from "vitest"
import { parseNiftiBuffer, volumeSummary } from "./volumeLoader"

function niftiFixture() {
  const buffer = new ArrayBuffer(352 + 4 * 3 * 2 * 2)
  const view = new DataView(buffer)
  view.setInt32(0, 348, true)
  view.setInt16(40, 3, true)
  view.setInt16(42, 4, true)
  view.setInt16(44, 3, true)
  view.setInt16(46, 2, true)
  view.setInt16(70, 512, true)
  view.setInt16(72, 16, true)
  view.setFloat32(80, 0.8, true)
  view.setFloat32(84, 0.9, true)
  view.setFloat32(88, 1.5, true)
  view.setFloat32(108, 352, true)
  for (let index = 0; index < 24; index += 1) {
    view.setUint16(352 + index * 2, index * 10, true)
  }
  return buffer
}

describe("NIfTI volume loader", () => {
  it("parses dimensions, spacing, normalized values, and anonymous summary", () => {
    const volume = parseNiftiBuffer(niftiFixture())
    expect(volume.dimensions).toEqual([4, 3, 2])
    expect(volume.sourceDimensions).toEqual([4, 3, 2])
    expect(volume.spacing[2]).toBeCloseTo(1.5)
    expect(volume.values[0]).toBe(0)
    expect(volume.values.at(-1)).toBe(1)
    expect(volumeSummary(volume)).toEqual({
      format: "nifti",
      dimensions: [4, 3, 2],
      spacing: volume.spacing,
      normalized_contrast: volume.normalizedContrast,
      voxel_count: 24,
    })
  })

  it("rejects malformed headers", () => {
    expect(() => parseNiftiBuffer(new ArrayBuffer(400))).toThrow(/NIfTI-1/)
  })
})
