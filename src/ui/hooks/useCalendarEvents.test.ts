import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCalendarEvents } from './useCalendarEvents'

const hasCalendarScope = vi.fn()
const ucExecute = vi.fn()

vi.mock('../../application/container', () => ({
  createCalendarRepository: () => ({ hasCalendarScope: () => hasCalendarScope() }),
  createFetchCalendarEventsUseCase: () => ({ execute: (a: Date, b: Date) => ucExecute(a, b) }),
}))

describe('useCalendarEvents', () => {
  beforeEach(() => {
    hasCalendarScope.mockReset()
    ucExecute.mockReset()
  })

  it('fetches events when scope is present', async () => {
    hasCalendarScope.mockResolvedValue(true)
    const events = [{ id: 'e1' }]
    ucExecute.mockResolvedValue(events)
    const { result } = renderHook(() => useCalendarEvents())

    await act(async () => {
      await result.current.fetch(new Date('2026-05-01'), new Date('2026-05-07'))
    })

    expect(result.current.events).toEqual(events)
    expect(result.current.hasCalendarScope).toBe(true)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns empty when scope is missing', async () => {
    hasCalendarScope.mockResolvedValue(false)
    const { result } = renderHook(() => useCalendarEvents())

    await act(async () => {
      await result.current.fetch(new Date(), new Date())
    })

    expect(result.current.hasCalendarScope).toBe(false)
    expect(result.current.events).toEqual([])
    expect(ucExecute).not.toHaveBeenCalled()
  })

  it('captures Error messages', async () => {
    hasCalendarScope.mockRejectedValue(new Error('scope-fail'))
    const { result } = renderHook(() => useCalendarEvents())

    await act(async () => {
      await result.current.fetch(new Date(), new Date())
    })

    await waitFor(() => expect(result.current.error).toBe('scope-fail'))
    expect(result.current.events).toEqual([])
  })

  it('stringifies non-Error throws', async () => {
    hasCalendarScope.mockResolvedValue(true)
    ucExecute.mockRejectedValue('weird')
    const { result } = renderHook(() => useCalendarEvents())

    await act(async () => {
      await result.current.fetch(new Date(), new Date())
    })

    expect(result.current.error).toBe('weird')
  })
})
