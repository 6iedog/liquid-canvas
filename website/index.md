# Liquid Canvas

> iOS-style Liquid Glass effects for the web — framework-agnostic, plugin-based, with three-tier progressive enhancement.

<div class="hero-actions">

```bash
npm install @liquid-canvas/core
```

<a href="/liquid-canvas/demo/" class="demo-button" target="_blank">▶ Live Demo</a>

</div>

<iframe src="/liquid-canvas/demo/" class="demo-iframe" loading="lazy" title="Liquid Canvas Live Demo"></iframe>

## Features

- **Three-tier fallback** — Native (drawElementImage) → HTML2Canvas (WebGL) → CSS (backdrop-filter + SVG)
- **Plugin system** — Register custom GLSL shader effects
- **Framework bindings** — React (`@liquid-canvas/react`) and Vue (`@liquid-canvas/vue`)
- **Built-in effects** — `liquid-glass` (full iOS style) and `frosted-glass` (simpler blur + tint)

## Quick Start

```typescript
import { glass } from "@liquid-canvas/core"

// Minimal usage
glass("#my-element", { effect: "liquid-glass" })

// Full configuration
const inst = await glass({
  target: document.querySelector("#panel"),
  effect: "liquid-glass",
  options: {
    refraction: 0.6,
    blur: 0.3,
    chromaticAberration: 0.04,
    edgeHighlight: 0.08,
    specular: 0.15,
    fresnel: 1.0,
    cornerRadius: 24,
  },
})

// Clean up
inst.dispose()
```

## Browser Support

| Browser          | Native (HTML-in-Canvas) | html2canvas | CSS |
|------------------|-------------------------|-------------|-----|
| Chrome 138+ w/ flag | ✅                   | ✅          | ✅  |
| Chrome (stable)  | ❌ → auto html2canvas   | ✅          | ✅  |
| Edge             | ❌ → auto html2canvas   | ✅          | ✅  |
| Safari           | ❌ → auto html2canvas   | ✅          | ✅  |
| Firefox          | ❌ → auto html2canvas   | ✅          | ✅  |

> Forcing `adapter: "native"` on an unsupported browser automatically falls back to `html2canvas`. See [Adapter Overview](./adapters/overview.md).

## Packages

| Package | Size | Description |
|---------|------|-------------|
| `@liquid-canvas/core` | 39 kB | Framework-agnostic core engine |
| `@liquid-canvas/react` | 4.6 kB | React `<Glass>` component |
| `@liquid-canvas/vue` | 2.7 kB | Vue `<Glass>` component |

<style>
.hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin: 24px 0;
}
.hero-actions .demo-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-radius: 100px;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}
.hero-actions .demo-button:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 20px rgba(102,126,234,0.4);
}
.demo-iframe {
  width: 100%;
  height: 560px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  margin: 24px 0 32px;
  background: #0b0d12;
}
</style>
