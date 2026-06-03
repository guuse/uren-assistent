import { test, expect } from './support/fixtures'
import { classifiableDay } from './fixtures/scenario'

// Flow 5: booking a classified concept turns it into a blue "geboekt" entry.
test('boeken a concept block books it and it becomes a booked entry', async ({ page, boot }) => {
  await boot(classifiableDay())
  await page.getByTestId('process-day').click()

  const concept = page.getByTestId('concept-block-github.com/acme')
  await expect(concept).toBeVisible({ timeout: 15_000 })
  await concept.click()

  // The classified block opens pre-filled (project/dienst/urensoort set) -> bookable.
  await expect(page.getByTestId('booking-modal')).toBeVisible()
  await page.getByRole('button', { name: 'Opslaan' }).click()

  // On success the modal auto-closes (onBooked refreshes the week). The concept is
  // gone and a blue booked entry now exists in its place.
  await expect(page.getByTestId('concept-block-github.com/acme')).toHaveCount(0)
  await expect(page.locator('[data-testid^="entry-block-"]').first()).toBeVisible()
})

// Flow 5b: a failing booking surfaces the REAL Simplicate error (regression guard
// for the "Boeken mislukt" fix — commit a52b9e3).
test('a failed booking surfaces the real error, not a generic message', async ({ page, boot }) => {
  await boot(classifiableDay({ bookError: 'Simplicate: 422 — project is gesloten' }))
  await page.getByTestId('process-day').click()

  const concept = page.getByTestId('concept-block-github.com/acme')
  await expect(concept).toBeVisible({ timeout: 15_000 })
  await concept.click()
  await page.getByRole('button', { name: 'Opslaan' }).click()

  // The modal stays open and shows the actual backend error.
  await expect(page.getByTestId('booking-modal')).toBeVisible()
  await expect(page.getByText(/project is gesloten/)).toBeVisible()
  await expect(page.getByText('Boeken mislukt')).toHaveCount(0)
})
