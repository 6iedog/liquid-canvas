# Liquid Glass Effect

The flagship effect — a faithful recreation of iOS Liquid Glass with full optical simulation, based on a rounded-rectangle SDF and a three-layer refraction model inspired by [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js).

## Visual Features

| Effect | Description |
|--------|-------------|
| Rounded-rect SDF | Signed distance field drives all edge-driven effects (refraction, fresnel, rim) |
| Three-layer refraction | edge / rim / base refraction with exponential falloff toward the center |
| Chromatic aberration | RGB channel separation concentrated at the edge band (pixel-space offset) |
| Fresnel rim glow | Edge-proximity-based rim lighting with cool-white tint |
| Specular highlight | Top gradient band + mouse-following hotspot (visible on hover) |
| Gaussian blur | 13-tap circular blur, R/G/B sampled with chromatic offset so blur doesn't kill dispersion |
| Cool glass tint | Subtle blue tint mix |
| Alpha-aa edges | SDF anti-aliased alpha — rounded corners are transparent, no black border |

> Unlike `frosted-glass`, this effect has **refraction + chromatic aberration + fresnel + specular**. The displacement is concentrated in a ~25px edge band so the panel follows the card's rounded corners instead of looking like a circular lens.

## Options

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `refraction` | number | 0.6 | 0.0 – 1.0 | Edge + base refraction intensity |
| `blur` | number | 0.3 | 0.0 – 1.0 | Gaussian blur strength |
| `chromaticAberration` | number | 0.04 | 0.0 – 0.15 | RGB channel separation (pixel offset ≈ value × 120) |
| `edgeHighlight` | number | 0.08 | 0.0 – 1.0 | Edge rim light + top gradient |
| `specular` | number | 0.15 | 0.0 – 1.0 | Top specular band + mouse hotspot |
| `fresnel` | number | 1.0 | 0.0 – 2.0 | Fresnel rim glow strength |

## Example

```typescript
import { glass } from "@liquid-canvas/core"

// Basic usage — element must have its own background content
await glass("#panel", {
  effect: "liquid-glass",
  refraction: 0.6,
  blur: 0.3,
  chromaticAberration: 0.04,
  edgeHighlight: 0.08,
  specular: 0.15,
  fresnel: 1.0,
  cornerRadius: 24,
})

// Over a full-page background — specify backgroundTarget as texture source
await glass(".glass-card", {
  effect: "liquid-glass",
  backgroundTarget: "#page-bg",
  refraction: 0.6,
  blur: 0.3,
  fresnel: 1.2,
})
```

## How it differs from frosted-glass

| Feature | liquid-glass | frosted-glass |
|---------|--------------|---------------|
| Refraction | ✅ SDF-driven | ❌ |
| Chromatic aberration | ✅ | ❌ |
| Fresnel | ✅ | ❌ |
| Specular | ✅ | ❌ |
| Gaussian blur | ✅ | ✅ |
| Tint | ✅ subtle cool | ✅ stronger |
| Cost | Higher (multi-sample + dispersion) | Lower |

## CSS Fallback

When using CSSAdapter, the effect applies a `backdrop-filter: blur()` plus an SVG `feTurbulence` + `feDisplacementMap` filter (scoped via `backdrop-filter: url(#filter)` so only the background is distorted, not the foreground content). This produces a liquid-like fallback distinct from plain frosted glass.
