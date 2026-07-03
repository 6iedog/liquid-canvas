# Phase 3 — Ecosystem Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build React and Vue bindings, add frostred-glass effect plugin, and update the monorepo build system.

**Architecture:** Framework bindings are thin wrappers that map the core `glass()` API to framework lifecycle hooks. Each binding is a separate package in the monorepo (`packages/react`, `packages/vue`). The frostred-glass plugin is a new effect in `packages/core/src/effects/`.

**Tech Stack:** React 18+, Vue 3, TypeScript, tsup

---

### Task 12: React Binding Package

**Files:**
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/tsup.config.ts`
- Create: `packages/react/src/index.ts`
- Create: `packages/react/src/index.test.tsx`

The React `<Glass>` component wraps `glass()` in `useEffect`/`useRef`:

```typescript
// packages/react/src/index.ts
import { useEffect, useRef } from "react"
import { glass } from "@liquid-canvas/core"
import type { GlassOptions, GlassInstance } from "@liquid-canvas/core"
import type { ReactNode, HTMLAttributes } from "react"

export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  effect?: string
  options?: Partial<GlassOptions>
  adapter?: "auto" | "native" | "html2canvas" | "css"
  children?: ReactNode
}

export function Glass({ effect, options, adapter, children, ...divProps }: GlassProps) {
  const ref = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<GlassInstance | null>(null)

  useEffect(() => {
    if (!ref.current) return
    glass(ref.current, { effect, options, adapter }).then((inst) => {
      instanceRef.current = inst
    })
    return () => {
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    instanceRef.current?.setOptions(options ?? {})
  }, [options])

  return <div ref={ref} {...divProps}>{children}</div>
}

export type { GlassOptions, GlassInstance }
```

### Task 13: Vue Binding Package

**Files:**
- Create: `packages/vue/package.json`
- Create: `packages/vue/tsconfig.json`
- Create: `packages/vue/tsup.config.ts`
- Create: `packages/vue/src/index.ts`

The Vue `<Glass>` component uses `onMounted`/`onUnmounted`:

```typescript
// packages/vue/src/index.ts
import { defineComponent, h, ref, onMounted, onUnmounted, watch, type PropType } from "vue"
import { glass } from "@liquid-canvas/core"
import type { GlassOptions, GlassInstance } from "@liquid-canvas/core"

export const Glass = defineComponent({
  name: "Glass",
  props: {
    effect: { type: String, default: "liquid-glass" },
    options: { type: Object as PropType<Partial<GlassOptions>>, default: () => ({}) },
    adapter: { type: String as PropType<"auto" | "native" | "html2canvas" | "css">, default: "auto" },
  },
  setup(props, { slots, attrs }) {
    const el = ref<HTMLElement>()
    let instance: GlassInstance | null = null

    onMounted(async () => {
      if (!el.value) return
      instance = await glass(el.value, {
        effect: props.effect,
        options: props.options,
        adapter: props.adapter,
      })
    })

    onUnmounted(() => {
      instance?.dispose()
      instance = null
    })

    watch(() => props.options, (opts) => {
      instance?.setOptions(opts ?? {})
    }, { deep: true })

    return () => h("div", { ref: el, ...attrs }, slots.default?.())
  },
})

export type { GlassOptions, GlassInstance }
```

### Task 14: Frosted Glass Effect Plugin

**Files:**
- Create: `packages/core/src/effects/frosted-glass.ts`
- Modify: `packages/core/src/effects/index.ts` — add export
- Modify: `packages/core/src/index.ts` — auto-register

A simpler effect that implements standard macOS/iOS frosted glass (blur + tint + saturation):

```typescript
import type { GlassEffectPlugin } from "../types"

const FRAGMENT_SHADER = `#version 100
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_hover;

uniform float u_blur;
uniform float u_tint;

void main() {
  vec2 uv = v_texCoord;

  // Mouse-responsive tint variation
  vec2 diff = uv - u_mouse;
  diff.x *= u_resolution.x / u_resolution.y;
  float dist = length(diff);
  float dome = smoothstep(0.4, 0.05, dist) * u_hover;

  // Simple blur via multi-tap (reduced samples for performance)
  vec2 texel = vec2(1.0) / u_resolution;
  float sigma = u_blur * 8.0;
  vec3 color = vec3(0.0);
  float total = 0.0;

  for (float x = -3.0; x <= 3.0; x++) {
    for (float y = -3.0; y <= 3.0; y++) {
      vec2 offset = vec2(x, y) * texel * sigma;
      float weight = exp(-(x*x + y*y) / (2.0 * 4.0));
      color += texture2D(u_texture, uv + offset).rgb * weight;
      total += weight;
    }
  }
  color /= total;

  // Frosted tint
  color = mix(color, vec3(0.9, 0.92, 0.95), u_tint * 0.3);

  // Hover highlight
  color += vec3(0.1, 0.12, 0.15) * dome * 0.1;

  gl_FragColor = vec4(color, 1.0);
}
`

export const frostredGlass: GlassEffectPlugin = {
  id: "frosted-glass",
  name: "Frosted Glass",
  getFragmentShader: () => FRAGMENT_SHADER,
  getDefaultUniforms: () => ({
    u_blur: 0.5,
    u_tint: 0.5,
  }),
  getControls: () => [
    { key: "blur", label: "Blur", type: "slider", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "tint", label: "Tint Strength", type: "slider", min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  getSVGFilter: () => ({
    id: "frosted-glass-fallback",
    filter: `<feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
      <feColorMatrix in="blur" type="saturate" values="1.8"/>
      <feComponentTransfer>
        <feFuncR type="linear" slope="0.9" intercept="0.05"/>
        <feFuncG type="linear" slope="0.92" intercept="0.05"/>
        <feFuncB type="linear" slope="0.95" intercept="0.05"/>
      </feComponentTransfer>`,
  }),
  updateUniforms: (gl, program, uniforms, _time, _mouse): void => {
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name)
      if (loc !== null) gl.uniform1f(loc, value)
    }
  },
}
```

### Task 15: Update Root Scripts

Update root `package.json` scripts to build/test/typecheck all packages.

---

### Verification

```bash
npm run build       # Build all packages
npm run test        # Run all tests
npm run typecheck   # Typecheck all packages
npm run lint        # Lint all packages
```
