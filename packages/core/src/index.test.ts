// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { glass, registry } from "./index"

function createMockElement(id: string): HTMLElement {
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
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  }
  el.parentNode = { removeChild: () => {} }
  return el as HTMLElement
}

let testTarget: HTMLElement

function setupDocument(): void {
  if (typeof document === "undefined") {
    testTarget = createMockElement("glass-entry")
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
      createElementNS: () => ({
        style: {} as Record<string, string>,
        id: "",
        appendChild: () => {},
        remove: () => {},
      }),
      getElementById: () => null,
      querySelector: (sel: string) => {
        if (sel === "#glass-entry") return testTarget
        return null
      },
    }
    ;(globalThis as any).document = doc
    ;(globalThis as any).HTMLElement = class {} as any
    ;(globalThis as any).requestAnimationFrame = () => 1 as any
    ;(globalThis as any).cancelAnimationFrame = () => {}
    ;(globalThis as any).performance = { now: () => 0 }
    ;(globalThis as any).window = {} as any
  }
}

describe("glass() entry point", () => {
  beforeAll(() => {
    setupDocument()
  })

  it("liquid-glass is auto-registered", () => {
    expect(registry.get("liquid-glass")).toBeDefined()
  })

  it("creates a glass instance from selector string", async () => {
    const inst = await glass("#glass-entry", { effect: "liquid-glass" })
    expect(inst.element).toBe(testTarget)
    expect(inst.adapterType).toBe("css")
    inst.dispose()
  })

  it("creates a glass instance from element", async () => {
    const el = createMockElement("direct-el")
    const inst = await glass(el, { effect: "liquid-glass" })
    expect(inst.element).toBe(el)
    inst.dispose()
  })

  it("creates a glass instance from config object", async () => {
    const inst = await glass({ target: "#glass-entry", effect: "liquid-glass" })
    expect(inst.element).toBe(testTarget)
    inst.dispose()
  })

  it("creates a glass instance with options in config object", async () => {
    const inst = await glass({
      target: "#glass-entry",
      effect: "liquid-glass",
      options: { refraction: 0.8, blur: 0.5 },
    })
    expect(inst.element).toBe(testTarget)
    inst.dispose()
  })

  it("throws for unregistered effect", async () => {
    await expect(glass("#glass-entry", { effect: "nonexistent" })).rejects.toThrow("not registered")
  })

  it("dispose cleans up", async () => {
    const inst = await glass("#glass-entry", { effect: "liquid-glass" })
    inst.dispose()
    // Should not throw
  })
})
