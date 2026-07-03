// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { GlassOptions } from "../types"
import { CSSAdapter } from "./css"

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
    parentNode: null,
  }
  el.parentNode = { removeChild: () => {} }
  return el as HTMLElement
}

describe("CSSAdapter", () => {
  let adapter: CSSAdapter
  let target: HTMLElement

  beforeAll(() => {
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
        createElement: () => createMockElement(),
      }
      ;(globalThis as any).document = doc
      ;(globalThis as any).HTMLElement = class {} as any
    }
  })

  beforeEach(() => {
    adapter = new CSSAdapter()
    target = document.createElement("div")
    document.body.appendChild(target)
  })

  afterEach(() => {
    adapter.dispose()
    if (target.parentNode) {
      target.parentNode.removeChild(target)
    }
  })

  it("has type css", () => {
    expect(adapter.type).toBe("css")
  })

  it("applies glass styles on init", async () => {
    await adapter.init(target, createDefaultOptions())
    expect(target.style.backdropFilter).toContain("blur")
    expect(target.style.backgroundColor).toContain("rgba")
    expect(target.style.borderRadius).toBe("24px")
    expect(target.style.boxShadow).toContain("inset")
  })

  it("updates styles via setOptions", async () => {
    await adapter.init(target, createDefaultOptions())
    adapter.setOptions({ blur: 0.8, cornerRadius: 12 })
    expect(target.style.backdropFilter).toContain("blur(16px)")
    expect(target.style.borderRadius).toBe("12px")
  })

  it("restores original styles on dispose", async () => {
    target.style.backgroundColor = "red"
    await adapter.init(target, createDefaultOptions())
    adapter.dispose()
    expect(target.style.backgroundColor).toBe("red")
  })

  it("returns fps", () => {
    expect(adapter.fps).toBe(0)
  })
})
