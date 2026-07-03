// @vitest-environment node
import { describe, expect, it } from "vitest"
import { frostredGlass } from "./frosted-glass"

describe("frostredGlass plugin", () => {
  it("has correct id", () => {
    expect(frostredGlass.id).toBe("frosted-glass")
  })

  it("returns a fragment shader string", () => {
    const shader = frostredGlass.getFragmentShader()
    expect(shader).toContain("void main()")
    expect(shader).toContain("gl_FragColor")
  })

  it("returns default uniforms", () => {
    const uniforms = frostredGlass.getDefaultUniforms()
    expect(uniforms.u_blur).toBe(0.5)
    expect(uniforms.u_tint).toBe(0.5)
  })

  it("returns control descriptors", () => {
    const controls = frostredGlass.getControls()
    expect(controls).toHaveLength(2)
    expect(controls[0].key).toBe("blur")
  })

  it("returns SVG filter", () => {
    const svgFilter = frostredGlass.getSVGFilter?.()
    expect(svgFilter).toBeDefined()
    expect(svgFilter?.id).toBe("frosted-glass-fallback")
    expect(svgFilter?.filter).toContain("feGaussianBlur")
  })
})
