// @vitest-environment node
import { describe, expect, it } from "vitest"
import { liquidGlass } from "./liquid-glass"

describe("liquidGlass plugin", () => {
  it("has correct id", () => {
    expect(liquidGlass.id).toBe("liquid-glass")
  })

  it("returns a fragment shader string", () => {
    const shader = liquidGlass.getFragmentShader()
    expect(shader).toContain("void main()")
    expect(shader).toContain("gl_FragColor")
    expect(shader).toContain("roundedRectSDF")
    expect(shader).toContain("u_fresnel")
    expect(shader).toContain("u_chromatic")
  })

  it("returns default uniforms", () => {
    const uniforms = liquidGlass.getDefaultUniforms()
    expect(uniforms.u_refraction).toBe(0.6)
    expect(uniforms.u_blur).toBe(0.3)
    expect(uniforms.u_chromatic).toBe(0.04)
    expect(uniforms.u_edgeHighlight).toBe(0.08)
    expect(uniforms.u_specular).toBe(0.15)
    expect(uniforms.u_fresnel).toBe(1.0)
  })

  it("returns control descriptors", () => {
    const controls = liquidGlass.getControls()
    expect(controls).toHaveLength(6)
    expect(controls[0].key).toBe("refraction")
    expect(controls[0].type).toBe("slider")
    expect(controls.some((c) => c.key === "specular")).toBe(true)
    expect(controls.some((c) => c.key === "fresnel")).toBe(true)
  })

  it("returns SVG filter", () => {
    const svgFilter = liquidGlass.getSVGFilter?.()
    expect(svgFilter).toBeDefined()
    expect(svgFilter?.id).toBe("liquid-glass-fallback")
    expect(svgFilter?.filter).toContain("feTurbulence")
    expect(svgFilter?.filter).toContain("feDisplacementMap")
  })

  it("updateUniforms does not throw", () => {
    // Test with minimal mock
    const gl = {
      getUniformLocation: () => null,
    } as any
    liquidGlass.updateUniforms?.(gl, {} as any, { u_refraction: 0.5 }, 0, {
      x: 0.5,
      y: 0.5,
      hovering: true,
    })
  })
})
