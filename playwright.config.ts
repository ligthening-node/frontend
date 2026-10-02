import { defineConfig, devices } from "@playwright/test";

// Two suites:
// - decoder: needs no node; Playwright builds and starts the app itself. Runs in CI.
// - regtest: drives the real docker compose stack (web on :3000, peer API on :3002, bitcoind on
//   :18443). Opt in with E2E_REGTEST=1 after `docker compose up`.
const regtest = process.env.E2E_REGTEST === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: regtest ? 180_000 : 30_000,
  fullyParallel: !regtest,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "decoder",
      testMatch: /decoder\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:3100" },
    },
    ...(regtest
      ? [{ name: "regtest", testMatch: /regtest\.spec\.ts/, use: { baseURL: "http://127.0.0.1:3000" } }]
      : []),
  ],
  webServer: regtest
    ? undefined
    : {
        // A production build: the dev server compiles pages on first hit, which makes parallel first loads flaky.
        command: "pnpm build && pnpm exec next start --port 3100 --hostname 127.0.0.1",
        url: "http://127.0.0.1:3100/decode",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
