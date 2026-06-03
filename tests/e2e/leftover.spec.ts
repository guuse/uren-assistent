import { test, expect } from './support/fixtures'
import { makeLeftoverBlock, historyStoreFile, TODAY } from './fixtures/scenario'

async function ensureLeftoverVisible(page: import('@playwright/test').Page, urlPattern: string) {
  const expand = page.getByTitle('Niet-geplaatste blokken tonen')
  if (await expand.isVisible().catch(() => false)) await expand.click()
  await expect(page.getByTestId(`leftover-${urlPattern}`)).toBeVisible({ timeout: 10_000 })
}

// Flow 6: a leftover (unplaced) block appears in the sidebar and can be dismissed.
test('dismiss a leftover from the sidebar', async ({ page, boot }) => {
  await boot({ files: historyStoreFile({ [TODAY]: [makeLeftoverBlock({ urlPattern: 'leftover.acme' })] }) })

  await ensureLeftoverVisible(page, 'leftover.acme')
  await page.getByTestId('leftover-leftover.acme').hover()
  await page.getByTestId('leftover-dismiss-leftover.acme').click({ force: true })

  await expect(page.getByTestId('leftover-leftover.acme')).toHaveCount(0)
})

// Flow 6b: booking a leftover directly routes through the modal and books it.
test('book a leftover directly', async ({ page, boot }) => {
  await boot({ files: historyStoreFile({ [TODAY]: [makeLeftoverBlock({ urlPattern: 'leftover.acme' })] }) })

  await ensureLeftoverVisible(page, 'leftover.acme')
  await page.getByTestId('leftover-leftover.acme').hover()
  await page.getByTestId('leftover-book-leftover.acme').click({ force: true })

  await expect(page.getByTestId('booking-modal')).toBeVisible()
  await page.getByRole('button', { name: 'Opslaan' }).click()

  // Booked: modal closes and the leftover is removed from the sidebar.
  await expect(page.getByTestId('booking-modal')).toHaveCount(0)
  await expect(page.getByTestId('leftover-leftover.acme')).toHaveCount(0)
})
