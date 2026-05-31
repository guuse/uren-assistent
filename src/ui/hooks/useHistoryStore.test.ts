import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useHistoryStore } from './useHistoryStore'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

const load = vi.fn()
const getBlocksForDate = vi.fn()
const hasDataForDate = vi.fn()
const setBlocksForDate = vi.fn()
const removeBlock = vi.fn()

vi.mock('../../application/container', () => ({
  historyStore: {
    load: () => load(),
    getBlocksForDate: (d: string) => getBlocksForDate(d),
    hasDataForDate: (d: string) => hasDataForDate(d),
    setBlocksForDate: (d: string, b: unknown) => setBlocksForDate(d, b),
    removeBlock: (d: string, u: string) => removeBlock(d, u),
  },
}))

const block = { urlPattern: 'x' } as unknown as ClassifiedBlock

describe('useHistoryStore', () => {
  beforeEach(() => {
    load.mockReset().mockResolvedValue(undefined)
    getBlocksForDate.mockReset().mockResolvedValue([block])
    hasDataForDate.mockReset().mockResolvedValue(true)
    setBlocksForDate.mockReset().mockResolvedValue(undefined)
    removeBlock.mockReset().mockResolvedValue(undefined)
  })

  it('loads blocks for the selected date on mount', async () => {
    const { result } = renderHook(() => useHistoryStore('2026-05-01'))
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.blocksForDate).toEqual([block])
    expect(result.current.hasData).toBe(true)
    expect(load).toHaveBeenCalled()
  })

  it('reloads when the selected date changes', async () => {
    const { result, rerender } = renderHook(({ d }) => useHistoryStore(d), {
      initialProps: { d: '2026-05-01' },
    })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    getBlocksForDate.mockClear()

    rerender({ d: '2026-05-02' })
    await waitFor(() => expect(getBlocksForDate).toHaveBeenCalledWith('2026-05-02'))
  })

  it('saveBlocksForDate persists and reloads', async () => {
    const { result } = renderHook(() => useHistoryStore('2026-05-01'))
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    await act(async () => {
      await result.current.saveBlocksForDate('2026-05-03', [block])
    })
    expect(setBlocksForDate).toHaveBeenCalledWith('2026-05-03', [block])
  })

  it('removeBlock removes and reloads', async () => {
    const { result } = renderHook(() => useHistoryStore('2026-05-01'))
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    await act(async () => {
      await result.current.removeBlock('2026-05-03', 'pattern')
    })
    expect(removeBlock).toHaveBeenCalledWith('2026-05-03', 'pattern')
  })

  it('conceptCountForDate returns block count', async () => {
    const { result } = renderHook(() => useHistoryStore('2026-05-01'))
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    let count = 0
    await act(async () => {
      count = await result.current.conceptCountForDate('2026-05-05')
    })
    expect(count).toBe(1)
  })
})
