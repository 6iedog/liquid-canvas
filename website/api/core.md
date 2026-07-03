# Core API Reference

## `glass()`

The main entry point. Creates a liquid glass effect on a target element.

### Signature

```typescript
function glass(
  targetOrConfig: string | HTMLElement | GlassInput,
  options?: Partial<GlassOptions>,
): Promise<GlassInstance>
```

### Usage

```typescript
import { glass } from "@liquid-canvas/core"

// By selector
const inst1 = await glass("#my-element", { effect: "liquid-glass" })

// By element
const el = document.querySelector("#my-element")
const inst2 = await glass(el, { effect: "liquid-glass" })

// By config object
const inst3 = await glass({
  target: "#my-element",
  effect: "liquid-glass",
  options: { refraction: 0.6, blur: 0.3 },
  adapter: "auto",
})
```

### GlassInput

```typescript
interface GlassInput {
  target: string | HTMLElement
  effect?: string
  options?: Partial<GlassOptions>
  adapter?: "auto" | "native" | "html2canvas" | "css"
}
```

### GlassOptions

```typescript
interface GlassOptions {
  effect: string           // Effect plugin ID
  refraction: number       // 0.0 – 1.0 (liquid-glass only)
  blur: number             // 0.0 – 1.0
  chromaticAberration: number // 0.0 – 0.15 (liquid-glass only)
  edgeHighlight: number    // 0.0 – 1.0
  specular: number         // 0.0 – 1.0 (liquid-glass only)
  fresnel: number          // 0.0 – 2.0 (liquid-glass only)
  cornerRadius: number     // px
  tintStrength: number     // 0.0 – 1.0
  shadowOpacity: number    // 0.0 – 1.0
  responsive: boolean      // Track mouse? (default: true)
  adapter: "auto" | "native" | "html2canvas" | "css"
  debug?: boolean           // Enable debug logs (default: false)
  backgroundTarget?: string | HTMLElement // Element to capture as WebGL texture source
}
```

> Forcing `adapter: "native"` on a browser without the HTML-in-Canvas API automatically falls back to `html2canvas` (or `css`). The `adapterType` field on the returned instance reflects the actual adapter used.

### GlassInstance

```typescript
interface GlassInstance {
  readonly element: HTMLElement
  readonly adapterType: "native" | "html2canvas" | "css"
  readonly fps: number
  setOptions(options: Partial<GlassOptions>): void
  markChanged(): void
  dispose(): void
}
```

## `registry`

The plugin registry singleton.

```typescript
import { registry } from "@liquid-canvas/core"

// Register a custom plugin
registry.register(myPlugin)

// Get a plugin
const plugin = registry.get("liquid-glass")

// List all plugins
const all = registry.getAll()

// Unregister
registry.unregister("my-plugin")
```

## Built-in Exports

```typescript
import {
  glass,
  registry,
  Engine,
  version,
  // Types
  type GlassOptions,
  type GlassInstance,
  type AdapterType,
  type GlassAdapter,
  type GlassEffectPlugin,
  type ControlDescriptor,
  type MouseState,
} from "@liquid-canvas/core"
```

### Effects sub-path

```typescript
import { liquidGlass, frostedGlass } from "@liquid-canvas/core/effects"
```
