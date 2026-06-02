import { test, expect } from './support/fixtures'

// Flow 9: the settings page shows the account/config sections and returns to the week.
test('open settings, see the sections, toggle a favourite, go back', async ({ page, boot }) => {
  await boot()

  await page.getByTitle('Instellingen').click()

  await expect(page.getByText('Profiel & toegang')).toBeVisible()
  await expect(page.getByText('Simplicate API')).toBeVisible()
  await expect(page.getByText('Tokens')).toBeVisible()
  await expect(page.getByText('Favoriete projecten')).toBeVisible()
  await expect(page.getByText('guus.e2e@harborn.test')).toBeVisible()

  // Toggle the ACME project as a favourite (persists via the fake FS).
  await page.getByRole('button', { name: /ACME Website/ }).first().click()

  await page.getByRole('button', { name: '← Terug' }).click()
  // Back on the week view: the day timeline / sidebar is visible again.
  await expect(page.getByTitle('Instellingen')).toBeVisible()
})
