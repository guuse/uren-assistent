import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClearWeekBlocksUseCase } from './ClearWeekBlocksUseCase'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'

const makeMockStore = (blocksByDate: Record<string, { urlPattern: string; origin: string }[]>): IHistoryStore => ({
  getBlocksForDate: vi.fn(async (date: string) =>
    (blocksByDate[date] ?? []) as ClassifiedBlock[]
  ),
  removeBlock: vi.fn(async () => {}),
  saveBlocksForDate: vi.fn(async () => {}),
  hasDataForDate: vi.fn(async () => false),
  hasHistoryForWeek: vi.fn(async () => false),
})

describe('ClearWeekBlocksUseCase', () => {
  it('verwijdert LLM-blokken van alle opgegeven weekdagen', async () => {
    const store = makeMockStore({
      '2026-05-26': [
        { urlPattern: 'github.com/a', origin: 'llm' },
        { urlPattern: 'github.com/b', origin: 'cache' },
      ],
      '2026-05-27': [
        { urlPattern: 'github.com/c', origin: 'llm-pattern' },
      ],
      '2026-05-28': [],
    })
    const useCase = new ClearWeekBlocksUseCase(store)
    const result = await useCase.execute(['2026-05-26', '2026-05-27', '2026-05-28'])
    expect(result.removedCount).toBe(2)
    expect(store.removeBlock).toHaveBeenCalledWith('2026-05-26', 'github.com/a')
    expect(store.removeBlock).not.toHaveBeenCalledWith('2026-05-26', 'github.com/b')
    expect(store.removeBlock).toHaveBeenCalledWith('2026-05-27', 'github.com/c')
  })

  it('geeft 0 terug als er geen LLM-blokken zijn', async () => {
    const store = makeMockStore({
      '2026-05-26': [{ urlPattern: 'github.com/x', origin: 'cache' }],
    })
    const useCase = new ClearWeekBlocksUseCase(store)
    const result = await useCase.execute(['2026-05-26'])
    expect(result.removedCount).toBe(0)
    expect(store.removeBlock).not.toHaveBeenCalled()
  })

  it('werkt met een lege lijst weekdagen', async () => {
    const store = makeMockStore({})
    const useCase = new ClearWeekBlocksUseCase(store)
    const result = await useCase.execute([])
    expect(result.removedCount).toBe(0)
  })

  it('geeft removedByDate terug per dag', async () => {
    const store = makeMockStore({
      '2026-05-26': [{ urlPattern: 'github.com/a', origin: 'llm' }],
      '2026-05-27': [{ urlPattern: 'github.com/b', origin: 'llm' }, { urlPattern: 'github.com/c', origin: 'llm' }],
    })
    const useCase = new ClearWeekBlocksUseCase(store)
    const result = await useCase.execute(['2026-05-26', '2026-05-27'])
    expect(result.removedByDate['2026-05-26']).toBe(1)
    expect(result.removedByDate['2026-05-27']).toBe(2)
  })
})
