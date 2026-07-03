// @vitest-environment node
import { describe, expect, it } from "vitest"

describe("CSSAdapter benchmark", () => {
  it("creates and disposes 10 instances quickly", async () => {
    if (typeof document === "undefined") {
      const elementsById: Record<string, any> = {}
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
        createElementNS: (_ns: string, tagName: string) => {
          const nsEl: any = {
            tagName,
            style: {} as Record<string, string>,
            id: "",
            parentNode: null,
            appendChild: () => {},
            remove: () => {},
            innerHTML: "",
          }
          return nsEl
        },
        getElementById: (id: string) => elementsById[id] ?? null,
      }
      ;(globalThis as any).document = doc
      ;(globalThis as any).HTMLElement = class {} as any
      ;(globalThis as any).requestAnimationFrame = () => 1 as any
      ;(globalThis as any).cancelAnimationFrame = () => {}
      ;(globalThis as any).performance = globalThis.performance ?? ({ now: () => 0 } as any)
    }

    const { glass } = await import("../src/index")
    const instances: any[] = []

    const initStart = performance.now()
    const COUNT = 10
    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement("div")
      document.body.appendChild(el)
      const inst = await glass(el, { effect: "liquid-glass", adapter: "css" })
      instances.push(inst)
    }
    const initTime = performance.now() - initStart

    expect(instances).toHaveLength(COUNT)
    expect(initTime).toBeGreaterThan(0)

    const disposeStart = performance.now()
    instances.forEach((inst) => inst.dispose())
    const disposeTime = performance.now() - disposeStart

    console.log(`\n  CSSAdapter × ${COUNT}:`)
    console.log(`  Init: ${initTime.toFixed(2)}ms total, ${(initTime / COUNT).toFixed(2)}ms avg`)
    console.log(`  Dispose: ${disposeTime.toFixed(2)}ms total, ${(disposeTime / COUNT).toFixed(2)}ms avg`)
  })
})

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
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    appendChild: () => {},
  }
  return el as HTMLElement
}
