# Adapter Overview

Liquid Canvas uses a three-tier progressive enhancement strategy. The appropriate adapter is selected automatically based on browser capabilities.

## Detection order

```
1. HTML-in-Canvas API available  → NativeAdapter   (best performance, live DOM)
2. html2canvas loaded            → HTML2CanvasAdapter (cross-browser, snapshot-based)
3. Fallback                      → CSSAdapter       (universal, backdrop-filter)
```

Detection checks for the experimental HTML-in-Canvas API (`drawElementImage` / `texElementImage2D` / `requestPaint`) on the relevant prototypes. See [`isHtmlInCanvasAvailable()`](./native.md#apiavailability-check).

## Forcing an adapter

You can override auto-detection with the `adapter` option:

```typescript
glass("#el", {
  effect: "liquid-glass",
  adapter: "css", // Force CSS fallback
})
```

### Graceful degradation when forcing `native`

If you explicitly set `adapter: "native"` on a browser that doesn't ship the HTML-in-Canvas API, `detectAdapter` **automatically falls back** to `html2canvas` (or `css` as a last resort). The card keeps rendering instead of staying transparent. The instance's `adapterType` reflects the actual adapter used, so your UI badge can show `native → html2canvas`.

## Background target

For panels floating over a full-page background, use `backgroundTarget` to specify the background element as the WebGL texture source:

```typescript
await glass("#panel", {
  effect: "liquid-glass",
  backgroundTarget: "#page-bg",
  refraction: 0.6,
})
```

The native and html2canvas adapters both capture the `backgroundTarget` element and crop/sample to the card's local region. The CSS adapter uses `backdrop-filter` instead (no texture capture).

## Comparison

| Feature | Native | HTML2Canvas | CSS |
|---------|--------|-------------|-----|
| Browser support | Chrome 138+ w/ flag | All modern | All modern |
| WebGL shaders | ✅ | ✅ | ❌ |
| DOM interaction | ✅ (live) | ⏳ (snapshot) | ✅ (live) |
| Performance | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Bundle size | 0 KB | +0 KB (html2canvas external) | 0 KB |
| Setup | Dual-canvas (source + overlay) | Overlay canvas | Inline styles |
| backgroundTarget | ✅ Local region via `layoutsubtree` child | ✅ Cropped from shared snapshot | ❌ (uses `backdrop-filter`) |
| Shared background cost | N/A (per-frame upload) | One `html2canvas` per background, shared across cards | N/A |
| Forced on unsupported browser | → falls back to html2canvas | — | — |
