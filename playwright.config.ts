import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.ts",
  workers: 1,
  outputDir: "/tmp/zg-pools-mcp-test-results",
  use: {
    baseURL: "http://127.0.0.1:3017",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    locale: "hr-HR",
  },
  webServer: {
    command: "bun run dev --port 3017",
    url: "http://127.0.0.1:3017/calendar",
    reuseExistingServer: false,
    env: {
      OPENAI_API_KEY: "",
      POOLS_API_SECRET: "playwright-only-owner-key",
      DATABASE_URL: process.env.UI_TEST_DATABASE_URL ?? "",
    },
    timeout: 60_000,
  },
});
