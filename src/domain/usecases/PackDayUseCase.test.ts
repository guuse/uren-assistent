import { describe, it, expect } from 'vitest'
import { PackDayUseCase } from './PackDayUseCase'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { HourEntry } from '../entities/HourEntry'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { TrendPattern, TrendPatternsResult } from './computeTrendPatterns'

/** Build a TrendPatternsResult from terse pattern specs for packer tests. */
const makeTrends = (
  specs: { projectId: string; serviceId: string; avg: number; share: number; weeks?: number; strong?: boolean }[],
): TrendPatternsResult => {
  const patterns: TrendPattern[] = specs.map(s => ({
    projectId: s.projectId,
    serviceId: s.serviceId,
    weeksPresent: s.weeks ?? (s.strong ? 4 : 1),
    daysActive: 4,
    avgDurationHours: s.avg,
    historicalShare: s.share,
    cadenceMatchesTarget: s.strong ?? false,
    isStrong: s.strong ?? false,
  }))
  const byKey = new Map(patterns.map(p => [`${p.projectId}__${p.serviceId}`, p]))
  const strong = patterns.filter(p => p.isStrong)
  return { patterns, byKey, strong }
}

const makeBlock = (overrides: Partial<ClassifiedBlock> = {}): ClassifiedBlock => ({
  date: '2024-01-15',
  urlPattern: 'example.com',
  urls: ['https://example.com'],
  titles: ['Example'],
  visitCount: 3,
  firstVisitTime: '11:13',
  lastVisitTime: '12:47',
  hours: 1,
  blockName: 'Example work',
  summary: 'did stuff',
  startTime: '11:13',
  endTime: '12:47',
  projectId: 'proj-1',
  serviceId: 'svc-1',
  note: 'note',
  confidence: 4,
  origin: 'llm',
  ...overrides,
})

const makeMeeting = (start: string, end: string, overrides: Partial<ClassifiedBlock> = {}): ClassifiedBlock => {
  const ev: CalendarEvent = {
    id: 'evt',
    title: 'Meeting',
    start: new Date(`2024-01-15T${start}:00`),
    end: new Date(`2024-01-15T${end}:00`),
    attendees: [],
    status: 'accepted',
  }
  return makeBlock({
    startTime: start,
    endTime: end,
    firstVisitTime: start,
    lastVisitTime: end,
    overlappingMeetings: [ev],
    blockName: 'Meeting block',
    ...overrides,
  })
}

const makeCandidate = (confidence: 1 | 2 | 3 | 4 | 5, hours: number, overrides: Partial<ClassifiedBlock> = {}): ClassifiedBlock =>
  makeBlock({
    urlPattern: `llm-pattern:${overrides.blockName ?? confidence + '-' + hours}`,
    origin: 'llm-pattern',
    startTime: '00:00',
    endTime: '00:00',
    firstVisitTime: '00:00',
    lastVisitTime: '00:00',
    hours,
    confidence,
    ...overrides,
  })

const makeEntry = (startTime: string, endTime: string, hours: number, overrides: Partial<HourEntry> = {}): HourEntry => ({
  employeeId: 'emp-1',
  projectId: 'proj-1',
  projectServiceId: 'svc-1',
  hourTypeId: 'ht-1',
  hours,
  startDate: '2024-01-15',
  startTime,
  endTime,
  note: '',
  ...overrides,
})

const minutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h! * 60 + m!
}

describe('PackDayUseCase', () => {
  it('repacks movable blocks contiguously from 09:00 with no gaps', () => {
    const blocks = [
      makeBlock({ urlPattern: 'a', blockName: 'A', startTime: '14:00', endTime: '15:00', hours: 1 }),
      makeBlock({ urlPattern: 'b', blockName: 'B', startTime: '09:30', endTime: '10:00', hours: 0.5 }),
    ]
    const result = new PackDayUseCase().execute(blocks, [], { targetHours: 1.5 })

    // chronological order preserved: B started earlier than A originally
    expect(result.map(r => r.blockName)).toEqual(['B', 'A'])
    expect(result[0]!.startTime).toBe('09:00')
    expect(result[0]!.endTime).toBe('09:30')
    expect(result[1]!.startTime).toBe('09:30')
    expect(result[1]!.endTime).toBe('10:30')
  })

  it('repacks meeting blocks contiguously too (meetings are not fixed)', () => {
    const work = makeBlock({ blockName: 'Work', hours: 1, startTime: '08:00', endTime: '09:00' })
    const meeting = makeMeeting('09:30', '10:00', { blockName: 'Standup', hours: 0.5 })
    const result = new PackDayUseCase().execute([work, meeting], [], { targetHours: 1.5 })

    const byName = Object.fromEntries(result.map(r => [r.blockName, r]))
    // Earlier original start wins order: Work (08:00) then Standup (09:30), packed from 09:00.
    expect(byName['Work']!.startTime).toBe('09:00')
    expect(byName['Work']!.endTime).toBe('10:00')
    expect(byName['Standup']!.startTime).toBe('10:00')
    expect(byName['Standup']!.endTime).toBe('10:30')
  })

  it('moves a meeting block that overlaps a booked entry to after it', () => {
    const entry = makeEntry('09:00', '11:00', 2, { projectId: 'other', projectServiceId: 'other' })
    const meeting = makeMeeting('09:30', '10:00', { blockName: 'Overleg', hours: 0.5 })
    const result = new PackDayUseCase().execute([meeting], [entry], { targetHours: 8 })

    const m = result.find(r => r.blockName === 'Overleg')!
    expect(minutes(m.startTime)).toBeGreaterThanOrEqual(minutes('11:00'))
  })

  it('never overlaps an existing booked entry', () => {
    const entry = makeEntry('09:00', '10:00', 1, { projectId: 'other', projectServiceId: 'other-svc' })
    const work = makeBlock({ blockName: 'Work', hours: 1 })
    const result = new PackDayUseCase().execute([work], [entry], { targetHours: 2 })

    const w = result.find(r => r.blockName === 'Work')!
    expect(minutes(w.startTime)).toBeGreaterThanOrEqual(minutes('10:00'))
  })

  it('drops a concept that duplicates an existing entry (same project+service, overlapping time)', () => {
    const entry = makeEntry('10:00', '11:00', 1) // proj-1 / svc-1
    const dup = makeMeeting('10:00', '11:00', { blockName: 'ISO GAP overleg', projectId: 'proj-1', serviceId: 'svc-1' })
    const result = new PackDayUseCase().execute([dup], [entry], { targetHours: 1 })

    expect(result.find(r => r.blockName === 'ISO GAP overleg')).toBeUndefined()
  })

  it('does not return existing entries as blocks (only concepts)', () => {
    const entry = makeEntry('09:00', '10:00', 1, { projectId: 'other', projectServiceId: 'other' })
    const result = new PackDayUseCase().execute([], [entry], { targetHours: 1 })
    expect(result).toEqual([])
  })

  it('grows an observed block toward its historical average to fill the day', () => {
    const observed = makeBlock({ blockName: 'Observed', hours: 1 }) // proj-1/svc-1, 1h real work
    const trends = makeTrends([{ projectId: 'proj-1', serviceId: 'svc-1', avg: 8, share: 1 }])
    const result = new PackDayUseCase().execute([observed], [], { targetHours: 8, trends })

    const o = result.find(r => r.blockName === 'Observed')!
    expect(o.hours).toBe(8) // grown from 1h up to its historical average
    expect(result.reduce((s, r) => s + r.hours, 0)).toBe(8)
  })

  it('caps growth at the historical average, then fills the rest with a strong pattern', () => {
    const observed = makeBlock({ blockName: 'Observed', hours: 1 }) // proj-1/svc-1
    const fill = makeCandidate(1, 99, { blockName: 'Recurring', projectId: 'p2', serviceId: 's2' })
    const trends = makeTrends([
      { projectId: 'proj-1', serviceId: 'svc-1', avg: 3, share: 0.5 }, // room to grow: 2h
      { projectId: 'p2', serviceId: 's2', avg: 5, share: 0.5, strong: true },
    ])
    const result = new PackDayUseCase().execute([observed, fill], [], { targetHours: 8, trends })

    const byName = Object.fromEntries(result.map(r => [r.blockName, r]))
    expect(byName['Observed']!.hours).toBe(3)   // grown 1h → 3h (capped at avg), not further
    expect(byName['Recurring']!.hours).toBe(5)  // strong-pattern fill sized at its avg
    expect(result.reduce((s, r) => s + r.hours, 0)).toBe(8)
  })

  it('never grows or fills once real work already meets the target (floor, not ceiling)', () => {
    const observed = makeBlock({ blockName: 'Observed', hours: 4 })
    const fill = makeCandidate(5, 2, { blockName: 'Recurring', projectId: 'p2', serviceId: 's2' })
    const trends = makeTrends([
      { projectId: 'proj-1', serviceId: 'svc-1', avg: 10, share: 0.5 },
      { projectId: 'p2', serviceId: 's2', avg: 2, share: 0.5, strong: true },
    ])
    const result = new PackDayUseCase().execute([observed, fill], [], { targetHours: 4, trends })

    expect(result.find(r => r.blockName === 'Observed')!.hours).toBe(4) // not grown past target
    expect(result.find(r => r.blockName === 'Recurring')).toBeUndefined()
    expect(result.reduce((s, r) => s + r.hours, 0)).toBe(4)
  })

  it('distributes growth across blocks proportional to historical share', () => {
    const a = makeBlock({ blockName: 'A', hours: 1, projectId: 'proj-1', serviceId: 'svc-1' })
    const b = makeBlock({ blockName: 'B', hours: 1, projectId: 'p2', serviceId: 's2' })
    const trends = makeTrends([
      { projectId: 'proj-1', serviceId: 'svc-1', avg: 99, share: 0.75 },
      { projectId: 'p2', serviceId: 's2', avg: 99, share: 0.25 },
    ])
    // gap = 8 - (1 + 1) = 6 → split 0.75/0.25 → A +4.5 (→5.5), B +1.5 (→2.5)
    const result = new PackDayUseCase().execute([a, b], [], { targetHours: 8, trends })
    const byName = Object.fromEntries(result.map(r => [r.blockName, r]))
    expect(byName['A']!.hours).toBeCloseTo(5.5)
    expect(byName['B']!.hours).toBeCloseTo(2.5)
    expect(result.reduce((s, r) => s + r.hours, 0)).toBeCloseTo(8)
  })

  it('never grows a meeting block beyond its calendar duration', () => {
    const meeting = makeMeeting('10:00', '11:00', { blockName: 'Mtg', hours: 1, projectId: 'proj-1', serviceId: 'svc-1' })
    const trends = makeTrends([{ projectId: 'proj-1', serviceId: 'svc-1', avg: 8, share: 1 }])
    const result = new PackDayUseCase().execute([meeting], [], { targetHours: 8, trends })
    expect(result.find(r => r.blockName === 'Mtg')!.hours).toBe(1)
  })

  it('does not fill from a weak (non-strong) pattern even when the day is short', () => {
    const observed = makeBlock({ blockName: 'Observed', hours: 1 })
    const weak = makeCandidate(2, 4, { blockName: 'Weak', projectId: 'p2', serviceId: 's2' })
    const trends = makeTrends([
      // observed combo absent from trends → no growth; weak pattern is not strong → no fill
      { projectId: 'p2', serviceId: 's2', avg: 4, share: 1, strong: false },
    ])
    const result = new PackDayUseCase().execute([observed, weak], [], { targetHours: 8, trends })

    expect(result.find(r => r.blockName === 'Weak')).toBeUndefined()
    expect(result.find(r => r.blockName === 'Observed')!.hours).toBe(1) // no trend → not grown
  })

  it('keeps all real work even when it exceeds the target (floor, not ceiling)', () => {
    const a = makeBlock({ blockName: 'A', hours: 5 })
    const b = makeBlock({ blockName: 'B', hours: 5, projectId: 'p2', serviceId: 's2' })
    const result = new PackDayUseCase().execute([a, b], [], { targetHours: 8 })

    const total = result.reduce((s, r) => s + r.hours, 0)
    expect(total).toBe(10)
  })

  it('does not fill a strong pattern whose project+service is already booked today', () => {
    const entry = makeEntry('09:00', '10:00', 1) // proj-1 / svc-1
    const candidate = makeCandidate(3, 2, { blockName: 'Dup pattern', projectId: 'proj-1', serviceId: 'svc-1' })
    const trends = makeTrends([{ projectId: 'proj-1', serviceId: 'svc-1', avg: 2, share: 1, strong: true }])
    const result = new PackDayUseCase().execute([candidate], [entry], { targetHours: 8, trends })

    expect(result.find(r => r.blockName === 'Dup pattern')).toBeUndefined()
  })

  it('does not treat a concept without project/service as a duplicate', () => {
    // proj/svc undefined → isTimedConceptDuplicate short-circuits to false (line 96 branch).
    const entry = makeEntry('10:00', '11:00', 1) // proj-1 / svc-1
    const scoped = makeBlock({ blockName: 'Unscoped', hours: 1, startTime: '10:00', endTime: '11:00' })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit project/service via rest
    const { projectId: _pid, serviceId: _sid, ...unscoped } = scoped
    const result = new PackDayUseCase().execute([unscoped], [entry], { targetHours: 8 })
    expect(result.find(r => r.blockName === 'Unscoped')).toBeDefined()
  })

  it('flows a concept past a mid-morning booked entry (cursor bumped to interval end)', () => {
    // dayStart 09:00 but a booked entry occupies 09:00-12:00, so the first concept
    // must bump its cursor to 12:00 (nextFreeStart line 53).
    const entry = makeEntry('09:00', '12:00', 3, { projectId: 'other', projectServiceId: 'other' })
    const work = makeBlock({ blockName: 'After', hours: 1, startTime: '09:30', endTime: '10:30' })
    const result = new PackDayUseCase().execute([work], [entry], { targetHours: 8 })
    const w = result.find(r => r.blockName === 'After')!
    expect(w.startTime).toBe('12:00')
    expect(w.endTime).toBe('13:00')
  })

  it('output is sorted by startTime ascending', () => {
    const meeting = makeMeeting('11:00', '12:00', { blockName: 'Mtg' })
    const work = makeBlock({ blockName: 'Work', hours: 1 })
    const result = new PackDayUseCase().execute([meeting, work], [], { targetHours: 2 })
    const starts = result.map(r => minutes(r.startTime))
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
  })
})
