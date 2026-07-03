import { defineConfig } from "tsup"

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ["vue", "@liquid-canvas/core"],
})
