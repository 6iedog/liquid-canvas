# Native Adapter

Uses the experimental **HTML-in-Canvas API** (`drawElementImage` / `texElementImage2D` / `requestPaint` / `<canvas layoutsubtree>`) for native HTML capture. This is the highest-performance path because it avoids cloning the DOM and runs entirely in the browser's rendering pipeline.

## How it works

The native adapter uses a **dual-canvas architecture** to decouple background sampling from glass rendering:

1. **Source canvas** (hidden, with `<canvas layoutsubtree>` attribute):
   - Contains a child `<div>` that replicates the page background behind the target card (same `background-image`, `background-size`, `background-position`, with a transform offset so the card's region is visible inside the source canvas).
   - The `layoutsubtree` attribute opts canvas children into layout.
   - `onpaint` fires whenever the child's rendered content changes.
   - `requestPaint()` forces a paint event.
2. **Overlay canvas** (visible, on top of the target):
   - Runs the effect's fragment shader in WebGL.
   - Reads the texture uploaded from the source canvas.

### Texture upload path

The adapter prefers `texElementImage2D` (uploads the child element directly as a WebGL texture, no 2D intermediate). When unavailable, it falls back to `drawElementImage` (renders child to 2D context) + `texImage2D` (uploads the canvas).

### Background sync

On init, resize, and scroll, `syncBackgroundChild()` updates the child div's size and transform so the source canvas always shows the card's current region of the page background. `requestPaint()` is then called to trigger a new texture upload.

## API availability check

The adapter exports `isHtmlInCanvasAvailable()` and calls it at the start of `init()`. If the API is missing, it throws a clear error explaining the requirement. `detectAdapter` also consults this function — see [Adapter Overview](./overview.md).

## Graceful degradation

If you explicitly set `adapter: "native"` on an unsupported browser, `detectAdapter` automatically falls back to `html2canvas` (or `css` as a last resort) instead of letting the card stay transparent. The badge on the demo card shows `native → html2canvas` so the fallback is visible.

## Browser support

The HTML-in-Canvas API is experimental (2025):
- Chrome 138+ with the `Experimental Web Platform Features` flag enabled
- Other browsers: not yet shipping

## When to use

- Chrome-only applications (Electron, Chrome kiosk, internal tools)
- Maximum performance is required (no DOM cloning overhead)
- You want live DOM interaction (mouse moves, hover states) reflected in the glass

## Example

```typescript
await glass("#panel", {
  effect: "liquid-glass",
  adapter: "native",
  backgroundTarget: "#page-bg",
  refraction: 0.6,
  blur: 0.3,
})
```
