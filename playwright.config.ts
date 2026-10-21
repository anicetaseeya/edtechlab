import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Read the Supabase URL and publishable key the same way the app does.
loadEnv({ path: ".env.local" });

// Run against your live site with:  BASE_URL=https://your-app.vercel.app npm test
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const isLocal = BASE_URL.includes("localhost");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: isLocal
    ? {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
});
