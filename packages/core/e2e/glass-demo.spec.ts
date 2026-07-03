import { test, expect } from "@playwright/test"

test("CSSAdapter renders the glass panel with correct styles", async ({ page }) => {
  await page.goto("/e2e/index.html")
  const panel = page.locator("#glass")
  await expect(panel).toBeAttached()

  // Verify CSS glass styles were applied
  const borderRadius = await panel.evaluate(el => getComputedStyle(el).borderRadius)
  expect(borderRadius).toBe("24px")

  const backdropFilter = await panel.evaluate(el => getComputedStyle(el).backdropFilter)
  expect(backdropFilter).toContain("blur")

  // Take screenshot for visual comparison
  await expect(page).toHaveScreenshot("glass-demo.png")
})
