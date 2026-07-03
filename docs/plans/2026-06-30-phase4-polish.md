# Phase 4 — Polish & Publish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual regression testing, optimize performance, and prepare the project for npm publish.

**Architecture:** Playwright for visual diff testing with a demo HTML page. Performance benchmarks using the existing engine FPS counter. Package.json metadata and README for npm publication.

**Tech Stack:** Playwright, Vite (for demo page), Node.js

---

### Task 16: Playwright Visual Testing Setup

**Files:**
- Create: `packages/core/playwright.config.ts`
- Create: `packages/core/e2e/glass-demo.spec.ts`
- Create: `packages/core/e2e/index.html` (demo page)
- Modify: `packages/core/package.json` — add playwright deps and scripts

Set up Playwright to run visual regression tests against a demo HTML page that exercises the CSSAdapter (simplest to test — no WebGL required).

**Demo HTML page** — a simple page with a div using the liquid-glass CSS fallback effect.

**Playwright test** — opens the page, takes a screenshot, compares against baseline.

```typescript
import { test, expect } from "@playwright/test"

test("CSSAdapter renders glass effect", async ({ page }) => {
  await page.goto("/e2e/index.html")
  await page.waitForSelector(".glass-panel")
  const panel = page.locator(".glass-panel")
  await expect(panel).toBeAttached()
  // Visual comparison
  await expect(panel).toHaveScreenshot("glass-panel.png")
})
```

Also add the required Playwright configuration and npm scripts.

---

### Task 17: Performance Benchmark

**Files:**
- Create: `packages/core/bench/fps-benchmark.ts`
- Modify: `packages/core/package.json` — add bench script

Create a simple benchmark that measures FPS for CSSAdapter rendering.

The CSSAdapter is the simplest to benchmark: create N glass instances, measure FPS over time.

Since WebGL adapters can't be tested in node, the benchmark focuses on:
- CSSAdapter init time
- CSSAdapter FPS impact (should be near 60 since CSS handles rendering)

```typescript
// bench/fps-benchmark.ts
import { glass } from "../src/index"

async function benchmark() {
  const count = 10
  const instances = []
  
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div")
    document.body.appendChild(el)
    const inst = await glass(el, { effect: "liquid-glass", adapter: "css" })
    instances.push(inst)
  }
  
  // Measure FPS over 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const totalFps = instances.reduce((sum, i) => sum + i.fps, 0)
  const avgFps = totalFps / instances.length
  
  console.log(`Average FPS across ${count} instances: ${avgFps}`)
  
  instances.forEach(i => i.dispose())
}

benchmark()
```

---

### Task 18: npm Publish Preparation

**Files:**
- Modify: `packages/core/package.json` — add publish config, description, keywords, repository, license
- Modify: `packages/react/package.json` — same
- Modify: `packages/vue/package.json` — same
- Create: `README.md` at root

Add proper npm metadata:

- **description**: Clear description of the package
- **repository**: GitHub URL
- **license**: MIT
- **keywords**: liquid-glass, glassmorphism, webgl, canvas
- **publishConfig**: access public (for scoped packages)
- **bugs**, **homepage** links

README should include:
- Quick start example (one-liner)
- API overview
- Browser support table
- Links to docs

---

### Verification

```bash
npm run build      # All 3 packages
npm run test       # Unit tests
npm run typecheck  # TypeScript checks
npm run lint       # Biome lint
```
