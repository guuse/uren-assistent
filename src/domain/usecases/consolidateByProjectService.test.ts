import { describe, it, expect } from 'vitest'
import { consolidateByProjectService } from './consolidateByProjectService'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'

function block(over: Partial<ClassifiedBlock> = {}): ClassifiedBlock {
  return {
    date: '2026-06-01',
    urlPattern: 'github.com/acme/web',
    urls: ['github.com/acme/web'],
    titles: ['PR: thing'],
    visitCount: 1,
    firstVisitTime: '09:00',
    lastVisitTime: '10:00',
    hours: 1,
    blockName: 'Web work',
    summary: 'did web work',
    startTime: '09:00',
    endTime: '10:00',
    note: 'web',
    confidence: 3,
    origin: 'llm',
    projectId: 'P1',
    serviceId: 'S1',
    ...over,
  }
}

describe('consolidateByProjectService', () => {
  it('merges two blocks on the same project+service into one, summing hours', () => {
    const result = consolidateByProjectService([
      block({ urlPattern: 'github.com/acme/web@09:00', titles: ['PR: A'], hours: 1, startTime: '09:00', firstVisitTime: '09:00', lastVisitTime: '10:00', confidence: 3, visitCount: 2 }),
      block({ urlPattern: 'github.com/acme/web@14:00', titles: ['PR: B'], hours: 2, startTime: '14:00', firstVisitTime: '14:00', lastVisitTime: '16:00', confidence: 4, visitCount: 3 }),
    ])
    expect(result).toHaveLength(1)
    const m = result[0]!
    expect(m.hours).toBe(3)
    expect(m.visitCount).toBe(5)
    expect(m.titles).toEqual(expect.arrayContaining(['PR: A', 'PR: B']))
    expect(m.confidence).toBe(4)
    expect(m.firstVisitTime).toBe('09:00')
    expect(m.lastVisitTime).toBe('16:00')
    expect(m.blockName).toContain('(+1)')
  })

  it('keeps different services under the same project separate', () => {
    const result = consolidateByProjectService([
      block({ serviceId: 'S1', hours: 1 }),
      block({ serviceId: 'S2', hours: 2 }),
    ])
    expect(result).toHaveLength(2)
  })

  it('never merges meeting blocks', () => {
    const event = { title: 'Standup', start: new Date(), end: new Date(), attendees: [] } as unknown as CalendarEvent
    const result = consolidateByProjectService([
      block({ overlappingMeetings: [event], hours: 0.5 }),
      block({ overlappingMeetings: [event], hours: 0.5 }),
    ])
    expect(result).toHaveLength(2)
  })

  it('leaves fill candidates (llm-pattern) untouched', () => {
    const result = consolidateByProjectService([
      block({ origin: 'llm-pattern', hours: 1 }),
      block({ origin: 'llm-pattern', hours: 1 }),
    ])
    expect(result).toHaveLength(2)
  })

  it('passes through blocks missing a project or service', () => {
    /* eslint-disable @typescript-eslint/no-unused-vars -- omit project/service via rest */
    const { projectId: _p, ...noProject } = block({ hours: 1 })
    const { serviceId: _s, ...noService } = block({ hours: 1 })
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const result = consolidateByProjectService([noProject, noService])
    expect(result).toHaveLength(2)
  })

  it('leaves a single block unchanged', () => {
    const input = block({ blockName: 'Solo' })
    const result = consolidateByProjectService([input])
    expect(result).toHaveLength(1)
    expect(result[0]!.blockName).toBe('Solo')
  })
})
