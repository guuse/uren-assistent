import { describe, it, expect } from 'vitest'
import { mergeConceptsIntoTimeline } from '../../../src/ui/components/DayTimeline.helpers'
import type { HourEntry } from '../../../src/domain/entities/HourEntry'
import type { ClassifiedBlock } from '../../../src/domain/entities/ClassifiedBlock'

function makeEntry(startTime: string, endTime: string): HourEntry {
  return {
    employeeId: 'e1', projectId: 'p1', projectServiceId: 's1',
    hourTypeId: 'ht1', hours: 1, startDate: '2026-05-21',
    startTime, endTime, note: '',
  }
}

function makeConcept(startTime: string, endTime: string, urlPattern = 'github.com'): ClassifiedBlock {
  return {
    date: '2026-05-21', urlPattern, urls: [], titles: [],
    visitCount: 1, firstVisitTime: '09:00', lastVisitTime: '10:00', hours: 1,
    blockName: 'Test', summary: 'test', startTime, endTime,
    confidence: 0.9, origin: 'llm',
  }
}

describe('mergeConceptsIntoTimeline', () => {
  it('geeft alleen gaten terug bij lege inputs', () => {
    const blocks = mergeConceptsIntoTimeline([], [], '08:00', '10:00')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('gap')
  })

  it('plaatst een concept-blok op de juiste plek', () => {
    const concept = makeConcept('09:00', '10:00')
    const blocks = mergeConceptsIntoTimeline([], [concept], '08:00', '11:00')
    const types = blocks.map(b => b.type)
    expect(types).toEqual(['gap', 'concept', 'gap'])
  })

  it('plaatst een entry en een concept naast elkaar', () => {
    const entry = makeEntry('08:00', '09:00')
    const concept = makeConcept('09:00', '10:00')
    const blocks = mergeConceptsIntoTimeline([entry], [concept], '08:00', '11:00')
    const types = blocks.map(b => b.type)
    expect(types).toEqual(['entry', 'concept', 'gap'])
  })

  it('sorteert op startTime ongeacht invoervolgorde', () => {
    const entry = makeEntry('10:00', '11:00')
    const concept = makeConcept('08:00', '09:00')
    const blocks = mergeConceptsIntoTimeline([entry], [concept], '08:00', '12:00')
    expect(blocks[0]!.type).toBe('concept')
    expect(blocks[1]!.type).toBe('gap')
    expect(blocks[2]!.type).toBe('entry')
    expect(blocks[3]!.type).toBe('gap')
  })

  it('een concept-blok heeft type "concept" en bevat het block-object', () => {
    const concept = makeConcept('09:00', '10:00')
    const blocks = mergeConceptsIntoTimeline([], [concept], '08:00', '11:00')
    const conceptBlock = blocks.find(b => b.type === 'concept')!
    expect(conceptBlock.type).toBe('concept')
    if (conceptBlock.type === 'concept') {
      expect(conceptBlock.block.urlPattern).toBe('github.com')
    }
  })
})
