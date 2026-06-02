import { test as base, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildScenario, FROZEN_NOW, type ScenarioOverrides } from '../fixtures/scenario'
import type { E2EScenario } from '../bridge/types'

const dir = path.dirname(fileURLToPath(import.meta.url))
const BRIDGE_PATH = path.join(dir, '..', '.generated', 'fakeBridge.js')

type BootResult = { scenario: E2EScenario }

interface E2EFixtures {
  /**
   * Boot the app with a fully-seeded, logged-in scenario. Freezes the clock,
   * injects the scenario + fake bridge, navigates to '/', and waits until the
   * authenticated week view has rendered (auth is always seeded — see ADR-0005).
   */
  boot: (overrides?: ScenarioOverrides) => Promise<BootResult>
}

export const test = base.extend<E2EFixtures>({
  boot: async ({ page }, use) => {
    await use(async (overrides) => {
      const scenario = buildScenario(overrides)

      // Deterministic Date (real timers keep running, so toasts/debounces work).
      await page.clock.setFixedTime(FROZEN_NOW)

      // Scenario first, then the bridge (init scripts run in insertion order, and
      // the bridge reads window.__E2E_SCENARIO__ at module-eval time).
      await page.addInitScript((s) => {
        ;(window as unknown as { __E2E_SCENARIO__: unknown }).__E2E_SCENARIO__ = s
      }, scenario)
      await page.addInitScript({ path: BRIDGE_PATH })

      await page.goto('/')

      // Seed the authenticated session directly into the store (the app's SSO
      // restore is not wired; auth is always seeded — see ADR-0005). Setting the
      // user cascades through useSimplicateData -> employee lookup -> week load,
      // all served by the fake bridge.
      await page.waitForFunction(() => '__APP_STORE__' in window)
      await page.evaluate((u) => {
        const store = (window as unknown as { __APP_STORE__: { getState: () => { setUser: (x: unknown) => void } } }).__APP_STORE__
        store.getState().setUser({ id: u.sub, name: u.name, email: u.email, googleId: u.sub })
      }, scenario.user)

      // Authenticated shell: the sidebar gear ("Instellingen") only renders once
      // past the LoginPage.
      await expect(page.getByTitle('Instellingen')).toBeVisible({ timeout: 15_000 })

      return { scenario }
    })
  },
})

export { expect }

/** Read back the fake filesystem the app wrote to (e.g. history-store.json). */
export async function readFakeFiles(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => (window as unknown as { __E2E_FILES__: () => Record<string, string> }).__E2E_FILES__())
}
