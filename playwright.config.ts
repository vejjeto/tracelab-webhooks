import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3008",
    headless: true,
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3008/api/health",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
