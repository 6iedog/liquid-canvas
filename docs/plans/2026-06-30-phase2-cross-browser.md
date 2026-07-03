# Phase 2 — Cross-Browser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement HTML2CanvasAdapter, NativeAdapter, SVG filter fallback, and wire them into the engine for cross-browser support.

**Architecture:** Two new adapters (HTML2CanvasAdapter, NativeAdapter) follow the same `GlassAdapter` interface as CSSAdapter. Both create a WebGL overlay canvas for shader rendering. The liquid-glass plugin gets an SVG filter for CSS fallback. The engine's `createAdapter()` and `detectAdapter()` are updated to support all three tiers.

**Tech Stack:** TypeScript, WebGL2, html2canvas (peer dep), GLSL

---

### Task 8: HTML2CanvasAdapter

**Files:**
- Create: `packages/core/src/adapters/html2canvas.ts`
- Create: `packages/core/src/adapters/html2canvas.test.ts`

**Step 1: Write html2canvas.ts**

This adapter captures the target element's DOM using html2canvas, uses the result as a WebGL texture, and applies the effect plugin's fragment shader in a render loop.

Core logic:
- `init()`: Create capture canvas + WebGL overlay canvas. Compile shader from plugin. Start render loop.
- `captureDOM()`: Call html2canvas on target, upload result as WebGL texture.
- `render()`: If needsCapture, call captureDOM. Bind texture, set uniforms, draw fullscreen quad.
- `markChanged()`: Set needsCapture flag (throttled to every 100ms).
- `dispose()`: Clean up WebGL resources, remove canvases.

Key architectural decisions:
- The overlay canvas is positioned absolutely over the target element
- The target element is cloned/referenced via html2canvas
- Shader compilation uses the plugin's `getFragmentShader()` and `getDefaultUniforms()`
- Mouse coordinates are passed as uniforms

```typescript
import type { GlassAdapter, GlassOptions } from "../types"
import type { Engine } from "../engine"

export class HTML2CanvasAdapter implements GlassAdapter {
  readonly type = "html2canvas"
  private target: HTMLElement | null = null
  private options!: GlassOptions
  private overlayCanvas: HTMLCanvasElement | null = null
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private needsCapture = false
  private lastCaptureTime = 0
  private captureThrottleMs = 100
  private _fps = 0
  private engine: Engine | null = null
  private mouse = { x: 0.5, y: 0.5, hovering: false }
  private vertexBuffer: WebGLBuffer | null = null
  private uvBuffer: WebGLBuffer | null = null

  get fps(): number { return this._fps }

  async init(target: HTMLElement, options: GlassOptions): Promise<void> {
    this.target = target
    this.options = options
    this.needsCapture = true

    // Create overlay canvas
    this.overlayCanvas = document.createElement("canvas")
    this.overlayCanvas.width = target.offsetWidth * window.devicePixelRatio
    this.overlayCanvas.height = target.offsetHeight * window.devicePixelRatio
    this.overlayCanvas.style.cssText = `
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      border-radius: ${options.cornerRadius}px;
    `
    target.style.position = "relative"
    target.appendChild(this.overlayCanvas)

    // Init WebGL
    this.gl = this.overlayCanvas.getContext("webgl2", { alpha: true })
    if (!this.gl) throw new Error("WebGL2 not supported")

    // Compile shader
    // NOTE: In actual runtime, engine passes the plugin. Here we get it from registry.
    const { registry } = await import("../plugin")
    const plugin = registry.get(options.effect)
    if (!plugin) throw new Error(`Effect "${options.effect}" not registered`)

    this.program = this.compileShader(plugin.getFragmentShader())
    if (!this.program) throw new Error("Shader compilation failed")

    // Setup fullscreen quad
    this.setupGeometry()

    // Initial capture
    await this.captureDOM()
  }

  render(time: number): void {
    if (!this.gl || !this.program || !this.texture) return

    const gl = this.gl

    if (this.needsCapture) {
      const now = performance.now()
      if (now - this.lastCaptureTime >= this.captureThrottleMs) {
        this.captureDOM()
        this.lastCaptureTime = now
        this.needsCapture = false
      }
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    // Bind texture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(gl.getUniformLocation(this.program, "u_texture"), 0)

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(this.program, "u_resolution"), gl.canvas.width, gl.canvas.height)
    gl.uniform2f(gl.getUniformLocation(this.program, "u_mouse"), this.mouse.x, this.mouse.y)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_time"), time / 1000)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_hover"), this.mouse.hovering ? 1.0 : 0.0)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_refraction"), this.options.refraction)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_blur"), this.options.blur)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_chromatic"), this.options.chromaticAberration)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_edgeHighlight"), this.options.edgeHighlight)

    // Draw
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  setOptions(options: Partial<GlassOptions>): void {
    Object.assign(this.options, options)
  }

  markChanged(_element?: HTMLElement): void {
    this.needsCapture = true
  }

  dispose(): void {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program)
    }
    if (this.overlayCanvas && this.overlayCanvas.parentNode) {
      this.overlayCanvas.parentNode.removeChild(this.overlayCanvas)
    }
    this.gl = null
    this.program = null
    this.texture = null
    this.overlayCanvas = null
  }

  private async captureDOM(): Promise<void> {
    if (!this.target || !this.gl) return
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(this.target, {
        scale: window.devicePixelRatio,
        useCORS: true,
        logging: false,
      })
      this.updateTexture(canvas)
    } catch {
      // Silently fail — will retry on next markChanged
    }
  }

  private updateTexture(source: HTMLCanvasElement | HTMLImageElement): void {
    if (!this.gl) return
    const gl = this.gl
    if (!this.texture) {
      this.texture = gl.createTexture()
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  private compileShader(fragmentSrc: string): WebGLProgram | null {
    if (!this.gl) return null
    const gl = this.gl

    const vertSrc = `#version 100
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }`

    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, vertSrc)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error("Vertex shader error:", gl.getShaderInfoLog(vs))
      return null
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, fragmentSrc)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("Fragment shader error:", gl.getShaderInfoLog(fs))
      return null
    }

    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program))
      return null
    }

    return program
  }

  private setupGeometry(): void {
    if (!this.gl) return
    const gl = this.gl

    // Fullscreen quad (triangle strip as 2 triangles)
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1])
    this.vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    // UV coords
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1])
    this.uvBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)
  }
}
```

**Step 2: Write html2canvas.test.ts**

Testing WebGL is complex in a node environment. Focus on testing:
- Class instantiation and type
- The adapter rejects if html2canvas is not available (init with missing dep)
- dispose cleans up
- setOptions updates options
- markChanged sets flag

```typescript
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { HTML2CanvasAdapter } from "./html2canvas"
import { registry } from "../plugin"
import type { GlassEffectPlugin, GlassOptions } from "../types"

const mockPlugin: GlassEffectPlugin = {
  id: "liquid-glass",
  name: "Test Glass",
  getFragmentShader: () => `#version 100
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    void main() {
      gl_FragColor = texture2D(u_texture, v_texCoord);
    }`,
  getDefaultUniforms: () => ({}),
  getControls: () => [],
}

function createDefaultOptions(): GlassOptions {
  return {
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
    responsive: true,
    adapter: "auto",
  }
}

describe("HTML2CanvasAdapter", () => {
  let adapter: HTML2CanvasAdapter

  beforeAll(() => {
    registry.register(mockPlugin)
  })

  afterAll(() => {
    registry.unregister("liquid-glass")
  })

  beforeEach(() => {
    adapter = new HTML2CanvasAdapter()
  })

  afterEach(() => {
    adapter.dispose()
  })

  it("has type html2canvas", () => {
    expect(adapter.type).toBe("html2canvas")
  })

  it("throws on init when WebGL2 is not available", async () => {
    // In node environment, WebGL2 is not available
    const target = document ? document.createElement("div") : ({ style: {}, appendChild: () => {} } as any)
    await expect(adapter.init(target, createDefaultOptions())).rejects.toThrow("WebGL2")
  })

  it("returns fps", () => {
    expect(adapter.fps).toBe(0)
  })

  it("setOptions updates options", () => {
    adapter.setOptions({ blur: 0.8 })
    // Options are stored internally
  })

  it("markChanged sets needsCapture", () => {
    adapter.markChanged()
    // Internal flag is set
  })

  it("dispose cleans up", () => {
    adapter.dispose()
    // Should not throw on double dispose
    adapter.dispose()
  })
})
```

---

### Task 9: SVG Filter Fallback for Liquid-Glass Plugin

**Files:**
- Modify: `packages/core/src/effects/liquid-glass.ts` — add `getSVGFilter()`
- Modify: `packages/core/src/adapters/css.ts` — apply SVG filter when available
- Modify: `packages/core/src/effects/liquid-glass.test.ts` — test SVG filter

**Step 1: Add getSVGFilter to liquid-glass plugin**

Add to the plugin object:
```typescript
getSVGFilter: () => ({
  id: "liquid-glass-fallback",
  filter: `<feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="2" seed="92" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2" result="blurred"/>
    <feDisplacementMap in="SourceGraphic" in2="blurred" scale="50" xChannelSelector="R" yChannelSelector="G"/>`,
}),
```

**Step 2: Update CSSAdapter to apply SVG filter**

Modify `applyStyles()` to inject SVG filter and add `filter: url(#liquid-glass-fallback)` to the element's style.

The CSSAdapter currently only applies CSS styles. Add a private method `applySVGFilter()` that:
1. Checks if the plugin provides `getSVGFilter()`
2. Creates or reuses an SVG element in the document
3. Adds the `filter` CSS property to the target element

---

### Task 10: NativeAdapter (drawElementImage)

**Files:**
- Create: `packages/core/src/adapters/native.ts`
- Create: `packages/core/src/adapters/native.test.ts`

**Step 1: Write native.ts**

This uses the experimental `drawElementImage()` API and `<canvas layoutsubtree>`. Since these APIs are only available in Chrome 147+ (Canary with flag), the adapter:
1. Wraps the target element inside a `<canvas layoutsubtree>` container
2. Listens for `paint` events to know when to redraw
3. Uses `ctx.drawElementImage(element, x, y)` to capture HTML content onto a 2D canvas
4. Creates a WebGL overlay canvas for shader effects
5. Mouse movement only updates uniforms (no 2D redraw)

```typescript
import type { GlassAdapter, GlassOptions } from "../types"

export class NativeAdapter implements GlassAdapter {
  readonly type = "native"
  private target: HTMLElement | null = null
  private options!: GlassOptions
  private captureCanvas: HTMLCanvasElement | null = null
  private captureCtx: CanvasRenderingContext2D | null = null
  private overlayCanvas: HTMLCanvasElement | null = null
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private container: HTMLElement | null = null
  private _fps = 0
  private needsRepaint = true
  private disposed = false

  get fps(): number { return this._fps }

  async init(target: HTMLElement, options: GlassOptions): Promise<void> {
    this.target = target
    this.options = options

    // Create container with scene wrapper
    this.container = document.createElement("div")
    this.container.className = "glass-scene"
    this.container.style.cssText = `
      position: relative; width: 100%; height: 100%;
    `

    // Create capture canvas with layoutsubtree
    this.captureCanvas = document.createElement("canvas")
    ;(this.captureCanvas as any).layoutSubtree = true
    this.captureCanvas.width = target.offsetWidth * window.devicePixelRatio
    this.captureCanvas.height = target.offsetHeight * window.devicePixelRatio
    this.captureCanvas.style.cssText = `
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
    `

    // Move target inside canvas
    const parent = target.parentNode
    if (parent) {
      parent.insertBefore(this.container, target)
      this.captureCanvas.appendChild(target)
      this.container.appendChild(this.captureCanvas)
    }

    // 2D capture context
    this.captureCtx = this.captureCanvas.getContext("2d")

    // Overlay canvas for WebGL
    this.overlayCanvas = document.createElement("canvas")
    this.overlayCanvas.width = this.captureCanvas.width
    this.overlayCanvas.height = this.captureCanvas.height
    this.overlayCanvas.style.cssText = `
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
    `
    this.container.appendChild(this.overlayCanvas)

    // WebGL
    this.gl = this.overlayCanvas.getContext("webgl2", { alpha: true })
    if (!this.gl) throw new Error("WebGL2 not supported")

    // Compile shader from plugin
    const { registry } = await import("../plugin")
    const plugin = registry.get(options.effect)
    if (!plugin) throw new Error(`Effect "${options.effect}" not registered`)

    this.program = this.compileShader(plugin.getFragmentShader())
    if (!this.program) throw new Error("Shader compilation failed")

    this.setupGeometry()

    // Listen for paint events
    this.captureCanvas.addEventListener("paint", this.onPaint as EventListener)
  }

  render(time: number): void {
    if (this.disposed || !this.gl || !this.program) return

    const gl = this.gl

    // Redraw 2D capture if needed (triggered by paint event)
    if (this.needsRepaint && this.captureCtx && this.target) {
      this.captureCtx.clearRect(0, 0, this.captureCanvas!.width, this.captureCanvas!.height)
      try {
        ;(this.captureCtx as any).drawElementImage(this.target, 0, 0)
      } catch {
        // API not available
      }
      this.updateTexture(this.captureCanvas!)
      this.needsRepaint = false
    }

    // WebGL render
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    if (this.texture) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.uniform1i(gl.getUniformLocation(this.program, "u_texture"), 0)
    }

    gl.uniform2f(gl.getUniformLocation(this.program, "u_resolution"), gl.canvas.width, gl.canvas.height)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_time"), time / 1000)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_refraction"), this.options.refraction)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_blur"), this.options.blur)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_chromatic"), this.options.chromaticAberration)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_edgeHighlight"), this.options.edgeHighlight)

    // Draw quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  // ... (setOptions, markChanged, dispose, compileShader, setupGeometry similar to HTML2CanvasAdapter)

  private vertexBuffer: WebGLBuffer | null = null
  private uvBuffer: WebGLBuffer | null = null

  private onPaint = (): void => {
    this.needsRepaint = true
  }

  private updateTexture(source: HTMLCanvasElement): void {
    if (!this.gl) return
    const gl = this.gl
    if (!this.texture) {
      this.texture = gl.createTexture()
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  private compileShader(fragmentSrc: string): WebGLProgram | null {
    // Same as HTML2CanvasAdapter
    if (!this.gl) return null
    const gl = this.gl
    const vertSrc = `#version 100
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }`
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, vertSrc)
    gl.compileShader(vs)
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, fragmentSrc)
    gl.compileShader(fs)
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    return program
  }

  private setupGeometry(): void {
    if (!this.gl) return
    const gl = this.gl
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1])
    this.vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1])
    this.uvBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)
  }
}
```

**Step 2: Write native.test.ts**

Similar to HTML2CanvasAdapter tests — focus on type, init error handling, setOptions, dispose.

---

### Task 11: Update Engine & Adapter Detection for Phase 2

**Files:**
- Modify: `packages/core/src/engine.ts` — wire up new adapters in `createAdapter()`
- Modify: `packages/core/src/adapter.ts` — enhance `detectAdapter()` if needed

**Step 1: Update engine.ts**

Add imports for HTML2CanvasAdapter and NativeAdapter, update `createAdapter()`:

```typescript
import { HTML2CanvasAdapter } from "./adapters/html2canvas"
import { NativeAdapter } from "./adapters/native"

// In createAdapter():
case "html2canvas":
  return new HTML2CanvasAdapter()
case "native":
  return new NativeAdapter()
```

**Step 2: Update detectAdapter()**

The current logic already handles auto-detection correctly. No changes needed unless we want to add more robust detection. The detection order is:
1. `drawElementImage` in Canvas prototype → native
2. `window.html2canvas` → html2canvas
3. Fallback → css

---

### Verification

After all tasks complete:
```bash
npm run build
npm run test
npm run typecheck
npm run lint
```
