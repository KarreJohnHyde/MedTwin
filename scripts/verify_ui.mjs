import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const appUrl = process.argv[2] || "http://localhost:8444"
const debuggerUrl = process.argv[3] || "http://127.0.0.1:9222"
const outputDir = resolve("artifacts", "ui-verification")
await mkdir(outputDir, { recursive: true })

const target = await fetch(`${debuggerUrl}/json/new?${encodeURIComponent(appUrl)}`, {
  method: "PUT",
}).then((response) => response.json())
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolveOpen, reject) => {
  socket.onopen = resolveOpen
  socket.onerror = reject
})

let sequence = 0
const pending = new Map()
const consoleErrors = []
socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
    return
  }
  if (message.method === "Runtime.exceptionThrown") {
    consoleErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    consoleErrors.push(message.params.args.map((argument) => argument.value || argument.description).join(" "))
  }
}

function cdp(method, params = {}) {
  return new Promise((resolveCall, reject) => {
    const id = ++sequence
    pending.set(id, { resolve: resolveCall, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const response = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}

async function screenshot(name) {
  const response = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  })
  const path = resolve(outputDir, name)
  await writeFile(path, Buffer.from(response.data, "base64"))
  return path
}

async function wait(milliseconds) {
  await new Promise((resolveWait) => setTimeout(resolveWait, milliseconds))
}

const inspectionScript = `(() => {
  const text = document.body.innerText;
  const canvas = document.querySelector("canvas");
  let canvasStats = null;
  if (canvas) {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (gl) {
      const width = Math.min(canvas.width, 320);
      const height = Math.min(canvas.height, 240);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let litPixels = 0;
      let variedPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
        if (red + green + blue > 42) litPixels += 1;
        if (Math.max(red, green, blue) - Math.min(red, green, blue) > 8) variedPixels += 1;
      }
      canvasStats = { width: canvas.width, height: canvas.height, litPixels, variedPixels };
    }
  }
  const clippedButtons = [...document.querySelectorAll("button")]
    .filter((button) => button.offsetParent && (button.scrollWidth > button.clientWidth + 2 || button.scrollHeight > button.clientHeight + 2))
    .map((button) => button.textContent.trim()).filter(Boolean).slice(0, 10);
  return {
    title: document.title,
    hasContent: text.length > 1000,
    textLength: text.length,
    errorOverlay: Boolean(document.querySelector(".vite-error-overlay, vite-error-overlay, [data-nextjs-dialog]")),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    horizontalOverflow: document.body.scrollWidth > innerWidth + 2,
    clippedButtons,
    canvasStats,
    gatewayConnected: text.includes("NODE + PYTHON CONNECTED"),
    activeAnatomy: document.querySelector(".viewport-header h1")?.textContent,
  };
})()`

await cdp("Runtime.enable")
await cdp("Page.enable")
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
})
await cdp("Page.navigate", { url: appUrl })
await wait(3200)
const desktopInitial = await evaluate(inspectionScript)
const desktopInitialImage = await screenshot("desktop-initial.png")

await evaluate(`(() => {
  const clickText = (text) => [...document.querySelectorAll("button")].find((button) => button.textContent.trim().includes(text))?.click();
  clickText("Skeletal system");
  clickText("Mesh");
  return true;
})()`)
await wait(650)
await evaluate(`(() => {
  [...document.querySelectorAll("button")].find((button) => button.textContent.trim().includes("Run multimodel fusion"))?.click();
  return true;
})()`)
await wait(5200)
const desktopInteractive = await evaluate(inspectionScript)
const desktopInteractiveImage = await screenshot("desktop-skeletal-mesh.png")

await cdp("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
  screenWidth: 390,
  screenHeight: 844,
})
await cdp("Page.reload", { ignoreCache: true })
await wait(3500)
const mobile = await evaluate(inspectionScript)
const mobileImage = await screenshot("mobile-initial.png")
await evaluate(`(() => {
  const analytics = document.querySelector(".analytics-suite");
  if (analytics) window.scrollTo(0, analytics.offsetTop);
  return window.scrollY;
})()`)
await wait(500)
const mobileAnalyticsImage = await screenshot("mobile-analytics.png")

console.log(JSON.stringify({
  desktopInitial,
  desktopInteractive,
  mobile,
  consoleErrors,
  screenshots: [desktopInitialImage, desktopInteractiveImage, mobileImage, mobileAnalyticsImage],
}, null, 2))
socket.close()
