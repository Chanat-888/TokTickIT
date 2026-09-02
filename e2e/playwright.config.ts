import { defineConfig, devices } from "@playwright/test";

// tests.md §1/§5.4 — E2E and Responsive specs live under e2e/lab-02/, run
// via `cd e2e && npx playwright test`, a sibling directory to client/ and
// server/, not nested inside either.
export default defineConfig({
  testDir: "./lab-02",
  // Runs once, before either webServer boots (Playwright always runs
  // globalSetup first), truncating and reseeding the dev DB so every run
  // starts from the same 25/5/0 ticket split instead of an ever-growing DB.
  globalSetup: "./global-setup.ts",
  // Both spec files exercise the same seeded dev DB (attachment add/remove,
  // Requester switching) — running them concurrently would race on shared
  // state, so this suite runs single-worker rather than parallelized.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Both dev servers are started and torn down automatically by Playwright
  // for `npx playwright test`, and reused locally (reuseExistingServer) so a
  // developer can also run them manually while iterating.
  webServer: [
    {
      command: "npm run dev",
      cwd: "../server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      cwd: "../client",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
