import { test, expect } from './support/fixtures'
import { classifiableDay } from './fixtures/scenario'

// Flow 4: deleting a concept straight from the timeline removes it (no modal).
test('delete a concept block from the timeline', async ({ page, boot }) => {
  await boot(classifiableDay())
  await page.getByTestId('process-day').click()

  const concept = page.getByTestId('concept-block-github.com/acme')
  await expect(concept).toBeVisible({ timeout: 15_000 })

  // The ✕ is hover-revealed (opacity); force the click.
  await concept.hover()
  await page.getByTestId('concept-delete-github.com/acme').click({ force: true })

  await expect(page.getByTestId('concept-block-github.com/acme')).toHaveCount(0)
})

// Flow 4b: opening a concept and changing its time, then saving, books the edit.
test('change a concept time via the booking modal', async ({ page, boot }) => {
  await boot(classifiableDay())
  await page.getByTestId('process-day').click()

  const concept = page.getByTestId('concept-block-github.com/acme')
  await expect(concept).toBeVisible({ timeout: 15_000 })
  await concept.click()

  const modal = page.getByTestId('booking-modal')
  await expect(modal).toBeVisible()

  // "Van" / "Tot" are native selects; change the end time then save.
  const selects = modal.getByRole('combobox')
  await selects.last().selectOption('13:00')
  await page.getByRole('button', { name: 'Opslaan' }).click()

  // Saved: the modal closes and the block is now booked (concept replaced by entry).
  await expect(page.getByTestId('booking-modal')).toHaveCount(0)
  await expect(page.locator('[data-testid^="entry-block-"]').first()).toBeVisible()
})
