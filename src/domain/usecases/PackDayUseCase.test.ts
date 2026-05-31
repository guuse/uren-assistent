import { describe, it, expect } from 'vitest'
import { PackDayUseCase } from './PackDayUseCase'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { HourEntry } from '../entities/HourEntry'
import type { CalendarEvent } from '../entities/CalendarEvent'

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

  it('counts existing hours toward the 8h target so filler stops early', () => {
    const entry = makeEntry('09:00', '16:30', 7.5, { projectId: 'other', projectServiceId: 'other' })
    const filler = makeCandidate(1, 2, { blockName: 'Filler' })
    const result = new PackDayUseCase().execute([filler], [entry], { targetHours: 8 })

    const f = result.find(r => r.blockName === 'Filler')!
    expect(f).toBeDefined()
    // only 0.5h remained to reach 8h, so filler is trimmed to 0.5h
    expect(f.hours).toBe(0.5)
  })

  it('fills with candidates highest-confidence first, trimming the last to land on target', () => {
    const observed = makeBlock({ blockName: 'Observed', hours: 1 }) // 1h real work
    const genuine = makeCandidate(3, 2, { blockName: 'Genuine', projectId: 'p2', serviceId: 's2' })
    const filler = makeCandidate(1, 4, { blockName: 'Filler', projectId: 'p3', serviceId: 's3' })
    const result = new PackDayUseCase().execute([observed, genuine, filler], [], { targetHours: 4 })

    const byName = Object.fromEntries(result.map(r => [r.blockName, r]))
    expect(byName['Observed']).toBeDefined()
    expect(byName['Genuine']!.hours).toBe(2)   // conf 3 placed first
    // 1 + 2 = 3h booked, 1h short of 4h target → conf 1 filler trimmed to 1h
    expect(byName['Filler']!.hours).toBe(1)
    expect(result.reduce((s, r) => s + r.hours, 0)).toBe(4)
  })

  it('never adds a fill candidate once the target is met by real work, regardless of confidence', () => {
    const observed = makeBlock({ blockName: 'Observed', hours: 4 })
    const hiConf = makeCandidate(5, 2, { blockName: 'HiConf', projectId: 'p2', serviceId: 's2' })
    const filler = makeCandidate(1, 2, { blockName: 'Filler', projectId: 'p3', serviceId: 's3' })
    const result = new PackDayUseCase().execute([observed, hiConf, filler], [], { targetHours: 4 })

    expect(result.find(r => r.blockName === 'HiConf')).toBeUndefined()
    expect(result.find(r => r.blockName === 'Filler')).toBeUndefined()
    expect(result.reduce((s, r) => s + r.hours, 0)).toBe(4)
  })

  it('keeps all real work even when it exceeds the target (floor, not ceiling)', () => {
    const a = makeBlock({ blockName: 'A', hours: 5 })
    const b = makeBlock({ blockName: 'B', hours: 5, projectId: 'p2', serviceId: 's2' })
    const result = new PackDayUseCase().execute([a, b], [], { targetHours: 8 })

    const total = result.reduce((s, r) => s + r.hours, 0)
    expect(total).toBe(10)
  })

  it('drops a fill candidate whose project+service is already booked today', () => {
    const entry = makeEntry('09:00', '10:00', 1) // proj-1 / svc-1
    const candidate = makeCandidate(3, 2, { blockName: 'Dup pattern', projectId: 'proj-1', serviceId: 'svc-1' })
    const result = new PackDayUseCase().execute([candidate], [entry], { targetHours: 8 })

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
