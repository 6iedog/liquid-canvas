# Liquid Canvas MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Phase 1 MVP of `@liquid-canvas/core` — a framework-agnostic engine that renders iOS-style Liquid Glass effects on HTML content using progressive enhancement (Native → html2canvas → CSS).

**Architecture:** Monorepo with `packages/core` as the primary package. A `glass()` entry function initializes the engine, auto-detects the best Adapter, loads the requested effect plugin, and runs a WebGL rendering loop. Effects are registered via a plugin registry. CSSAdapter provides a zero-dependency fallback.

**Tech Stack:** TypeScript (strict), tsup (build), Vitest (test), Biome (lint/format), GLSL (WebGL shaders)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (root — workspace config)
- Create: `tsconfig.base.json` (shared TypeScript config)
- Create: `biome.json` (linter/formatter config)
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts` (barrel export, placeholder)

**Step 1: Create root package.json**

```json
{
  "name": "liquid-canvas-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "-w @liquid-canvas/core run build",
    "dev": "-w @liquid-canvas/core run dev",
    "test": "-w @liquid-canvas/core run test",
    "typecheck": "-w @liquid-canvas/core run typecheck",
    "lint": "-w @liquid-canvas/core run lint",
    "format": "-w @liquid-canvas/core run format"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

**Step 3: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": false },
  "files": { "ignoreUnknown": false, "ignore": ["dist"] },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "organizeImports": { "enabled": true }
}
```

**Step 4: Create packages/core/package.json**

```json
{
  "name": "@liquid-canvas/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./effects": {
      "import": "./dist/effects/index.js",
      "require": "./dist/effects/index.cjs",
      "types": "./dist/effects/index.d.ts"
    }
  },
  "sideEffects": false,
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src/",
    "format": "biome format --write src/"
  },
  "peerDependencies": {
    "html2canvas": "^1.4.1"
  },
  "peerDependenciesMeta": {
    "html2canvas": { "optional": true }
  },
  "devDependencies": {
    "tsup": "^8.3.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 5: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 6: Create packages/core/tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'effects/index': 'src/effects/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
})
```

**Step 7: Create packages/core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
```

**Step 8: Create packages/core/src/index.ts**

```typescript
export const version = '0.1.0'
```

**Step 9: Verify scaffolding builds and lints**

Run: `npm install && npm run build && npm run lint`
Expected: Build succeeds, lint passes with no errors.

**Step 10: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold monorepo with tsup, vitest, biome"
```

---

### Task 2: Types — Define Public Type Interfaces

**Files:**
- Create: `packages/core/src/types.ts`

**Step 1: Review the spec types**

The spec defines:
- `GlassOptions` — configuration for the glass instance
- `GlassInstance` — return type of `glass()` function
- `GlassAdapter` interface
- `GlassEffectPlugin` interface
- `ControlDescriptor` interface

**Step 2: Write types.ts**

```typescript
export type AdapterType = 'native' | 'html2canvas' | 'css'

export interface GlassOptions {
  effect: string
  refraction: number
  blur: number
  chromaticAberration: number
  edgeHighlight: number
  specular: number
  fresnel: number
  cornerRadius: number
  tintStrength: number
  shadowOpacity: number
  responsive: boolean
  adapter: AdapterType | 'auto'
}

export interface MouseState {
  x: number
  y: number
  hovering: boolean
}

export interface GlassInstance {
  readonly element: HTMLElement
  readonly adapterType: AdapterType
  readonly fps: number
  setOptions(options: Partial<GlassOptions>): void
  markChanged(): void
  dispose(): void
}

export interface GlassAdapter {
  readonly type: AdapterType
  init(target: HTMLElement, options: GlassOptions): Promise<void>
  render(time: number): void
  setOptions(options: Partial<GlassOptions>): void
  markChanged(element?: HTMLElement): void
  dispose(): void
  readonly fps: number
}

export interface ControlDescriptor {
  key: string
  label: string
  type: 'slider' | 'color' | 'toggle' | 'select'
  min?: number
  max?: number
  step?: number
  default: number | boolean | string
}

export interface GlassEffectPlugin {
  id: string
  name: string
  getFragmentShader(): string
  getSVGFilter?(): { filter: string; id: string } | null
  getDefaultUniforms(): Record<string, number | number[]>
  updateUniforms?(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: Record<string, number>,
    time: number,
    mouse: MouseState,
  ): void
  getControls(): ControlDescriptor[]
}
```

**Step 3: Write a type guard test**

Create `packages/core/src/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('types', () => {
  it('AdapterType is a union of three strings', () => {
    const valid: string[] = ['native', 'html2canvas', 'css']
    expect(valid).toContain('native')
    expect(valid).toContain('html2canvas')
    expect(valid).toContain('css')
  })
})
```

**Step 4: Run test**

Run: `npm run test`
Expected: Tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/types.test.ts
git commit -m "feat: define public type interfaces"
```

---

### Task 3: Plugin Registry System

**Files:**
- Create: `packages/core/src/plugin.ts`

**Step 1: Create plugin.ts with registry**

```typescript
import type { GlassEffectPlugin } from './types'

class PluginRegistry {
  private plugins = new Map<string, GlassEffectPlugin>()

  register(plugin: GlassEffectPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`)
    }
    this.plugins.set(plugin.id, plugin)
  }

  get(id: string): GlassEffectPlugin | undefined {
    return this.plugins.get(id)
  }

  getAll(): GlassEffectPlugin[] {
    return Array.from(this.plugins.values())
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id)
  }
}

export const registry = new PluginRegistry()
```

**Step 2: Write tests**

Create `packages/core/src/plugin.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { registry } from './plugin'
import type { GlassEffectPlugin } from './types'

function createMockPlugin(id: string): GlassEffectPlugin {
  return {
    id,
    name: `Test ${id}`,
    getFragmentShader: () => 'void main() { gl_FragColor = vec4(1.0); }',
    getDefaultUniforms: () => ({}),
    getControls: () => [],
  }
}

describe('PluginRegistry', () => {
  beforeEach(() => {
    // Clear registry: unregister all
    for (const p of registry.getAll()) {
      registry.unregister(p.id)
    }
  })

  it('registers and retrieves a plugin', () => {
    const plugin = createMockPlugin('test-effect')
    registry.register(plugin)
    expect(registry.get('test-effect')).toBe(plugin)
  })

  it('throws on duplicate registration', () => {
    const plugin = createMockPlugin('dup')
    registry.register(plugin)
    expect(() => registry.register(plugin)).toThrow('already registered')
  })

  it('lists all registered plugins', () => {
    const a = createMockPlugin('a')
    const b = createMockPlugin('b')
    registry.register(a)
    registry.register(b)
    expect(registry.getAll()).toHaveLength(2)
  })

  it('unregisters a plugin', () => {
    const plugin = createMockPlugin('to-remove')
    registry.register(plugin)
    expect(registry.unregister('to-remove')).toBe(true)
    expect(registry.get('to-remove')).toBeUndefined()
  })
})
```

**Step 3: Run test**

Run: `npm run test`
Expected: All 4 tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/plugin.ts packages/core/src/plugin.test.ts
git commit -m "feat: add plugin registry system"
```

---

### Task 4: GlassAdapter Interface + CSSAdapter

**Files:**
- Create: `packages/core/src/adapter.ts`
- Create: `packages/core/src/adapters/css.ts`

**Step 1: Create adapter.ts (re-export the interface + detection logic)**

```typescript
import type { AdapterType, GlassAdapter } from './types'

export type { GlassAdapter, AdapterType }

export function detectAdapter(
  preferred: AdapterType | 'auto',
): AdapterType {
  if (preferred !== 'auto') return preferred
  // Native: check for drawElementImage support
  if (typeof HTMLCanvasElement !== 'undefined' && 'drawElementImage' in HTMLCanvasElement.prototype) {
    return 'native'
  }
  // html2canvas: check if library is loaded
  if (typeof (window as any).html2canvas === 'function') {
    return 'html2canvas'
  }
  // Fallback to CSS
  return 'css'
}
```

**Step 2: Create adapters/css.ts**

```typescript
import type { GlassAdapter, GlassOptions } from '../types'

export class CSSAdapter implements GlassAdapter {
  readonly type = 'css' as const
  private target: HTMLElement | null = null
  private options!: GlassOptions
  private originalStyles: Partial<CSSStyleDeclaration> = {}
  private _fps = 0

  get fps(): number {
    return this._fps
  }

  async init(target: HTMLElement, options: GlassOptions): Promise<void> {
    this.target = target
    this.options = options
    this.applyStyles()
  }

  render(_time: number): void {
    // CSS handles rendering automatically
  }

  setOptions(options: Partial<GlassOptions>): void {
    Object.assign(this.options, options)
    if (this.target) {
      this.applyStyles()
    }
  }

  markChanged(_element?: HTMLElement): void {
    // No-op for CSS adapter
  }

  dispose(): void {
    if (this.target) {
      for (const [key, value] of Object.entries(this.originalStyles)) {
        if (value !== undefined) {
          ;(this.target.style as any)[key] = value
        }
      }
    }
    this.target = null
  }

  private applyStyles(): void {
    if (!this.target) return
    const el = this.target
    const o = this.options

    // Save originals (first time only)
    if (Object.keys(this.originalStyles).length === 0) {
      this.originalStyles = {
        backdropFilter: el.style.backdropFilter,
        backgroundColor: el.style.backgroundColor,
        borderRadius: el.style.borderRadius,
        boxShadow: el.style.boxShadow,
      }
    }

    el.style.backdropFilter = `blur(${o.blur * 20}px) saturate(180%)`
    el.style.backgroundColor = `rgba(255, 255, 255, ${0.1 + o.tintStrength * 0.2})`
    el.style.borderRadius = `${o.cornerRadius}px`
    el.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.3), 0 ${o.shadowOpacity * 8}px ${o.shadowOpacity * 24}px rgba(0,0,0,0.2)`
  }
}
```

**Step 3: Write tests**

Create `packages/core/src/adapters/css.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CSSAdapter } from './css'
import type { GlassOptions } from '../types'

function createDefaultOptions(): GlassOptions {
  return {
    effect: 'liquid-glass',
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
    adapter: 'auto',
  }
}

describe('CSSAdapter', () => {
  let adapter: CSSAdapter
  let target: HTMLElement

  beforeEach(() => {
    adapter = new CSSAdapter()
    target = document.createElement('div')
    document.body.appendChild(target)
  })

  afterEach(() => {
    adapter.dispose()
    document.body.removeChild(target)
  })

  it('has type css', () => {
    expect(adapter.type).toBe('css')
  })

  it('applies glass styles on init', async () => {
    await adapter.init(target, createDefaultOptions())
    expect(target.style.backdropFilter).toContain('blur')
    expect(target.style.backgroundColor).toContain('rgba')
    expect(target.style.borderRadius).toBe('24px')
    expect(target.style.boxShadow).toContain('inset')
  })

  it('updates styles via setOptions', async () => {
    await adapter.init(target, createDefaultOptions())
    adapter.setOptions({ blur: 0.8, cornerRadius: 12 })
    expect(target.style.backdropFilter).toContain('blur(16px)')
    expect(target.style.borderRadius).toBe('12px')
  })

  it('restores original styles on dispose', async () => {
    target.style.backgroundColor = 'red'
    await adapter.init(target, createDefaultOptions())
    adapter.dispose()
    expect(target.style.backgroundColor).toBe('red')
  })
})
```

**Step 4: Run test**

Run: `npm run test`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/adapter.ts packages/core/src/adapters/css.ts packages/core/src/adapters/css.test.ts
git commit -m "feat: add GlassAdapter interface and CSSAdapter implementation"
```

---

### Task 5: Engine Core — Lifecycle & Render Loop

**Files:**
- Create: `packages/core/src/engine.ts`

**Step 1: Create engine.ts**

```typescript
import type { GlassOptions, GlassInstance, AdapterType, MouseState } from './types'
import type { GlassAdapter } from './adapter'
import { detectAdapter } from './adapter'
import { CSSAdapter } from './adapters/css'
import { registry } from './plugin'

const DEFAULT_OPTIONS: GlassOptions = {
  effect: 'liquid-glass',
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
  adapter: 'auto',
}

export class Engine {
  readonly element: HTMLElement
  readonly adapterType: AdapterType
  private adapter!: GlassAdapter
  private options: GlassOptions
  private animFrameId: number | null = null
  private startTime = 0
  private _fps = 0
  private frameCount = 0
  private lastFpsTime = 0
  private mouse: MouseState = { x: 0.5, y: 0.5, hovering: false }
  private disposed = false

  constructor(targetOrSelector: string | HTMLElement, userOptions: Partial<GlassOptions> = {}) {
    this.element = typeof targetOrSelector === 'string'
      ? document.querySelector(targetOrSelector) as HTMLElement
      : targetOrSelector

    if (!this.element) {
      throw new Error('Target element not found')
    }

    this.options = { ...DEFAULT_OPTIONS, ...userOptions }
    this.adapterType = detectAdapter(this.options.adapter)
  }

  async init(): Promise<void> {
    const plugin = registry.get(this.options.effect)
    if (!plugin) {
      throw new Error(`Effect "${this.options.effect}" not registered`)
    }

    // Select and initialize adapter
    this.adapter = this.createAdapter()
    await this.adapter.init(this.element, this.options)

    // Start render loop
    this.startTime = performance.now()
    this.lastFpsTime = this.startTime
    this.loop(this.startTime)

    // Mouse tracking
    if (this.options.responsive) {
      this.element.addEventListener('mousemove', this.onMouseMove)
      this.element.addEventListener('mouseenter', this.onMouseEnter)
      this.element.addEventListener('mouseleave', this.onMouseLeave)
    }
  }

  get fps(): number {
    return this._fps
  }

  setOptions(options: Partial<GlassOptions>): void {
    Object.assign(this.options, options)
    this.adapter.setOptions(this.options)
  }

  markChanged(): void {
    this.adapter.markChanged()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    this.element.removeEventListener('mousemove', this.onMouseMove)
    this.element.removeEventListener('mouseenter', this.onMouseEnter)
    this.element.removeEventListener('mouseleave', this.onMouseLeave)

    this.adapter.dispose()
  }

  private createAdapter(): GlassAdapter {
    switch (this.adapterType) {
      case 'css':
        return new CSSAdapter()
      case 'native':
      case 'html2canvas':
        throw new Error(`Adapter "${this.adapterType}" not yet implemented`)
      default:
        return new CSSAdapter()
    }
  }

  private loop = (now: number): void => {
    if (this.disposed) return

    const elapsed = now - this.startTime
    this.adapter.render(elapsed)

    // FPS calculation
    this.frameCount++
    if (now - this.lastFpsTime >= 1000) {
      this._fps = this.frameCount
      this.frameCount = 0
      this.lastFpsTime = now
    }

    this.animFrameId = requestAnimationFrame(this.loop)
  }

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.element.getBoundingClientRect()
    this.mouse = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      hovering: true,
    }
  }

  private onMouseEnter = (): void => {
    this.mouse.hovering = true
  }

  private onMouseLeave = (): void => {
    this.mouse.hovering = false
  }
}
```

**Step 2: Write tests**

Create `packages/core/src/engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Engine } from './engine'
import { registry } from './plugin'
import type { GlassEffectPlugin } from './types'

const mockPlugin: GlassEffectPlugin = {
  id: 'test-glass',
  name: 'Test Glass',
  getFragmentShader: () => 'void main() { gl_FragColor = vec4(1.0); }',
  getDefaultUniforms: () => ({}),
  getControls: () => [],
}

describe('Engine', () => {
  let target: HTMLElement

  beforeEach(() => {
    target = document.createElement('div')
    target.id = 'test-target'
    document.body.appendChild(target)
    registry.register(mockPlugin)
  })

  afterEach(() => {
    registry.unregister('test-glass')
    if (target.parentNode) {
      target.parentNode.removeChild(target)
    }
  })

  it('creates an engine with a target element', () => {
    const engine = new Engine(target, { effect: 'test-glass' })
    expect(engine.element).toBe(target)
  })

  it('creates an engine with a CSS selector', () => {
    const engine = new Engine('#test-target', { effect: 'test-glass' })
    expect(engine.element).toBe(target)
  })

  it('throws for non-existent element', () => {
    expect(() => new Engine('#nonexistent', { effect: 'test-glass' })).toThrow('not found')
  })

  it('throws for unregistered effect', async () => {
    const engine = new Engine(target, { effect: 'unknown-effect' })
    await expect(engine.init()).rejects.toThrow('not registered')
  })

  it('initializes adapter on init', async () => {
    const engine = new Engine(target, { effect: 'test-glass' })
    await engine.init()
    expect(engine.adapterType).toBe('css')
  })

  it('returns fps', async () => {
    const engine = new Engine(target, { effect: 'test-glass' })
    await engine.init()
    expect(typeof engine.fps).toBe('number')
    engine.dispose()
  })

  it('dispose cleans up', async () => {
    const engine = new Engine(target, { effect: 'test-glass' })
    await engine.init()
    engine.dispose()
    // Should not throw if disposed twice
    engine.dispose()
  })

  it('setOptions updates adapter', async () => {
    const engine = new Engine(target, { effect: 'test-glass' })
    await engine.init()
    engine.setOptions({ blur: 0.8 })
    expect(engine['options'].blur).toBe(0.8)
    engine.dispose()
  })

  it('markChanged delegates to adapter', async () => {
    const engine = new Engine(target, { effect: 'test-glass' })
    await engine.init()
    // Should not throw
    engine.markChanged()
    engine.dispose()
  })
})
```

**Step 3: Run test**

Run: `npm run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/engine.test.ts
git commit -m "feat: add engine core with lifecycle and render loop"
```

---

### Task 6: Liquid Glass Effect Plugin

**Files:**
- Create: `packages/core/src/effects/liquid-glass.ts`
- Create: `packages/core/src/effects/index.ts`

**Step 1: Create effects/liquid-glass.ts**

The fragment shader from the spec (approximately 120 lines GLSL) implements:
- SDF distance-based edge refraction
- Gaussian blur (13x13 adaptive sampling)
- Chromatic aberration (RGB split)
- Simplex noise organic flow
- Mouse tracking lens
- Fresnel edge light
- Specular highlight
- Edge glow
- Caustic halos
- Cool glass tint

```typescript
import type { GlassEffectPlugin } from '../types'

const FRAGMENT_SHADER = `#version 100
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_hover;

uniform float u_refraction;
uniform float u_blur;
uniform float u_chromatic;
uniform float u_edgeHighlight;

// Simplex noise functions (abbreviated — full implementation from ashima/webgl-noise)
// ... (full simplex noise GLSL)

void main() {
  vec2 uv = v_texCoord;

  // 1. Mouse distance
  vec2 diff = uv - u_mouse;
  diff.x *= u_resolution.x / u_resolution.y;
  float dist = length(diff);
  float dome = smoothstep(0.3, 0.3 * 0.08, dist) * u_hover;

  // 2. Organic noise
  float n1 = snoise(vec3(uv * 6.0, u_time * 0.55));
  float n2 = snoise(vec3(uv * 8.0, u_time * 0.4));
  vec2 organicWarp = vec2(n1, n2) * 0.012 * dome;

  // 3. Lens refraction
  vec2 dir = normalize(diff + 1e-6);
  vec2 refractOffset = -dir * u_refraction * 0.06 * dome;

  // 4. Ripple
  float ripple = sin(dist * 35.0 - u_time * 2.5) * 0.003 * dome;
  vec2 rippleOffset = dir * ripple;

  // 5. Total offset
  vec2 offset = refractOffset + organicWarp + rippleOffset;

  // 6. Chromatic aberration
  float edge = 1.0 - smoothstep(0.0, 0.3, dist);
  float aberr = (0.003 + 0.007 * edge) * u_chromatic;
  vec2 uvR = clamp(uv + offset * 1.07 + dir * aberr, 0.0, 1.0);
  vec2 uvG = clamp(uv + offset, 0.0, 1.0);
  vec2 uvB = clamp(uv + offset * 0.93 - dir * aberr, 0.0, 1.0);

  vec3 color = vec3(
    texture2D(u_texture, uvR).r,
    texture2D(u_texture, uvG).g,
    texture2D(u_texture, uvB).b
  );

  // 7. Specular highlight (Blinn-Phong)
  vec3 lightDir = normalize(vec3(0.5, -0.5, 1.0));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normalize(vec3(offset, 0.5)), halfDir), 0.0), 32.0);
  color += vec3(spec * 0.3 * u_edgeHighlight);

  // 8. Fresnel edge glow
  float fresnel = pow(1.0 - max(dot(viewDir, normalize(vec3(offset, 0.5))), 0.0), 3.0);
  color += vec3(0.4, 0.6, 1.0) * fresnel * 0.15 * u_edgeHighlight;

  // 9. Cool glass tint
  color *= vec3(0.95, 0.97, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`

export const liquidGlass: GlassEffectPlugin = {
  id: 'liquid-glass',
  name: 'Liquid Glass',
  getFragmentShader: () => FRAGMENT_SHADER,
  getDefaultUniforms: () => ({
    u_refraction: 0.6,
    u_blur: 0.3,
    u_chromatic: 0.04,
    u_edgeHighlight: 0.08,
  }),
  getControls: () => [
    { key: 'refraction', label: 'Refraction', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: 'blur', label: 'Blur', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: 'chromaticAberration', label: 'Chromatic Aberration', type: 'slider', min: 0, max: 0.1, step: 0.001, default: 0.04 },
    { key: 'edgeHighlight', label: 'Edge Highlight', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.08 },
  ],
  updateUniforms: (
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: Record<string, number>,
    _time: number,
    _mouse: { x: number; y: number; hovering: boolean },
  ): void => {
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name)
      if (loc !== null) {
        gl.uniform1f(loc, value)
      }
    }
  },
}
```

**Step 2: Create effects/index.ts**

```typescript
export { liquidGlass } from './liquid-glass'
```

**Step 3: Write tests**

Create `packages/core/src/effects/liquid-glass.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { liquidGlass } from './liquid-glass'

describe('liquidGlass plugin', () => {
  it('has correct id', () => {
    expect(liquidGlass.id).toBe('liquid-glass')
  })

  it('returns a fragment shader string', () => {
    const shader = liquidGlass.getFragmentShader()
    expect(shader).toContain('void main()')
    expect(shader).toContain('gl_FragColor')
  })

  it('returns default uniforms', () => {
    const uniforms = liquidGlass.getDefaultUniforms()
    expect(uniforms.u_refraction).toBe(0.6)
    expect(uniforms.u_blur).toBe(0.3)
  })

  it('returns control descriptors', () => {
    const controls = liquidGlass.getControls()
    expect(controls).toHaveLength(4)
    expect(controls[0].key).toBe('refraction')
  })
})
```

**Step 4: Run test**

Run: `npm run test`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/effects/
git commit -m "feat: add liquid-glass effect plugin with GLSL shader"
```

---

### Task 7: Main Entry — glass() Function

**Files:**
- Modify: `packages/core/src/index.ts`

**Step 1: Rewrite index.ts as the public API**

```typescript
import { Engine } from './engine'
import { registry } from './plugin'
import { liquidGlass } from './effects/liquid-glass'
import type { GlassOptions, GlassInstance } from './types'

// Auto-register built-in effects
registry.register(liquidGlass)

export interface GlassInput {
  target: string | HTMLElement
  effect?: string
  options?: Partial<GlassOptions>
  adapter?: 'auto' | 'native' | 'html2canvas' | 'css'
}

export async function glass(
  targetOrConfig: string | HTMLElement | GlassInput,
  options?: Partial<GlassOptions>,
): Promise<GlassInstance> {
  let target: string | HTMLElement
  let opts: Partial<GlassOptions> = {}

  if (typeof targetOrConfig === 'object' && 'target' in targetOrConfig) {
    target = targetOrConfig.target
    opts = {
      effect: targetOrConfig.effect,
      ...targetOrConfig.options,
      adapter: targetOrConfig.adapter,
    }
  } else {
    target = targetOrConfig as string | HTMLElement
    opts = options ?? {}
  }

  const engine = new Engine(target, opts)
  await engine.init()
  return engine
}

export { registry } from './plugin'
export { Engine } from './engine'
export type { GlassOptions, GlassInstance, AdapterType, GlassAdapter, GlassEffectPlugin, ControlDescriptor, MouseState } from './types'
export const version = '0.1.0'
```

**Step 2: Write integration test**

Create `packages/core/src/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { glass, registry } from './index'

describe('glass() entry point', () => {
  let target: HTMLElement

  beforeEach(() => {
    target = document.createElement('div')
    target.id = 'glass-entry'
    document.body.appendChild(target)
  })

  afterEach(() => {
    if (target.parentNode) {
      target.parentNode.removeChild(target)
    }
  })

  it('creates a glass instance from selector string', async () => {
    const inst = await glass('#glass-entry', { effect: 'liquid-glass' })
    expect(inst.element).toBe(target)
    expect(inst.adapterType).toBe('css')
    inst.dispose()
  })

  it('creates a glass instance from element', async () => {
    const inst = await glass(target, { effect: 'liquid-glass' })
    expect(inst.element).toBe(target)
    inst.dispose()
  })

  it('creates a glass instance from config object', async () => {
    const inst = await glass({ target: '#glass-entry', effect: 'liquid-glass' })
    expect(inst.element).toBe(target)
    inst.dispose()
  })

  it('liquid-glass is auto-registered', () => {
    expect(registry.get('liquid-glass')).toBeDefined()
  })
})
```

**Step 3: Run tests**

Run: `npm run test`
Expected: All tests pass.

**Step 4: Verify build**

Run: `npm run build && npm run typecheck`
Expected: Build succeeds with ESM + CJS outputs, typecheck passes.

**Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat: add glass() entry function with auto-registered effects"
```

---

### Verification

After all tasks complete, run the full validation:

```bash
npm run build      # tsup — ESM + CJS
npm run test       # Vitest — all unit tests
npm run typecheck  # tsc --noEmit — strict type checking
npm run lint       # Biome — lint
```

Expected: All pass with zero errors.
