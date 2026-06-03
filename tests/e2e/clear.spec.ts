import { test, expect } from './support/fixtures'
import { classifiableDay, TODAY } from './fixtures/scenario'

// Flow 8: clearing a day removes its LLM (concept) blocks.
test('clear day removes the concept blocks for that day', async ({ page, boot }) => {
  await boot(classifiableDay())
  await page.getByTestId('process-day').click()
  await expect(page.getByTestId('concept-block-github.com/acme')).toBeVisible({ timeout: 15_000 })

  // The per-day trash button appears once there are LLM blocks.
  await page.getByTestId(`day-clear-${TODAY}`).click()
  await page.getByRole('button', { name: 'Wissen' }).click()

  await expect(page.getByTestId('concept-block-github.com/acme')).toHaveCount(0)
})

// Flow 8b: clearing the whole week removes all concept blocks.
test('clear week removes all concept blocks', async ({ page, boot }) => {
  await boot(classifiableDay())
  await page.getByTestId('process-day').click()
  await expect(page.getByTestId('concept-block-github.com/acme')).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('clear-week').click()
  await page.getByRole('button', { name: 'Wissen' }).click()

  await expect(page.getByTestId('concept-block-github.com/acme')).toHaveCount(0)
})
