import { describe, it, expect } from 'vitest'
import { computeTimelineBlocks } from './DayTimeline.helpers'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'

function makeEntry(startTime: string, endTime: string): HourEntry {
  return {
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-19',
    startTime,
    endTime,
    note: '',
  }
}

function makeSuggestion(startTime?: string): HourEntrySuggestion {
  return {
    projectId: 'p2',
    projectServiceId: 's2',
    hourTypeId: 'ht2',
    ...(startTime !== undefined && { startTime }),
    reason: 'last-week',
    occurrences: 1,
  }
}

describe('computeTimelineBlocks', () => {
  it('geeft één leeg gat terug als er geen entries zijn', () => {
    const blocks = computeTimelineBlocks([], [], '08:00', '18:00')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('gap')
    expect(blocks[0]!.startTime).toBe('08:00')
    expect(blocks[0]!.endTime).toBe('18:00')
  })

  it('toont entry en gaten eromheen', () => {
    const blocks = computeTimelineBlocks(
      [makeEntry('09:00', '11:00')],
      [],
      '08:00',
      '18:00',
    )
    expect(blocks).toHaveLength(3)
    expect(blocks[0]!.type).toBe('gap')
    expect(blocks[0]!.startTime).toBe('08:00')
    expect(blocks[0]!.endTime).toBe('09:00')
    expect(blocks[1]!.type).toBe('entry')
    expect(blocks[2]!.type).toBe('gap')
    expect(blocks[2]!.startTime).toBe('11:00')
    expect(blocks[2]!.endTime).toBe('18:00')
  })

  it('koppelt suggestie aan gat als startTime van suggestie in het gat valt', () => {
    const blocks = computeTimelineBlocks(
      [makeEntry('09:00', '11:00')],
      [makeSuggestion('14:00')],
      '08:00',
      '18:00',
    )
    const gapAfter = blocks.find((b) => b.type === 'gap' && b.startTime === '11:00')
    expect(gapAfter?.suggestion?.startTime).toBe('14:00')
  })

  it('koppelt eerste suggestie aan eerste gat als geen startTime match', () => {
    const blocks = computeTimelineBlocks(
      [],
      [makeSuggestion(undefined)],
      '08:00',
      '18:00',
    )
    expect(blocks[0]!.suggestion).toBeDefined()
  })

  it('sorteert entries op startTime voor gat-berekening', () => {
    const blocks = computeTimelineBlocks(
      [makeEntry('13:00', '15:00'), makeEntry('09:00', '11:00')],
      [],
      '08:00',
      '18:00',
    )
    expect(blocks[1]!.startTime).toBe('09:00') // eerste entry
    expect(blocks[3]!.startTime).toBe('13:00') // tweede entry
  })
})
