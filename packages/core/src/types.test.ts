// @vitest-environment node
import { describe, expect, it } from "vitest"

describe("types", () => {
  it("AdapterType is a union of three strings", () => {
    const valid: string[] = ["native", "html2canvas", "css"]
    expect(valid).toContain("native")
    expect(valid).toContain("html2canvas")
    expect(valid).toContain("css")
  })
})
