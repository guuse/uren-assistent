import { describe, it, expect, vi } from 'vitest'
import { ClassifyHistoryBlocksUseCase } from './ClassifyHistoryBlocksUseCase'
import type { HistoryBlock } from '../entities/HistoryBlock'

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

    const mockCopilot = { classify: vi.fn(), classifyDay: vi.fn() }
    const uc = new ClassifyHistoryBlocksUseCase(mockCopilot, mockCache)
    const result = await uc.execute([block], [], [])

    expect(result[0]!.blockName).toBe('Cached Block Name')
    expect(result[0]!.summary).toBe('Cached summary text')
    expect(mockCopilot.classify).not.toHaveBeenCalled()
  })
})
