import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useClearWeekBlocks } from './useClearWeekBlocks'

const execute = vi.fn()
vi.mock('../../application/container', () => ({
  createClearWeekBlocksUseCase: () => ({ execute }),
}))

describe('useClearWeekBlocks', () => {
  beforeEach(() => {
    execute.mockReset()
  })

  it('clears a week and calls onSuccess', async () => {
    execute.mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const days = ['2026-05-01', '2026-05-02']
    const { result } = renderHook(() => useClearWeekBlocks(onSuccess))

    await act(async () => {
      await result.current.clearWeek(days)
    })

    expect(execute).toHaveBeenCalledWith(days)
    expect(onSuccess).toHaveBeenCalledWith(days)
    expect(result.current.isClearingWeek).toBe(false)
    expect(result.current.clearWeekError).toBeNull()
  })

  it('captures an Error message on failure', async () => {
    execute.mockRejectedValue(new Error('week-boom'))
    const { result } = renderHook(() => useClearWeekBlocks(vi.fn()))

    await act(async () => {
      await result.current.clearWeek(['2026-05-01'])
    })

    await waitFor(() => expect(result.current.clearWeekError).toBe('week-boom'))
  })

  it('falls back to a default message for non-Error throws', async () => {
    execute.mockRejectedValue('nope')
    const { result } = renderHook(() => useClearWeekBlocks(vi.fn()))

    await act(async () => {
      await result.current.clearWeek(['2026-05-01'])
    })

    expect(result.current.clearWeekError).toBe('Onbekende fout')
  })
})
