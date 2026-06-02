import { describe, it, expect } from 'vitest'
import { computeTrendPatterns, trendPatternKey } from './computeTrendPatterns'
import type { HourEntry } from '../entities/HourEntry'

const TARGET = '2026-06-01' // Monday

function entry(startDate: string, hours: number, projectId = 'P1', serviceId = 'S1', note = ''): HourEntry {
  return {
    employeeId: 'E1',
    projectId,
    projectServiceId: serviceId,
    hourTypeId: 'H1',
    hours,
    startDate,
    startTime: '09:00',
    endTime: '10:00',
    note,
  }
}

describe('computeTrendPatterns', () => {
  it('flags a combo present in 4 of 4 weeks on the target weekday as strong', () => {
    const entries = [
      entry('2026-05-25', 2),
      entry('2026-05-18', 2),
      entry('2026-05-11', 2),
      entry('2026-05-04', 2),
    ]
    const { byKey } = computeTrendPatterns(entries, TARGET)
    const p = byKey.get(trendPatternKey('P1', 'S1'))!
    expect(p.weeksPresent).toBe(4)
    expect(p.cadenceMatchesTarget).toBe(true)
    expect(p.isStrong).toBe(true)
    expect(p.avgDurationHours).toBe(2)
  })

  it('does not flag a combo present in only 2 weeks as strong', () => {
    const entries = [entry('2026-05-25', 2), entry('2026-05-18', 2)]
    const { byKey } = computeTrendPatterns(entries, TARGET)
    const p = byKey.get(trendPatternKey('P1', 'S1'))!
    expect(p.weeksPresent).toBe(2)
    expect(p.isStrong).toBe(false)
  })

  it('treats near-daily work as cadence-matching even off the target weekday', () => {
    // 3 weeks, ~3 active days each, none on a Monday → strong via near-daily rule.
    const entries = [
      // week 0 (Tue/Wed/Thu before target)
      entry('2026-05-26', 2), entry('2026-05-27', 2), entry('2026-05-28', 2),
      // week 1
      entry('2026-05-19', 2), entry('2026-05-20', 2), entry('2026-05-21', 2),
      // week 2
      entry('2026-05-12', 2), entry('2026-05-13', 2), entry('2026-05-14', 2),
    ]
    const { byKey } = computeTrendPatterns(entries, TARGET)
    const p = byKey.get(trendPatternKey('P1', 'S1'))!
    expect(p.weeksPresent).toBe(3)
    expect(p.daysActive).toBe(9)
    expect(p.cadenceMatchesTarget).toBe(true)
    expect(p.isStrong).toBe(true)
  })

  it("excludes the target day's own entries and anything older than 28 days", () => {
    const entries = [
      entry(TARGET, 5), // today — observed, not a trend
      entry('2026-04-27', 5), // 35 days back — outside window
      entry('2026-05-25', 2), // valid
    ]
    const { byKey } = computeTrendPatterns(entries, TARGET)
    const p = byKey.get(trendPatternKey('P1', 'S1'))!
    expect(p.daysActive).toBe(1)
    expect(p.weeksPresent).toBe(1)
    expect(p.historicalShare).toBe(1)
  })

  it('computes historical share across combos and sorts by it', () => {
    const entries = [
      entry('2026-05-25', 6, 'P1', 'S1'),
      entry('2026-05-25', 2, 'P2', 'S2'),
    ]
    const { patterns } = computeTrendPatterns(entries, TARGET)
    expect(patterns[0]!.projectId).toBe('P1')
    expect(patterns[0]!.historicalShare).toBeCloseTo(0.75)
    expect(patterns[1]!.historicalShare).toBeCloseTo(0.25)
  })

  it('returns nothing for an empty window', () => {
    const { patterns, strong } = computeTrendPatterns([], TARGET)
    expect(patterns).toEqual([])
    expect(strong).toEqual([])
  })
})
