import { describe, it, expect } from 'vitest'
import type { HistoryBlock } from '../../../src/domain/entities/HistoryBlock'
import type { ClassifiedBlock } from '../../../src/domain/entities/ClassifiedBlock'

describe('HistoryBlock', () => {
  it('has the expected shape', () => {
    const block: HistoryBlock = {
      date: '2026-05-11',
      urlPattern: 'github.com/Harborn-digital/eindhoven-doet',
      titles: ['Eindhoven Doet', 'Pull requests'],
      visitCount: 5,
      firstVisitTime: '08:30',
      hours: 1.5,
    }
    expect(block.date).toBe('2026-05-11')
    expect(block.hours).toBe(1.5)
  })
})

describe('ClassifiedBlock', () => {
  it('extends HistoryBlock with classification fields', () => {
    const block: ClassifiedBlock = {
      date: '2026-05-11',
      urlPattern: 'github.com/Harborn-digital/eindhoven-doet',
      titles: ['Eindhoven Doet'],
      visitCount: 5,
      firstVisitTime: '08:30',
      hours: 1.5,
      startTime: '08:30',
      endTime: '10:00',
      projectId: 'p1',
      serviceId: 's1',
      note: 'Eindhoven Doet development',
      confidence: 4,
      origin: 'llm',
    }
    expect(block.origin).toBe('llm')
    expect(block.confidence).toBe(4)
  })
})
