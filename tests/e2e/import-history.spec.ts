import { test, expect } from './support/fixtures'

// Flow 10: with no imported history, processing a day warns first.
test('verwerk with no history shows the no-history warning', async ({ page, boot }) => {
  await boot() // default scenario has no history-store.json

  await page.getByTestId('process-day').click()

  await expect(page.getByText('Geen browsergeschiedenis beschikbaar')).toBeVisible()

  // Proceed anyway: the modal closes (no items -> nothing classified, no crash).
  await page.getByRole('button', { name: 'Toch verwerken' }).click()
  await expect(page.getByText('Geen browsergeschiedenis beschikbaar')).toHaveCount(0)
})
