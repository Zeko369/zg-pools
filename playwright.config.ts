import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3017",
    viewport: { width: 1440, height: 1000 },
    headless: true,
  },
  webServer: {
    command: "bun run dev --port 3017",
    url: "http://127.0.0.1:3017/calendar",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
