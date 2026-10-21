import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Read the Supabase URL and publishable key the same way the app does.
loadEnv({ path: ".env.local" });

// Run against your live site with:  BASE_URL=https://your-app.vercel.app npm test
// With no BASE_URL, Playwright starts `npm run dev` for you on port 3000.
// If you set BASE_URL (even to localhost), you are running the server yourself.
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const autoServer = !process.env.BASE_URL;

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

  webServer: autoServer
    ? {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
});
