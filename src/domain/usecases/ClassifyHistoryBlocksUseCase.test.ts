import { describe, it, expect, vi } from 'vitest'
import { ClassifyHistoryBlocksUseCase } from './ClassifyHistoryBlocksUseCase'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'

function makeBlock(overrides: Partial<HistoryBlock> = {}): HistoryBlock {
  return {
    date: '2024-05-13',
    urlPattern: 'github.com/org/repo',
    urls: ['github.com/org/repo'],
    titles: ['GitHub'],
    visitCount: 5,
    firstVisitTime: '09:00',
    lastVisitTime: '10:00',
    hours: 1,
    ...overrides,
  }
}

function makeCache(getReturn: unknown) {
  return {
    load: vi.fn(),
    get: vi.fn().mockReturnValue(getReturn),
    set: vi.fn(),
    getAll: vi.fn().mockReturnValue({}),
  }
}

describe('ClassifyHistoryBlocksUseCase', () => {
  it('uses cached blockName and summary when available', async () => {
    const block: HistoryBlock = {
      date: '2024-05-13',
      urlPattern: 'github.com/org/repo',
      urls: ['github.com/org/repo'],
      titles: ['GitHub'],
      visitCount: 5,
      firstVisitTime: '09:00',
      lastVisitTime: '10:00',
      hours: 1,
    }

    const mockCache = {
      load: vi.fn(),
      get: vi.fn().mockReturnValue({
        projectId: 'p1',
        serviceId: 's1',
        note: 'cached note',
        blockName: 'Cached Block Name',
        summary: 'Cached summary text',
      }),
      set: vi.fn(),
      getAll: vi.fn().mockReturnValue({}),
    }

    const mockCopilot = { classify: vi.fn(), classifyDay: vi.fn(), listModels: vi.fn().mockResolvedValue([]) }
    const uc = new ClassifyHistoryBlocksUseCase(mockCopilot, mockCache)
    const result = await uc.execute([block], [], [])

    expect(result[0]!.blockName).toBe('Cached Block Name')
    expect(result[0]!.summary).toBe('Cached summary text')
    expect(mockCopilot.classify).not.toHaveBeenCalled()
  })

  it('cache hit with empty lastVisitTime derives endTime via addHoursToTime', async () => {
    const block = makeBlock({ lastVisitTime: '', firstVisitTime: '23:45', hours: 1 })
    const cache = makeCache({ projectId: 'p1', serviceId: 's1', note: 'n' })
    const copilot = { classify: vi.fn(), classifyDay: vi.fn() }
    const uc = new ClassifyHistoryBlocksUseCase(copilot as never, cache as never)
    const result = await uc.execute([block], [], [])
    // 23:45 + 1h wraps with %24 → 00:45
    expect(result[0]!.endTime).toBe('00:45')
    expect(result[0]!.blockName).toBe('github.com/org/repo') // falls back to urlPattern
  })

  it('sends uncached blocks to the LLM and maps confidence', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    const cache = makeCache(undefined)
    const copilot = {
      classify: vi.fn().mockResolvedValue([{ ...block, blockName: 'X', summary: '', projectId: 'p1', serviceId: 's1', note: '', confidence: 4, origin: 'llm', startTime: '09:00', endTime: '10:00' }]),
      classifyDay: vi.fn(),
    }
    const uc = new ClassifyHistoryBlocksUseCase(copilot as never, cache as never)
    const result = await uc.execute([block], [], [])
    expect(copilot.classify).toHaveBeenCalledOnce()
    expect(result[0]!.blockName).toBe('X')
  })

  it('attaches overlapping meetings on the same date and ignores other-date events', async () => {
    const block = makeBlock({ urlPattern: 'example.com', firstVisitTime: '10:00', lastVisitTime: '11:00' })
    const cache = makeCache({ projectId: 'p1', serviceId: 's1', note: 'n' })
    const sameDay: CalendarEvent = {
      id: 'e1', title: 'Sync',
      start: new Date('2024-05-13T10:30:00'), end: new Date('2024-05-13T11:30:00'),
      attendees: [], status: 'accepted',
    }
    const otherDay: CalendarEvent = {
      id: 'e2', title: 'Other',
      start: new Date('2024-05-14T10:30:00'), end: new Date('2024-05-14T11:30:00'),
      attendees: [], status: 'accepted',
    }
    const noOverlap: CalendarEvent = {
      id: 'e3', title: 'Late',
      start: new Date('2024-05-13T15:00:00'), end: new Date('2024-05-13T16:00:00'),
      attendees: [], status: 'accepted',
    }
    const copilot = { classify: vi.fn(), classifyDay: vi.fn() }
    const uc = new ClassifyHistoryBlocksUseCase(copilot as never, cache as never)
    const result = await uc.execute([block], [], [], [sameDay, otherDay, noOverlap])
    expect(result[0]!.overlappingMeetings!.map(m => m.id)).toEqual(['e1'])
  })
})
