# HTML2Canvas Adapter

Captures the `backgroundTarget` element using `html2canvas`, crops to the card's local region, uploads the result as a WebGL texture, and runs the effect's fragment shader on an overlay canvas.

## How it works

### Two-path capture (snapshot + crop)

`html2canvas` is very expensive (clones the entire DOM, computes styles). To keep the render loop smooth, capture is split into two paths:

1. **`takeSnapshot()`** (slow, ~300–500ms) — captures the full `backgroundTarget` into a cached canvas. Only runs when the background actually changes (`markChanged()`, background switch).
2. **`cropFromSnapshot()`** (fast, ~1ms) — `drawImage` crops the card's region from the cached snapshot. Safe to run on every scroll / resize.

### Shared snapshot cache (module-level)

Multiple adapter instances targeting the **same background element** share a single snapshot at module level. Without this, N cards over the same `#page-bg` would trigger N independent `html2canvas` calls — a 6-card test matrix would take ~9 seconds. With the cache, only the first adapter pays the cost; the rest hit the cache instantly.

- Cache key: `bgIdentity` (selector or element fingerprint) + `version` (bumped by any adapter's `markChanged()`).
- **In-flight coalescing**: when adapter A starts a snapshot, adapters B/C/D awaiting the same bg+version await the same Promise instead of starting their own.
- `markChanged()` bumps the global version, invalidating the cache for all adapters sharing the background.

### scale: 1 (not dpr)

Snapshots are captured at `scale: 1` (CSS pixels). Capturing at `devicePixelRatio` produces 4× pixels on retina and is 4× slower — and the glass shader blurs the background anyway, so high-res is wasted. Crop coordinates are in CSS pixels to match.

### Render loop

Every frame:
1. If `needsFullSnapshot` is set (and >500ms since last snapshot), run `takeSnapshot()`.
2. If `needsCrop` is set (scroll/resize), run `cropFromSnapshot()`.
3. Run the WebGL shader.

## Performance characteristics

- **First card over a background**: ~300–500ms (one `html2canvas` call).
- **Additional cards over the same background**: ~0ms (cache hit).
- **Scroll / resize**: ~1ms per card (just `drawImage` crop + texture upload).
- **Every frame**: only the WebGL shader runs — no DOM operations.

## Requirements

```bash
npm install html2canvas
```

Or include via CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
```

The adapter dynamically imports `html2canvas` if `window.html2canvas` is not present, so it works with either a script tag or a bundler.

## When to use

- You need the full WebGL shader effects in all modern browsers (the default cross-browser path).
- Multiple glass cards over a shared background (the shared cache makes this near-free after the first card).
- Acceptable for most use cases — the only cost is the initial snapshot per background.

## Example

```typescript
await glass("#panel", {
  effect: "liquid-glass",
  adapter: "html2canvas",
  backgroundTarget: "#page-bg",
  refraction: 0.6,
  blur: 0.3,
})
```
