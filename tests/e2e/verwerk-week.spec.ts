import { test, expect } from './support/fixtures'
import {
  makeHourEntry,
  makeHistoryBlock,
  historyStoreFile,
  classifyDayResponse,
  TODAY,
  DATES,
  IDS,
} from './fixtures/scenario'

// Flow 3: processing the whole week classifies every day that has history.
test('verwerk week produces concept blocks across days', async ({ page, boot }) => {
  await boot({
    simplicate: {
      hourEntries: [
        makeHourEntry({ startDate: '2026-05-26', note: 'vorige week' }),
        makeHourEntry({ startDate: '2026-05-19', note: 'week ervoor' }),
      ],
    },
    files: historyStoreFile({
      [TODAY]: [makeHistoryBlock({ urlPattern: 'github.com/acme', date: TODAY })],
      [DATES.wed]: [makeHistoryBlock({ urlPattern: 'github.com/acme', date: DATES.wed })],
    }),
    // The same canned classification applies to each day's classify call (index 0).
    gemini: classifyDayResponse([
      {
        index: 0,
        blockName: 'ACME Website werk',
        projectId: IDS.project,
        serviceId: IDS.service,
        hourTypeId: IDS.hourType,
        confidence: 4,
      },
    ]),
  })

  await page.getByTestId('process-week').click()

  // Selected day (Tuesday) gets its concept.
  await expect(page.getByTestId('concept-block-github.com/acme')).toBeVisible({ timeout: 20_000 })

  // Switch to Wednesday — it was classified too.
  await page.getByTestId(`day-row-${DATES.wed}`).click()
  await expect(page.getByTestId('concept-block-github.com/acme')).toBeVisible({ timeout: 10_000 })
})
