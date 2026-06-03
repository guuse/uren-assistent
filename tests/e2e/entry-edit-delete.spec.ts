import { test, expect } from './support/fixtures'
import { makeHourEntry, TODAY } from './fixtures/scenario'

// Flow 11: editing an existing booked entry's note and saving updates it.
test('edit an existing hour entry', async ({ page, boot }) => {
  await boot({ simplicate: { hourEntries: [makeHourEntry({ id: 'entry-1', startDate: TODAY })] } })

  await page.getByTestId('entry-block-entry-1').click()
  await expect(page.getByTestId('booking-modal')).toBeVisible()

  await page.getByPlaceholder('Optioneel').fill('Bijgewerkte toelichting')
  await page.getByRole('button', { name: 'Opslaan' }).click()

  // Saved: modal auto-closes; the entry persists with its updated note.
  await expect(page.getByTestId('booking-modal')).toHaveCount(0)
  await expect(page.getByTestId('entry-block-entry-1')).toBeVisible()
})

// Flow 11b: deleting an existing entry (two-step confirm) removes it.
test('delete an existing hour entry', async ({ page, boot }) => {
  await boot({ simplicate: { hourEntries: [makeHourEntry({ id: 'entry-1', startDate: TODAY })] } })

  await page.getByTestId('entry-block-entry-1').click()
  await expect(page.getByTestId('booking-modal')).toBeVisible()

  await page.getByRole('button', { name: 'Verwijderen' }).click()
  await page.getByRole('button', { name: 'Zeker weten?' }).click()

  // Deleted: modal auto-closes and the entry is gone after the week refresh.
  await expect(page.getByTestId('booking-modal')).toHaveCount(0)
  await expect(page.getByTestId('entry-block-entry-1')).toHaveCount(0)
})
