import assert from "node:assert/strict"
import test from "node:test"
import { FixedWindowRateLimiter, validateInferencePayload } from "./security.mjs"

test("accepts only an anonymous bounded inference contract", () => {
  const payload = validateInferencePayload({
    anatomy: "brain",
    threshold: 0.7,
    horizon: 10,
    seed: 4,
    volume_summary: {
      format: "nifti",
      dimensions: [32, 32, 16],
      spacing: [1, 1, 1.5],
      normalized_contrast: 0.4,
      voxel_count: 16384,
    },
  })
  assert.equal(payload.anatomy, "brain")
  assert.equal(payload.volume_summary.voxel_count, 16384)
})

test("rejects identity fields and unknown anatomy", () => {
  assert.throws(() => validateInferencePayload({ anatomy: "heart", patient_name: "blocked" }), /Identity-bearing/)
  assert.throws(() => validateInferencePayload({ anatomy: "unknown" }), /Unsupported anatomy/)
})

test("rate limiter resets by fixed window", () => {
  const limiter = new FixedWindowRateLimiter(2, 100)
  assert.equal(limiter.consume("local", 0).allowed, true)
  assert.equal(limiter.consume("local", 10).allowed, true)
  assert.equal(limiter.consume("local", 20).allowed, false)
  assert.equal(limiter.consume("local", 120).allowed, true)
})
