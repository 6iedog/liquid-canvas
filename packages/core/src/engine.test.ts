// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Engine } from "./engine"
import { registry } from "./plugin"
import type { GlassEffectPlugin } from "./types"

const mockPlugin: GlassEffectPlugin = {
  id: "test-glass",
  name: "Test Glass",
  getFragmentShader: () => "void main() { gl_FragColor = vec4(1.0); }",
  getDefaultUniforms: () => ({}),
  getControls: () => [],
}

function createMockElement(id: string): HTMLElement {
  const children: any[] = []
  const style: Record<string, string> = {}
  const el: any = {
    id,
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
    parentNode: null,
    children,
    appendChild: (child: any) => {
      children.push(child)
      child.parentNode = el
    },
    removeChild: (child: any) => {
      const idx = children.indexOf(child)
      if (idx >= 0) children.splice(idx, 1)
    },
    insertBefore: (child: any) => {
      children.push(child)
      child.parentNode = el
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  }
  el.parentNode = { removeChild: () => {}, insertBefore: () => {} }
  return el as HTMLElement
}

function setupDocument(): void {
  if (typeof document === "undefined") {
    const body: any = { children: [] }
    body.appendChild = (el: any) => {
      body.children.push(el)
      el.parentNode = body
    }
    body.removeChild = (el: any) => {
      const idx = body.children.indexOf(el)
      if (idx >= 0) body.children.splice(idx, 1)
    }
    const doc: any = {
      body,
      createElement: () => createMockElement(""),
      querySelector: (sel: string) => {
        if (sel === "#test-target") return testTarget
        return null
      },
    }
    ;(globalThis as any).document = doc
    ;(globalThis as any).HTMLElement = class {} as any
    ;(globalThis as any).requestAnimationFrame = () => 1
    ;(globalThis as any).cancelAnimationFrame = () => {}
    ;(globalThis as any).performance = { now: () => 0 }
    ;(globalThis as any).window = {} as any
  }
}

let testTarget: HTMLElement

describe("Engine", () => {
  let target: HTMLElement

  beforeAll(() => {
    testTarget = createMockElement("test-target")
    setupDocument()
  })

  beforeEach(() => {
    target = createMockElement("test-target")
    registry.register(mockPlugin)
  })

  afterEach(() => {
    registry.unregister("test-glass")
  })

  it("creates an engine with a target element", () => {
    const engine = new Engine(target, { effect: "test-glass" })
    expect(engine.element).toBe(target)
  })

  it("creates an engine with a CSS selector", () => {
    const engine = new Engine("#test-target", { effect: "test-glass" })
    expect(engine.element).toBe(testTarget)
  })

  it("throws for non-existent element", () => {
    expect(() => new Engine("#nonexistent", { effect: "test-glass" })).toThrow("not found")
  })

  it("throws for unregistered effect", async () => {
    const engine = new Engine(target, { effect: "unknown-effect" })
    await expect(engine.init()).rejects.toThrow("not registered")
  })

  it("initializes adapter on init", async () => {
    const engine = new Engine(target, { effect: "test-glass" })
    await engine.init()
    expect(engine.adapterType).toBe("css")
    engine.dispose()
  })

  it("returns fps", async () => {
    const engine = new Engine(target, { effect: "test-glass" })
    await engine.init()
    expect(typeof engine.fps).toBe("number")
    engine.dispose()
  })

  it("dispose cleans up", async () => {
    const engine = new Engine(target, { effect: "test-glass" })
    await engine.init()
    engine.dispose()
    engine.dispose() // double dispose should not throw
  })

  it("setOptions updates options", async () => {
    const engine = new Engine(target, { effect: "test-glass" })
    await engine.init()
    engine.setOptions({ blur: 0.8 })
    expect((engine as any).options.blur).toBe(0.8)
    engine.dispose()
  })

  it("markChanged delegates to adapter", async () => {
    const engine = new Engine(target, { effect: "test-glass" })
    await engine.init()
    engine.markChanged()
    engine.dispose()
  })

  it("allows selecting html2canvas adapter via options", async () => {
    const engine = new Engine(target, { effect: "test-glass", adapter: "html2canvas" })
    expect(engine.adapterType).toBe("html2canvas")
    await expect(engine.init()).rejects.toThrow()
    engine.dispose()
  })

  it("allows selecting native adapter via options", async () => {
    const engine = new Engine(target, { effect: "test-glass", adapter: "native" })
    expect(engine.adapterType).toBe("native")
    await expect(engine.init()).rejects.toThrow()
    engine.dispose()
  })
})
