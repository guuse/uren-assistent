import { test, expect } from './support/fixtures'
import { makeHourEntry, TODAY } from './fixtures/scenario'

// Flow 1: a seeded session boots straight into the week, existing booked hours
// render as blue "geboekt" blocks, and the day header reflects them.
test('boots into the week and shows existing booked hours', async ({ page, boot }) => {
  await boot({
    simplicate: {
      hourEntries: [
        makeHourEntry({ startDate: TODAY, startTime: '09:00', endTime: '11:00', hours: 2, note: 'Sprint planning' }),
      ],
    },
  })

  // We are past the login page.
  await expect(page.getByText('Inloggen met Google')).toHaveCount(0)

  // Legend / booked block for ACME Website is visible on the timeline.
  await expect(page.getByText('geboekt').first()).toBeVisible()
  await expect(page.getByText('ACME Website').first()).toBeVisible()

  // Day header counts the 2 booked hours toward the 8h target.
  await expect(page.getByText(/2u geboekt/)).toBeVisible()
})
