import { describe, it, expectTypeOf } from 'vitest'
import type { ClassifiedBlock } from './ClassifiedBlock'

describe('ClassifiedBlock', () => {
  it('allows rawTitles and rawUrls to be undefined', () => {
    const block: ClassifiedBlock = {
      urlPattern: 'github.com',
      urls: ['https://github.com/org/repo'],
      titles: ['repo'],
      visitCount: 3,
      hours: 1,
      date: '2026-05-21',
      firstVisitTime: '09:00',
      lastVisitTime: '10:00',
      blockName: 'GitHub',
      summary: 'Code review',
      startTime: '09:00',
      endTime: '10:00',
      confidence: 4,
      origin: 'llm',
    }
    expectTypeOf(block.rawTitles).toEqualTypeOf<string[] | undefined>()
    expectTypeOf(block.rawUrls).toEqualTypeOf<string[] | undefined>()
  })

  it('accepts rawTitles and rawUrls when provided', () => {
    const block: ClassifiedBlock = {
      urlPattern: 'github.com',
      urls: ['https://github.com/org/repo'],
      titles: ['repo'],
      visitCount: 3,
      hours: 1,
      date: '2026-05-21',
      firstVisitTime: '09:00',
      lastVisitTime: '10:00',
      blockName: 'GitHub',
      summary: 'Code review',
      startTime: '09:00',
      endTime: '10:00',
      confidence: 4,
      origin: 'llm',
      rawTitles: ['Pull Request #42 · org/repo', 'Files changed · Pull Request #42'],
      rawUrls: ['github.com/org/repo/pull/42', 'github.com/org/repo/pull/42/files'],
    }
    expectTypeOf(block.rawTitles).toEqualTypeOf<string[] | undefined>()
    expectTypeOf(block.rawUrls).toEqualTypeOf<string[] | undefined>()
  })
})
