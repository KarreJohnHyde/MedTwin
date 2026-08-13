import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { createServer } from "node:http"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { FixedWindowRateLimiter, allowedAnatomies, bearerAuthorized, validateInferencePayload } from "./security.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const enginePath = resolve(root, "inference", "fusion_engine.py")
const port = Number(process.env.MEDTWIN_GATEWAY_PORT || 8787)
const inferenceUrl = (process.env.MEDTWIN_INFERENCE_URL || "http://127.0.0.1:8790").replace(/\/$/, "")
const pythonBin = process.env.MEDTWIN_PYTHON_BIN || "python"
const apiKey = process.env.MEDTWIN_API_KEY || ""
const allowFallback = process.env.MEDTWIN_ALLOW_PROCESS_FALLBACK !== "0"
const auditSecret = process.env.MEDTWIN_AUDIT_SECRET || randomBytes(32).toString("hex")
const auditPath = resolve(root, process.env.MEDTWIN_AUDIT_PATH || "artifacts/audit/events.ndjson")
const auditMemoryLimit = Math.max(20, Number(process.env.MEDTWIN_AUDIT_MEMORY_LIMIT || 250))
const allowedOrigins = new Set(
  (process.env.MEDTWIN_ALLOWED_ORIGINS || "http://localhost:8443,http://localhost:8444,http://127.0.0.1:8445,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
)
const limiter = new FixedWindowRateLimiter(Number(process.env.MEDTWIN_RATE_LIMIT || 60), 60_000)
mkdirSync(dirname(auditPath), { recursive: true })
const auditEvents = existsSync(auditPath)
  ? readFileSync(auditPath, "utf8").trim().split("\n").filter(Boolean).slice(-auditMemoryLimit).flatMap((line) => {
      try { return [JSON.parse(line)] } catch { return [] }
    })
  : []
let auditHead = auditEvents.at(-1)?.chain_hash || "GENESIS"

function requestOrigin(req) {
  const origin = req.headers.origin
  return origin && allowedOrigins.has(origin) ? origin : ""
}

function responseHeaders(req, requestId, rate) {
  const origin = requestOrigin(req)
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-MedTwin-Role, X-Request-Id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Request-Id": requestId,
    "X-RateLimit-Remaining": String(rate?.remaining ?? 0),
    Vary: "Origin",
  }
}

function send(req, res, status, payload, requestId, rate) {
  res.writeHead(status, responseHeaders(req, requestId, rate))
  res.end(status === 204 ? "" : JSON.stringify(payload))
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let raw = ""
    let rejected = false
    req.on("data", (chunk) => {
      if (rejected) return
      raw += chunk
      if (raw.length > 32_768) {
        rejected = true
        reject(new Error("Request body is too large"))
        req.destroy()
      }
    })
    req.on("end", () => {
      if (rejected) return
      try {
        resolveBody(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error("Request body must be valid JSON"))
      }
    })
    req.on("error", reject)
  })
}

function appendAudit({ requestId, action, status, anatomy, role, source }) {
  const event = {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    action,
    status,
    anatomy: anatomy || null,
    role,
    source,
    identity_fields: 0,
    previous_hash: auditHead,
  }
  const chain_hash = createHmac("sha256", auditSecret).update(JSON.stringify(event)).digest("hex")
  const signedEvent = { ...event, chain_hash }
  appendFileSync(auditPath, `${JSON.stringify(signedEvent)}\n`, { encoding: "utf8", flag: "a" })
  auditHead = chain_hash
  auditEvents.push(signedEvent)
  if (auditEvents.length > auditMemoryLimit) auditEvents.shift()
}

async function fetchJson(url, options = {}, timeoutMs = 7_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || data.message || `Upstream returned ${response.status}`)
    return data
  } finally {
    clearTimeout(timeout)
  }
}

function runProcessFallback(payload) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(pythonBin, [enginePath], { cwd: root, stdio: ["pipe", "pipe", "pipe"], windowsHide: true })
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error("Fallback engine exceeded the 8 second limit"))
    }, 8_000)
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    child.on("error", (error) => { clearTimeout(timeout); reject(error) })
    child.on("close", (code) => {
      clearTimeout(timeout)
      if (code !== 0) return reject(new Error(stderr.trim() || `Fallback engine exited with code ${code}`))
      try { resolveResult({ ...JSON.parse(stdout), runtime: { service: "process-fallback" } }) }
      catch { reject(new Error("Fallback engine returned invalid JSON")) }
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

async function runInference(payload, requestId) {
  try {
    const result = await fetchJson(`${inferenceUrl}/api/inference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(payload),
    })
    return { result, source: "persistent-fastapi" }
  } catch (error) {
    if (!allowFallback) throw error
    return { result: await runProcessFallback(payload), source: "process-fallback" }
  }
}

const server = createServer(async (req, res) => {
  const requestId = String(req.headers["x-request-id"] || randomUUID()).slice(0, 64)
  const clientKey = req.socket.remoteAddress || "local"
  const rate = limiter.consume(clientKey)
  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) return send(req, res, 403, { status: "error", message: "Origin not allowed" }, requestId, rate)
  if (!rate.allowed) return send(req, res, 429, { status: "error", message: "Rate limit exceeded" }, requestId, rate)
  if (req.method === "OPTIONS") return send(req, res, 204, {}, requestId, rate)
  if (!bearerAuthorized(req.headers.authorization, apiKey)) return send(req, res, 401, { status: "error", message: "Unauthorized" }, requestId, rate)

  const roleHeader = String(req.headers["x-medtwin-role"] || "researcher")
  const role = new Set(["researcher", "reviewer", "admin"]).has(roleHeader) ? roleHeader : "researcher"

  if (req.method === "GET" && req.url === "/api/health") {
    let upstream = { status: "unavailable" }
    try { upstream = await fetchJson(`${inferenceUrl}/health`, {}, 1_500) } catch {}
    return send(req, res, 200, {
      status: "ready",
      privacy: "strict-anonymous-schema",
      auth: apiKey ? "bearer-required" : "local-development",
      audit: "hmac-chained-append-only-ndjson",
      upstream,
      anatomies: [...allowedAnatomies],
    }, requestId, rate)
  }

  if (req.method === "GET" && req.url === "/api/catalog") {
    try {
      const result = await fetchJson(`${inferenceUrl}/api/catalog`)
      return send(req, res, 200, result, requestId, rate)
    } catch (error) {
      return send(req, res, 503, { status: "error", message: error.message }, requestId, rate)
    }
  }

  if (req.method === "GET" && req.url === "/api/audit") {
    if (role !== "admin" && role !== "reviewer") return send(req, res, 403, { status: "error", message: "Reviewer role required" }, requestId, rate)
    return send(req, res, 200, { status: "ready", retained: auditEvents.length, events: auditEvents }, requestId, rate)
  }

  if (req.method === "POST" && req.url === "/api/inference") {
    try {
      const payload = validateInferencePayload(await readJson(req))
      const { result, source } = await runInference(payload, requestId)
      appendAudit({ requestId, action: "fusion.inference", status: "complete", anatomy: payload.anatomy, role, source })
      return send(req, res, 200, { ...result, gateway: { request_id: requestId, role, source } }, requestId, rate)
    } catch (error) {
      appendAudit({ requestId, action: "fusion.inference", status: "rejected", role, source: "gateway" })
      return send(req, res, 422, { status: "error", message: error instanceof Error ? error.message : "Inference failed" }, requestId, rate)
    }
  }

  return send(req, res, 404, { status: "error", message: "Route not found" }, requestId, rate)
})

server.listen(port, "0.0.0.0", () => {
  console.log(`MedTwin secured gateway listening on http://localhost:${port}`)
})
