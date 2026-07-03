# Installation

## Core

```bash
npm install @liquid-canvas/core
```

## Framework Bindings

```bash
# React
npm install @liquid-canvas/react

# Vue
npm install @liquid-canvas/vue
```

## Peer Dependencies

The core package has one optional peer dependency:

| Package | Required for | Optional |
|---------|-------------|----------|
| `html2canvas` ^1.4.1 | HTML2CanvasAdapter | Yes (CSS fallback works without it) |

Install it if you need cross-browser WebGL rendering:

```bash
npm install html2canvas
```

## CDN

You can also use the library directly from a CDN:

```html
<script type="importmap">
{
  "imports": {
    "@liquid-canvas/core": "https://esm.sh/@liquid-canvas/core"
  }
}
</script>
```
