import { test, expect } from './support/fixtures'
import { makeHourEntry, TODAY, DATES } from './fixtures/scenario'

// Flow 7: submitting the week locks it.
test('indienen submits the week and locks it', async ({ page, boot }) => {
  await boot({
    simplicate: { hourEntries: [makeHourEntry({ startDate: TODAY, hours: 8, startTime: '09:00', endTime: '17:00' })] },
  })

  await page.getByTestId('submit-week').click()
  await page.getByRole('button', { name: 'Indienen' }).click()

  await expect(page.getByTestId('week-submitted-badge')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('day-readonly-badge')).toBeVisible()
})

// Flow 7b: an already-submitted week loads read-only (no Verwerk dag, locked badge).
test('a submitted week is read-only on load', async ({ page, boot }) => {
  await boot({
    simplicate: {
      hourEntries: [makeHourEntry({ startDate: TODAY, hours: 8, startTime: '09:00', endTime: '17:00' })],
      submissions: Object.values(DATES).map((date) => ({ date, status: 'submitted' })),
    },
  })

  await expect(page.getByTestId('week-submitted-badge')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('day-readonly-badge')).toBeVisible()
  await expect(page.getByTestId('process-day')).toHaveCount(0)
})
