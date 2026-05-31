import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useClearDayBlocks } from './useClearDayBlocks'

const execute = vi.fn()
vi.mock('../../application/container', () => ({
  createClearDayBlocksUseCase: () => ({ execute }),
}))

describe('useClearDayBlocks', () => {
  beforeEach(() => {
    execute.mockReset()
  })

  it('clears a day and calls onSuccess', async () => {
    execute.mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useClearDayBlocks(onSuccess))
    expect(result.current.isClearing).toBe(false)

    await act(async () => {
      await result.current.clearDay('2026-05-01')
    })

    expect(execute).toHaveBeenCalledWith('2026-05-01')
    expect(onSuccess).toHaveBeenCalledWith('2026-05-01')
    expect(result.current.isClearing).toBe(false)
    expect(result.current.clearError).toBeNull()
  })

  it('captures an Error message on failure', async () => {
    execute.mockRejectedValue(new Error('boom'))
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useClearDayBlocks(onSuccess))

    await act(async () => {
      await result.current.clearDay('2026-05-01')
    })

    expect(onSuccess).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.clearError).toBe('boom'))
  })

  it('falls back to a default message for non-Error throws', async () => {
    execute.mockRejectedValue('nope')
    const { result } = renderHook(() => useClearDayBlocks(vi.fn()))

    await act(async () => {
      await result.current.clearDay('2026-05-01')
    })

    expect(result.current.clearError).toBe('Onbekende fout')
  })
})
