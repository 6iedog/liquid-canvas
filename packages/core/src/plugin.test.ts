// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest"
import { registry } from "./plugin"
import type { GlassEffectPlugin } from "./types"

function createMockPlugin(id: string): GlassEffectPlugin {
  return {
    id,
    name: `Test ${id}`,
    getFragmentShader: () => "void main() { gl_FragColor = vec4(1.0); }",
    getDefaultUniforms: () => ({}),
    getControls: () => [],
  }
}

describe("PluginRegistry", () => {
  beforeEach(() => {
    const all = registry.getAll()
    for (const p of all) {
      registry.unregister(p.id)
    }
  })

  it("registers and retrieves a plugin", () => {
    const plugin = createMockPlugin("test-effect")
    registry.register(plugin)
    expect(registry.get("test-effect")).toBe(plugin)
  })

  it("throws on duplicate registration", () => {
    const plugin = createMockPlugin("dup")
    registry.register(plugin)
    expect(() => registry.register(plugin)).toThrow("already registered")
  })

  it("lists all registered plugins", () => {
    const a = createMockPlugin("a")
    const b = createMockPlugin("b")
    registry.register(a)
    registry.register(b)
    expect(registry.getAll()).toHaveLength(2)
  })

  it("unregisters a plugin", () => {
    const plugin = createMockPlugin("to-remove")
    registry.register(plugin)
    expect(registry.unregister("to-remove")).toBe(true)
    expect(registry.get("to-remove")).toBeUndefined()
  })
})
