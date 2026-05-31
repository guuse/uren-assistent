import { describe, it, expect } from 'vitest'
import { isDateSubmitted } from './HourSubmission'
import type { HourSubmission } from './HourSubmission'

const week: HourSubmission[] = [
  { startDate: '2026-05-25', endDate: '2026-05-29' }, // ma–vr week 22
]

describe('isDateSubmitted', () => {
  it('is true for the first day of a submitted range', () => {
    expect(isDateSubmitted('2026-05-25', week)).toBe(true)
  })

  it('is true for a day inside the range', () => {
    expect(isDateSubmitted('2026-05-27', week)).toBe(true)
  })

  it('is true for the last day of the range', () => {
    expect(isDateSubmitted('2026-05-29', week)).toBe(true)
  })

  it('is false for a day before the range', () => {
    expect(isDateSubmitted('2026-05-24', week)).toBe(false)
  })

  it('is false for a day after the range', () => {
    expect(isDateSubmitted('2026-05-30', week)).toBe(false)
  })

  it('is false when there are no submissions', () => {
    expect(isDateSubmitted('2026-05-27', [])).toBe(false)
  })

  it('matches across multiple submitted ranges', () => {
    const submissions: HourSubmission[] = [
      { startDate: '2026-05-18', endDate: '2026-05-22' },
      { startDate: '2026-06-01', endDate: '2026-06-05' },
    ]
    expect(isDateSubmitted('2026-06-03', submissions)).toBe(true)
    expect(isDateSubmitted('2026-05-27', submissions)).toBe(false)
  })
})
