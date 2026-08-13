import { timingSafeEqual } from "node:crypto"

export const allowedAnatomies = new Set([
  "heart",
  "brain",
  "nervous",
  "skeletal",
  "lungs",
  "renal",
  "digestive",
])

const identityTokens = [
  "name", "patient", "mrn", "email", "phone", "address", "birth", "dob",
  "record", "ssn", "passport", "identifier",
]
const allowedKeys = new Set(["anatomy", "threshold", "horizon", "seed", "volume_summary"])
const allowedVolumeKeys = new Set(["format", "dimensions", "spacing", "normalized_contrast", "voxel_count"])

export function containsIdentityFields(value) {
  if (Array.isArray(value)) return value.some(containsIdentityFields)
  if (!value || typeof value !== "object") return false
  return Object.entries(value).some(([key, nested]) => {
    const normalized = key.toLowerCase().replaceAll("-", "_")
    return identityTokens.some((token) => normalized.includes(token)) || containsIdentityFields(nested)
  })
}

export function validateInferencePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("JSON object required")
  if (containsIdentityFields(body)) throw new Error("Identity-bearing fields are not accepted")
  const unknown = Object.keys(body).filter((key) => !allowedKeys.has(key))
  if (unknown.length) throw new Error(`Unsupported fields: ${unknown.join(", ")}`)
  const anatomy = String(body.anatomy || "heart")
  const threshold = Number(body.threshold ?? 0.65)
  const horizon = Number(body.horizon ?? 12)
  const seed = Number(body.seed ?? 24)
  if (!allowedAnatomies.has(anatomy)) throw new Error("Unsupported anatomy")
  if (!Number.isFinite(threshold) || threshold < 0.1 || threshold > 0.95) throw new Error("Threshold must be between 0.10 and 0.95")
  if (!Number.isInteger(horizon) || horizon < 7 || horizon > 30) throw new Error("Forecast horizon must be between 7 and 30 days")
  if (!Number.isInteger(seed) || seed < 0 || seed > 1_000_000) throw new Error("Seed must be between 0 and 1000000")
  let volume_summary
  if (body.volume_summary !== undefined) {
    const volume = body.volume_summary
    if (!volume || typeof volume !== "object" || Array.isArray(volume)) throw new Error("volume_summary must be an object")
    const volumeUnknown = Object.keys(volume).filter((key) => !allowedVolumeKeys.has(key))
    if (volumeUnknown.length) throw new Error(`Unsupported volume fields: ${volumeUnknown.join(", ")}`)
    if (!new Set(["nifti", "dicom"]).has(volume.format)) throw new Error("Volume format must be nifti or dicom")
    if (!Array.isArray(volume.dimensions) || volume.dimensions.length !== 3 || volume.dimensions.some((item) => !Number.isInteger(item) || item < 1 || item > 2048)) throw new Error("Volume dimensions are invalid")
    if (!Array.isArray(volume.spacing) || volume.spacing.length !== 3 || volume.spacing.some((item) => !Number.isFinite(Number(item)) || Number(item) <= 0)) throw new Error("Volume spacing is invalid")
    volume_summary = {
      format: volume.format,
      dimensions: volume.dimensions.map(Number),
      spacing: volume.spacing.map(Number),
      normalized_contrast: Math.max(0, Math.min(1, Number(volume.normalized_contrast || 0))),
      voxel_count: Number(volume.voxel_count),
    }
  }
  return { anatomy, threshold, horizon, seed, ...(volume_summary ? { volume_summary } : {}) }
}

export function bearerAuthorized(header, configuredKey) {
  if (!configuredKey) return true
  const supplied = String(header || "").replace(/^Bearer\s+/i, "")
  const expectedBuffer = Buffer.from(configuredKey)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)
}

export class FixedWindowRateLimiter {
  constructor(limit = 60, windowMs = 60_000) {
    this.limit = limit
    this.windowMs = windowMs
    this.entries = new Map()
  }

  consume(key, now = Date.now()) {
    const current = this.entries.get(key)
    if (!current || now - current.startedAt >= this.windowMs) {
      this.entries.set(key, { count: 1, startedAt: now })
      return { allowed: true, remaining: this.limit - 1, resetAt: now + this.windowMs }
    }
    current.count += 1
    return {
      allowed: current.count <= this.limit,
      remaining: Math.max(0, this.limit - current.count),
      resetAt: current.startedAt + this.windowMs,
    }
  }
}
