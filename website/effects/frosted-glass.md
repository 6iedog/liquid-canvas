# Frosted Glass Effect

A simpler effect inspired by macOS/iOS frosted glass — blur + tint + saturation boost, driven by the same rounded-rectangle SDF as `liquid-glass` but **without** refraction, chromatic aberration, fresnel, or specular.

## Visual Features

| Effect | Description |
|--------|-------------|
| Rounded-rect SDF | Same SDF as liquid-glass, used for edge highlights and alpha-aa |
| Gaussian blur | Multi-tap sampling |
| Frosted tint | Cool blue-white color shift (stronger than liquid-glass) |
| Top gradient highlight | Soft top-edge brightness |
| Rim light | Thin edge highlight driven by SDF distance |
| Alpha-aa edges | SDF anti-aliased alpha — rounded corners are transparent, no black border |

> Use this when you want a clean frosted look without the optical distortion of liquid-glass. It's cheaper to render (no multi-sample dispersion, no refraction math).

## Options

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `blur` | number | 0.5 | 0.0 – 1.0 | Gaussian blur strength |
| `edgeHighlight` | number | 0.08 | 0.0 – 1.0 | Top gradient + rim light |
| `tintStrength` | number | 0.1 | 0.0 – 1.0 | Tint opacity |
| `cornerRadius` | number | 24 | px | Border radius |

> `refraction`, `chromaticAberration`, `specular`, and `fresnel` are ignored by this effect (they're liquid-glass-only). Passing them is harmless.

## Example

```typescript
import { glass } from "@liquid-canvas/core"

await glass("#panel", {
  effect: "frosted-glass",
  blur: 0.5,
  edgeHighlight: 0.08,
  tintStrength: 0.1,
  cornerRadius: 24,
})
```

## CSS Fallback

Uses `backdrop-filter: blur() saturate(180%)` plus a cool tint via `background-color`. No SVG displacement filter (that's liquid-glass-only).
