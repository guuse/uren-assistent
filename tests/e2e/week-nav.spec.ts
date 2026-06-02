import { test, expect } from './support/fixtures'

// Flow 12: navigating away from the current week and back.
test('navigate to the previous week and back to today', async ({ page, boot }) => {
  await boot()

  // "Naar vandaag" only shows when not on the current week.
  await expect(page.getByRole('button', { name: 'Naar vandaag' })).toHaveCount(0)

  await page.getByTitle('Vorige week').click()
  await expect(page.getByRole('button', { name: 'Naar vandaag' })).toBeVisible()

  await page.getByRole('button', { name: 'Naar vandaag' }).click()
  await expect(page.getByRole('button', { name: 'Naar vandaag' })).toHaveCount(0)
})

// Flow 12b: the month picker jumps to a chosen day.
test('pick a day from the month picker', async ({ page, boot }) => {
  await boot()

  await page.getByTitle('Kies datum').click()
  await page.getByTestId('picker-day-2026-06-04').click()

  // The chosen day's row is now selected (left accent border via testid presence).
  await expect(page.getByTestId('day-row-2026-06-04')).toBeVisible()
})

// Flow 12c: a failing token test surfaces the connection banner.
test('connection banner appears when a token test fails', async ({ page, boot }) => {
  await boot({ tokenTests: { github: 'fail' } })

  await expect(page.getByText(/Verbinding mislukt voor/)).toBeVisible({ timeout: 15_000 })
})
