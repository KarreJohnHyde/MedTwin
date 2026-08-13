import { expect, test } from "@playwright/test"

test("renders nonblank WebGL without layout collisions on desktop and mobile", async ({ page }) => {
  const errors: string[] = []
  const httpErrors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`)
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("http://127.0.0.1:8444")
  await expect(page.locator(".twin-canvas canvas")).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(3_000)

  const inspection = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".twin-canvas canvas")
    if (!canvas) return { litPixels: 0, variedPixels: 0, clippedButtons: ["canvas missing"], overflow: true }
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
    if (!gl) return { litPixels: 0, variedPixels: 0, clippedButtons: ["webgl missing"], overflow: true }
    const width = Math.min(canvas.width, 320)
    const height = Math.min(canvas.height, 240)
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let litPixels = 0
    let variedPixels = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index]
      const green = pixels[index + 1]
      const blue = pixels[index + 2]
      if (red + green + blue > 42) litPixels += 1
      if (Math.max(red, green, blue) - Math.min(red, green, blue) > 8) variedPixels += 1
    }
    const clippedButtons = [...document.querySelectorAll("button")]
      .filter((button) => button.offsetParent && (button.scrollWidth > button.clientWidth + 2 || button.scrollHeight > button.clientHeight + 2))
      .map((button) => button.textContent?.trim() || button.getAttribute("aria-label") || "button")
    return {
      litPixels,
      variedPixels,
      clippedButtons,
      overflow: document.body.scrollWidth > innerWidth + 2,
    }
  })
  expect(inspection.litPixels).toBeGreaterThan(1_000)
  expect(inspection.variedPixels).toBeGreaterThan(250)
  expect(inspection.clippedButtons).toEqual([])
  expect(inspection.overflow).toBe(false)
  expect(httpErrors, errors.join("\n")).toEqual([])
  await page.screenshot({ path: "../artifacts/ui-verification/desktop-final.png", fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.getByRole("heading", { name: /heart digital twin/i })).toBeVisible()
  await expect(page.locator(".twin-canvas canvas")).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(".analytics-suite__tabs")).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(2_000)
  const mobileOverflow = await page.evaluate(() => document.body.scrollWidth > innerWidth + 2)
  expect(mobileOverflow).toBe(false)
  await page.screenshot({ path: "../artifacts/ui-verification/mobile-final.png", fullPage: true })
})
