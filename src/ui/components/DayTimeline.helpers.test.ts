import { describe, it, expect } from 'vitest'
import { computeTimelineBlocks, mergeConceptsIntoTimeline, buildTimelineRows, assignBlockColumns } from './DayTimeline.helpers'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

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

  it('valt terug op suggestie zonder startTime als geen suggestie in het gat valt', () => {
    // Entry creates a gap before (08:00–09:00) and after (11:00–18:00).
    // The startTime-bearing suggestion sits at 14:00 (matches the after-gap),
    // and a startTime-less suggestion fills the before-gap via the fallback branch.
    const blocks = computeTimelineBlocks(
      [makeEntry('09:00', '11:00')],
      [makeSuggestion('14:00'), makeSuggestion(undefined)],
      '08:00',
      '18:00',
    )
    const beforeGap = blocks.find((b) => b.type === 'gap' && b.startTime === '08:00')
    const afterGap = blocks.find((b) => b.type === 'gap' && b.startTime === '11:00')
    expect(afterGap?.suggestion?.startTime).toBe('14:00')
    expect(beforeGap?.suggestion).toBeDefined()
    expect(beforeGap?.suggestion?.startTime).toBeUndefined()
  })

  it('voegt geen voorloop-gat toe als entry op dayStart begint en geen na-gat als entry op dayEnd eindigt', () => {
    const blocks = computeTimelineBlocks(
      [makeEntry('08:00', '18:00')],
      [],
      '08:00',
      '18:00',
    )
    // Exactly one entry block; no surrounding gaps.
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('entry')
  })

  it('hergebruikt een suggestie niet voor twee gaten', () => {
    // Two gaps (before and after the entry) but only one startTime-less suggestion:
    // it fills the first gap, and the second gap finds none (usedSuggestions.has(i) → true).
    const blocks = computeTimelineBlocks(
      [makeEntry('09:00', '11:00')],
      [makeSuggestion(undefined)],
      '08:00',
      '18:00',
    )
    const gaps = blocks.filter((b) => b.type === 'gap')
    const withSuggestion = gaps.filter((g) => g.suggestion)
    expect(gaps.length).toBe(2)
    expect(withSuggestion.length).toBe(1)
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

function makeConcept(startTime: string, endTime: string): ClassifiedBlock {
  return {
    date: '2026-05-23',
    urlPattern: 'example.com',
    urls: ['https://example.com'],
    titles: ['Example'],
    visitCount: 3,
    firstVisitTime: startTime,
    lastVisitTime: endTime,
    hours: 1,
    blockName: 'Example',
    summary: '',
    startTime,
    endTime,
    confidence: 4,
    origin: 'llm',
  }
}

describe('mergeConceptsIntoTimeline', () => {
  it('toont geboekte entry en concept als ze niet overlappen', () => {
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('09:00', '11:00')],
      [makeConcept('13:00', '15:00')],
      '08:00',
      '18:00',
    )
    expect(blocks.some(b => b.type === 'entry')).toBe(true)
    expect(blocks.some(b => b.type === 'concept')).toBe(true)
  })

  it('toont concept naast geboekte entry als ze volledig overlappen', () => {
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('09:00', '11:00')],
      [makeConcept('09:00', '11:00')],
      '08:00',
      '18:00',
    )
    expect(blocks.some(b => b.type === 'entry')).toBe(true)
    // concept is ook aanwezig als los blok — renderer bepaalt kolom
    expect(blocks.some(b => b.type === 'concept')).toBe(true)
  })

  it('toont concept naast geboekte entry bij gedeeltelijke overlap', () => {
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('09:00', '11:00')],
      [makeConcept('10:00', '12:00')],
      '08:00',
      '18:00',
    )
    expect(blocks.some(b => b.type === 'entry')).toBe(true)
    expect(blocks.some(b => b.type === 'concept')).toBe(true)
  })

  it('voegt geen rand-gaten toe als een entry de hele dag vult', () => {
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('08:00', '18:00')],
      [],
      '08:00',
      '18:00',
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('entry')
  })

  it('dedupliceert concepten met dezelfde naam/start/eind', () => {
    const blocks = mergeConceptsIntoTimeline(
      [],
      [makeConcept('09:00', '11:00'), makeConcept('09:00', '11:00')],
      '08:00',
      '18:00',
    )
    expect(blocks.filter(b => b.type === 'concept')).toHaveLength(1)
  })

  it('toont concept als het aansluit maar niet overlapt met een entry', () => {
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('09:00', '11:00')],
      [makeConcept('11:00', '13:00')],
      '08:00',
      '18:00',
    )
    expect(blocks.some(b => b.type === 'entry')).toBe(true)
    expect(blocks.some(b => b.type === 'concept')).toBe(true)
  })
})

describe('buildTimelineRows', () => {
  it('geeft een rij met alleen left als er geen overlappend concept is', () => {
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('09:00', '11:00')],
      [],
      '08:00',
      '18:00',
    )
    const rows = buildTimelineRows(blocks)
    expect(rows.every(r => r.right === undefined)).toBe(true)
  })

  it('geeft een rij met left=entry en right=concept als ze overlappen', () => {
    // Met nieuwe logica heeft elke block zijn eigen rij — entry en concept zijn losse rijen
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('09:00', '11:00')],
      [makeConcept('09:00', '11:00')],
      '08:00',
      '18:00',
    )
    expect(blocks.some(b => b.type === 'entry')).toBe(true)
    expect(blocks.some(b => b.type === 'concept')).toBe(true)
  })

  it('geeft gat-rij zonder right als er geen concept in dat gat zit', () => {
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('09:00', '11:00')],
      [],
      '08:00',
      '18:00',
    )
    const rows = buildTimelineRows(blocks)
    const gapRow = rows.find(r => r.left.type === 'gap')
    expect(gapRow).toBeDefined()
    expect(gapRow!.right).toBeUndefined()
  })

  it('zet een overlappend concept in de rechterkolom van een entry-rij', () => {
    const entry = makeEntry('09:00', '11:00')
    const concept = makeConcept('09:30', '10:30')
    const blockWithOverlap = {
      type: 'entry' as const,
      startTime: entry.startTime,
      endTime: entry.endTime,
      entry,
      overlappingConcept: concept,
    }
    const rows = buildTimelineRows([blockWithOverlap as never])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.left.type).toBe('entry')
    expect(rows[0]!.right?.type).toBe('concept')
    expect(rows[0]!.right!.startTime).toBe('09:30')
    expect(rows[0]!.right!.endTime).toBe('10:30')
  })

  it('geeft concept op eigen rij zonder right als het niet overlapt', () => {
    const blocks = mergeConceptsIntoTimeline(
      [makeEntry('09:00', '11:00')],
      [makeConcept('13:00', '15:00')],
      '08:00',
      '18:00',
    )
    const rows = buildTimelineRows(blocks)
    const conceptRow = rows.find(r => r.left.type === 'concept')
    expect(conceptRow).toBeDefined()
    expect(conceptRow!.right).toBeUndefined()
  })
})

describe('assignBlockColumns', () => {
  const b = (startTime: string, endTime: string) => ({ startTime, endTime })

  it('puts a fully contiguous, non-overlapping day in one column', () => {
    const { columns, numCols } = assignBlockColumns([
      b('09:00', '09:30'), b('09:30', '10:00'), b('10:00', '11:00'),
      b('11:00', '11:30'), b('13:30', '14:30'), b('15:00', '17:00'),
    ])
    expect(numCols).toBe(1)
    expect(columns.every(c => c.col === 0)).toBe(true)
  })

  it('does not bump a longer block into a second column when it fits a gap (regression)', () => {
    // Mixed durations, no overlaps — the old duration-sort produced 2 columns here.
    const { numCols } = assignBlockColumns([
      b('09:00', '09:30'), b('10:00', '11:00'), b('11:00', '11:30'), b('13:30', '14:30'),
    ])
    expect(numCols).toBe(1)
  })

  it('uses a second column only for genuinely overlapping blocks', () => {
    const { columns, numCols } = assignBlockColumns([
      b('09:00', '10:00'), b('09:30', '10:30'),
    ])
    expect(numCols).toBe(2)
    expect(columns.map(c => c.col).sort()).toEqual([0, 1])
  })

  it('treats touching blocks (end === next start) as the same column', () => {
    const { numCols } = assignBlockColumns([b('09:00', '10:00'), b('10:00', '11:00')])
    expect(numCols).toBe(1)
  })

  it('breaks ties on equal start time by duration (shorter first)', () => {
    // Same start time forces the duration comparator (durA - durB).
    const { columns, numCols } = assignBlockColumns([
      b('09:00', '11:00'), // longer
      b('09:00', '09:30'), // shorter — sorts first
    ])
    expect(numCols).toBe(2)
    // The shorter block (09:00–09:30) is processed first and lands in column 0.
    const shorter = columns.find(c => c.block.endTime === '09:30')!
    expect(shorter.col).toBe(0)
  })
})
