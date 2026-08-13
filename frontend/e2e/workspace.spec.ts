import { expect, test } from "@playwright/test"

function niftiFixture() {
  const buffer = Buffer.alloc(352 + 8 * 8 * 4 * 2)
  buffer.writeInt32LE(348, 0)
  buffer.writeInt16LE(3, 40)
  buffer.writeInt16LE(8, 42)
  buffer.writeInt16LE(8, 44)
  buffer.writeInt16LE(4, 46)
  buffer.writeInt16LE(512, 70)
  buffer.writeInt16LE(16, 72)
  buffer.writeFloatLE(1, 80)
  buffer.writeFloatLE(1, 84)
  buffer.writeFloatLE(1.5, 88)
  buffer.writeFloatLE(352, 108)
  for (let index = 0; index < 256; index += 1) buffer.writeUInt16LE(index, 352 + index * 2)
  return buffer
}

test("runs the anonymous 3D and validation workflow", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /heart digital twin/i })).toBeVisible()
  await expect(page.locator(".twin-canvas canvas")).toBeVisible({ timeout: 30_000 })

  await page.getByRole("button", { name: "Brain" }).click()
  await expect(page.getByRole("heading", { name: /brain digital twin/i })).toBeVisible()
  await page.getByRole("button", { name: "X-ray" }).click()
  await expect(page.locator(".canvas-status")).toContainText("XRAY")

  await page.locator(".analytics-suite__tabs > button").nth(2).click({ force: true })
  await expect(page.getByText("Calibration reliability")).toBeVisible()
  await expect(page.getByText("Decision-curve utility")).toBeVisible()

  await page.getByRole("button", { name: "Open local volume workspace" }).click()
  await page.locator("input[type=file]").setInputFiles({
    name: "anonymous-volume.nii",
    mimeType: "application/octet-stream",
    buffer: niftiFixture(),
  })
  await expect(page.getByText("Source matrix")).toBeVisible()
  await expect(page.getByText("8 × 8 × 4").first()).toBeVisible()
  await expect(page.locator(".canvas-status")).toContainText("VOLUME")
})
