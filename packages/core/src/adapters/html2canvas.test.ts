// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { registry } from "../plugin"
import type { GlassEffectPlugin, GlassOptions } from "../types"
import { HTML2CanvasAdapter } from "./html2canvas"

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

function createMockElement(): HTMLElement {
  const style: Record<string, string> = {}
  const el: any = {
    style: new Proxy(style, {
      get(target, prop) {
        if (prop in target) return target[prop as string]
        return ""
      },
      set(target, prop, value) {
        target[prop as string] = value
        return true
      },
    }),
    offsetWidth: 800,
    offsetHeight: 600,
    parentNode: { removeChild: () => {} },
    appendChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  }
  return el as HTMLElement
}

describe("HTML2CanvasAdapter", () => {
  let adapter: HTML2CanvasAdapter

  beforeAll(() => {
    registry.register(mockPlugin)
    if (typeof window === "undefined") {
      ;(globalThis as any).window = { devicePixelRatio: 1 }
    }
    if (typeof document === "undefined") {
      ;(globalThis as any).document = {
        createElement: () => ({
          width: 0,
          height: 0,
          style: {},
          getContext: () => null,
        }),
      }
    }
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

  it("throws on init when WebGL is not available", async () => {
    const target = createMockElement()
    await expect(adapter.init(target, createDefaultOptions())).rejects.toThrow(
      "WebGL is not available",
    )
  })

  it("returns fps", () => {
    expect(adapter.fps).toBe(0)
  })

  it("setOptions updates options without throwing", () => {
    expect(() => adapter.setOptions({ blur: 0.8 })).not.toThrow()
  })

  it("markChanged sets needsCapture without throwing", () => {
    expect(() => adapter.markChanged()).not.toThrow()
  })

  it("dispose cleans up without throwing", () => {
    adapter.dispose()
    adapter.dispose()
  })
})
