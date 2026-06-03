import { defineConfig, devices } from '@playwright/test'

// E2E suite. See docs/adr/0005-e2e-playwright-mocked-tauri-bridge.md.
//
// We drive the REAL production bundle (vite build --mode e2e -> vite preview) on
// WebKit — the same engine family as the Tauri webview the app ships in. The
// backend (Tauri `invoke` + `fetch`) is faked entirely in the browser by the
// bridge injected in tests/e2e/support/fixtures.ts, so no network/auth/SSO runs.

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    // Determinism: pin timezone + locale so date/week math is identical on any
    // CI runner. The clock itself is frozen per-test in the `app` fixture.
    timezoneId: 'Europe/Amsterdam',
    locale: 'nl-NL',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run build:e2e && npm run preview:e2e',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
