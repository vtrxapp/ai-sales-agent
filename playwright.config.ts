import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "node:fs"

// This sandbox pre-installs Chromium outside Playwright's normal cache and
// blocks the download step, so point at it explicitly when present. A
// contributor's machine or CI runner won't have this path - Playwright
// falls back to its own normal browser resolution there.
const sandboxChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
})
