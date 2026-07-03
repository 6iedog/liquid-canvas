# Liquid Canvas

> iOS-style Liquid Glass effects for the web — framework-agnostic, plugin-based, with three-tier progressive enhancement.

```bash
npm install @liquid-canvas/core
```

## Quick Start

```typescript
import { glass } from "@liquid-canvas/core"

const instance = await glass("#my-element", {
  effect: "liquid-glass",
  refraction: 0.6,
  blur: 0.3,
  chromaticAberration: 0.04,
  edgeHighlight: 0.08,
  specular: 0.15,
  fresnel: 1.0,
  cornerRadius: 24,
  tintStrength: 0.1,
  shadowOpacity: 0.3,
})
```

## Features

- **Three-tier fallback**: `NativeAdapter` (HTML-in-Canvas) → `HTML2CanvasAdapter` (html2canvas + WebGL) → `CSSAdapter` (backdrop-filter + SVG)
- **Plugin system**: Register custom GLSL shader effects
- **Framework bindings**: React (`@liquid-canvas/react`) and Vue (`@liquid-canvas/vue`)
- **Built-in effects**: `liquid-glass` (refraction + chromatic aberration + fresnel + specular) and `frosted-glass` (blur + tint + saturation)
- **Background target**: Use a separate element's background-image as the glass texture source via `backgroundTarget`
- **Shared snapshot cache**: Multiple cards over the same background share a single html2canvas snapshot (only one expensive capture per background)
- **Graceful degradation**: Forcing `adapter: "native"` on unsupported browsers automatically falls back to `html2canvas` (or `css`)
- **Debug logging**: Enable per-instance debug logs with `debug: true`

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `effect` | `string` | `"liquid-glass"` | Effect name (e.g. `"liquid-glass"`, `"frosted-glass"`) |
| `adapter` | `"auto" \| "native" \| "html2canvas" \| "css"` | `"auto"` | Adapter selection. `native` on unsupported browsers auto-falls-back to `html2canvas`. |
| `refraction` | `number` | `0.6` | Distortion intensity (liquid-glass only) |
| `blur` | `number` | `0.3` | Blur strength |
| `chromaticAberration` | `number` | `0.04` | RGB channel separation, 0–0.15 (liquid-glass only) |
| `edgeHighlight` | `number` | `0.08` | Edge highlight intensity |
| `specular` | `number` | `0.15` | Specular highlight (top band + mouse-follow hotspot, liquid-glass only) |
| `fresnel` | `number` | `1.0` | Fresnel rim glow strength, 0–2 (liquid-glass only) |
| `cornerRadius` | `number` | `24` | Border radius in px |
| `tintStrength` | `number` | `0.1` | Background tint opacity |
| `shadowOpacity` | `number` | `0.3` | Shadow intensity |
| `responsive` | `boolean` | `true` | Auto-resize on window resize |
| `backgroundTarget` | `string \| HTMLElement` | — | Element whose CSS `background-image` to use as glass texture |
| `debug` | `boolean` | `false` | Enable console debug logging |

## Browser Support

| Browser | Native (HTML-in-Canvas) | html2canvas | CSS |
|---------|-------------------------|-------------|-----|
| Chrome 138+ w/ flag | ✅ | ✅ | ✅ |
| Chrome (stable) | ❌ (auto → html2canvas) | ✅ | ✅ |
| Edge | ❌ (auto → html2canvas) | ✅ | ✅ |
| Safari | ❌ (auto → html2canvas) | ✅ | ✅ |
| Firefox | ❌ (auto → html2canvas) | ✅ | ✅ |

> The `native` adapter requires the experimental HTML-in-Canvas API (`drawElementImage` / `texElementImage2D` / `requestPaint` / `<canvas layoutsubtree>`). When unavailable, `adapter: "native"` silently falls back to `html2canvas` so cards still render instead of staying transparent.

## Packages

| Package | Description |
|---------|-------------|
| `@liquid-canvas/core` | Framework-agnostic core engine |
| `@liquid-canvas/react` | React `<Glass>` component |
| `@liquid-canvas/vue` | Vue `<Glass>` component |

## License

MIT
