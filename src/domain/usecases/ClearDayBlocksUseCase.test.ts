import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClearDayBlocksUseCase } from './ClearDayBlocksUseCase'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'

function makeBlock(overrides: Partial<ClassifiedBlock>): ClassifiedBlock {
  return {
    date: '2026-05-27',
    urlPattern: 'test-pattern',
    urls: [],
    titles: ['Test'],
    visitCount: 1,
    firstVisitTime: '09:00',
    lastVisitTime: '10:00',
    hours: 1,
    blockName: 'Test blok',
    summary: 'samenvatting',
    startTime: '09:00',
    endTime: '10:00',
    confidence: 3,
    origin: 'llm',
    ...overrides,
  }
}

describe('ClearDayBlocksUseCase', () => {
  let historyStore: IHistoryStore
  let useCase: ClearDayBlocksUseCase

  beforeEach(() => {
    historyStore = {
      load: vi.fn().mockResolvedValue(undefined),
      getBlocksForDate: vi.fn(),
      setBlocksForDate: vi.fn().mockResolvedValue(undefined),
      removeBlock: vi.fn().mockResolvedValue(undefined),
      hasDataForDate: vi.fn(),
      hasHistoryForWeek: vi.fn(),
    }
    useCase = new ClearDayBlocksUseCase(historyStore)
  })

  it('verwijdert llm-blokken', async () => {
    const blocks = [
      makeBlock({ urlPattern: 'a', origin: 'llm' }),
      makeBlock({ urlPattern: 'b', origin: 'llm-pattern' }),
    ]
    vi.mocked(historyStore.getBlocksForDate).mockResolvedValue(blocks)

    const result = await useCase.execute('2026-05-27')

    expect(historyStore.removeBlock).toHaveBeenCalledWith('2026-05-27', 'a')
    expect(historyStore.removeBlock).toHaveBeenCalledWith('2026-05-27', 'b')
    expect(result.removedCount).toBe(2)
  })

  it('laat calendar-blokken ongemoeid', async () => {
    const blocks = [
      makeBlock({ urlPattern: 'c', origin: 'calendar' }),
      makeBlock({ urlPattern: 'd', origin: 'manual' }),
      makeBlock({ urlPattern: 'e', origin: 'cache' }),
    ]
    vi.mocked(historyStore.getBlocksForDate).mockResolvedValue(blocks)

    const result = await useCase.execute('2026-05-27')

    expect(historyStore.removeBlock).not.toHaveBeenCalled()
    expect(result.removedCount).toBe(0)
  })

  it('geeft 0 terug als er geen blokken zijn', async () => {
    vi.mocked(historyStore.getBlocksForDate).mockResolvedValue([])

    const result = await useCase.execute('2026-05-27')

    expect(result.removedCount).toBe(0)
  })

  it('verwijdert llm en llm-pattern maar laat andere origins staan', async () => {
    const blocks = [
      makeBlock({ urlPattern: 'llm-1', origin: 'llm' }),
      makeBlock({ urlPattern: 'calendar-1', origin: 'calendar' }),
      makeBlock({ urlPattern: 'pattern-1', origin: 'llm-pattern' }),
    ]
    vi.mocked(historyStore.getBlocksForDate).mockResolvedValue(blocks)

    const result = await useCase.execute('2026-05-27')

    expect(historyStore.removeBlock).toHaveBeenCalledTimes(2)
    expect(historyStore.removeBlock).toHaveBeenCalledWith('2026-05-27', 'llm-1')
    expect(historyStore.removeBlock).toHaveBeenCalledWith('2026-05-27', 'pattern-1')
    expect(result.removedCount).toBe(2)
  })
})
