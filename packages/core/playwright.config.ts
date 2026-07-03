import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "node e2e/server.js",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
