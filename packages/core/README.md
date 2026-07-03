# @liquid-canvas/core

iOS Liquid Glass effects for the web — framework-agnostic, plugin-based, three-tier progressive enhancement.

## Features

- Three-tier fallback: Native → HTML2Canvas (WebGL) → CSS (backdrop-filter + SVG)
- Plugin system for custom GLSL shader effects
- Built-in effects: `liquid-glass` (full iOS style) and `frosted-glass`
- Mouse tracking, chromatic aberration, edge refraction, and more

## Install

```bash
npm install @liquid-canvas/core
```

## Quick Start

```typescript
import { glass } from "@liquid-canvas/core"

const instance = await glass("#panel", {
  effect: "liquid-glass",
  options: { refraction: 0.6, blur: 0.3 },
})

// Clean up
instance.dispose()
```

> [📖 Documentation](https://6iedog.github.io/liquid-canvas/) &nbsp;|&nbsp; [📦 GitHub](https://github.com/6iedog/liquid-canvas) &nbsp;|&nbsp; [🐛 Issues](https://github.com/6iedog/liquid-canvas/issues)
