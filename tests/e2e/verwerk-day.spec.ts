import { test, expect } from './support/fixtures'
import {
  makeHourEntry,
  makeHistoryBlock,
  historyStoreFile,
  classifyDayResponse,
  TODAY,
  IDS,
} from './fixtures/scenario'

// Flow 2: classifying a day turns imported browser history into a green concept
// block on the timeline (real packer runs; only Gemini is faked).
test('verwerk dag produces a green concept block from imported history', async ({ page, boot }) => {
  await boot({
    simplicate: {
      // Prior-week bookings make ACME an "active" project (sparse -> no trend fill).
      hourEntries: [
        makeHourEntry({ startDate: '2026-05-26', note: 'vorige week' }),
        makeHourEntry({ startDate: '2026-05-19', note: 'week ervoor' }),
      ],
    },
    files: historyStoreFile({
      [TODAY]: [makeHistoryBlock({ urlPattern: 'github.com/acme', firstVisitTime: '10:00', lastVisitTime: '11:30', hours: 1.5 })],
    }),
    gemini: classifyDayResponse([
      {
        index: 0,
        blockName: 'ACME Website werk',
        summary: 'PR review',
        projectId: IDS.project,
        serviceId: IDS.service,
        hourTypeId: IDS.hourType,
        note: 'PR #1 review',
        confidence: 4,
      },
    ]),
  })

  // Nothing green before processing.
  await expect(page.getByTestId('concept-block-github.com/acme')).toHaveCount(0)

  await page.getByTestId('process-day').click()

  // After classification + packing, the concept block is on the timeline.
  const concept = page.getByTestId('concept-block-github.com/acme')
  await expect(concept).toBeVisible({ timeout: 15_000 })
  await expect(concept).toContainText('ACME Website werk')
})
