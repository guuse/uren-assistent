import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { HourSubmission } from '../../domain/entities/HourSubmission'

let employeeId: string | null = 'emp-1'
vi.mock('../../store/appStore', () => ({
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ simplicateEmployeeId: employeeId }),
}))

const keychainGet = vi.fn()
const getSubmissionsExecute = vi.fn()
const submitWeekExecute = vi.fn()
const createSimplicateRepository = vi.fn(() => ({}))
const createUseCases = vi.fn(() => ({
  getSubmissions: { execute: (...a: unknown[]) => getSubmissionsExecute(...a) },
  submitWeek: { execute: (...a: unknown[]) => submitWeekExecute(...a) },
}))

vi.mock('../../application/container', () => ({
  keychainRepo: { get: (k: string) => keychainGet(k) },
  createSimplicateRepository: () => createSimplicateRepository(),
  createUseCases: () => createUseCases(),
}))

import { useSubmissions } from './useSubmissions'

const sub: HourSubmission = {
  startDate: '2026-05-01',
  endDate: '2026-05-31',
} as unknown as HourSubmission

describe('useSubmissions', () => {
  beforeEach(() => {
    employeeId = 'emp-1'
    keychainGet.mockReset().mockResolvedValue('secret')
    getSubmissionsExecute.mockReset().mockResolvedValue([sub])
    submitWeekExecute.mockReset().mockResolvedValue(undefined)
    createSimplicateRepository.mockClear()
  })

  it('loadMonth fetches and caches submissions', async () => {
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await result.current.loadMonth('2026-05-15')
    })
    expect(getSubmissionsExecute).toHaveBeenCalledTimes(1)
    expect(result.current.isDateSubmitted('2026-05-10')).toBe(true)
    expect(result.current.isDateSubmitted('2025-01-01')).toBe(false)
  })

  it('loadMonth is a no-op without an employee id', async () => {
    employeeId = null
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await result.current.loadMonth('2026-05-15')
    })
    expect(getSubmissionsExecute).not.toHaveBeenCalled()
  })

  it('loadMonth skips an already-loaded month', async () => {
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await result.current.loadMonth('2026-05-15')
    })
    await act(async () => {
      await result.current.loadMonth('2026-05-20')
    })
    expect(getSubmissionsExecute).toHaveBeenCalledTimes(1)
  })

  it('loadMonth dedups concurrent in-flight calls', async () => {
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await Promise.all([
        result.current.loadMonth('2026-06-15'),
        result.current.loadMonth('2026-06-16'),
      ])
    })
    expect(getSubmissionsExecute).toHaveBeenCalledTimes(1)
  })

  it('loadMonth logs and swallows errors', async () => {
    getSubmissionsExecute.mockRejectedValue(new Error('fetch fail'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await result.current.loadMonth('2026-05-15')
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('loadMonth surfaces missing-credential errors via the catch', async () => {
    keychainGet.mockResolvedValue(null)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await result.current.loadMonth('2026-05-15')
    })
    expect(createSimplicateRepository).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('submit succeeds and normalises the range to Monday–Sunday', async () => {
    const { result } = renderHook(() => useSubmissions())
    let ok = false
    await act(async () => {
      // Mon 2026-05-04 .. Fri 2026-05-08 → must be sent as Mon .. Sun (2026-05-10)
      ok = await result.current.submit('2026-05-04', '2026-05-08')
    })
    expect(ok).toBe(true)
    expect(submitWeekExecute).toHaveBeenCalledWith('emp-1', '2026-05-04', '2026-05-10')
    expect(result.current.isSubmitting).toBe(false)
  })

  it('submit reloads across two months when range spans them', async () => {
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await result.current.submit('2026-05-28', '2026-06-03')
    })
    // loadMonth called for both May and June
    expect(getSubmissionsExecute).toHaveBeenCalledTimes(2)
  })

  it('submit fails without an employee id', async () => {
    employeeId = null
    const { result } = renderHook(() => useSubmissions())
    let ok = true
    await act(async () => {
      ok = await result.current.submit('2026-05-01', '2026-05-07')
    })
    expect(ok).toBe(false)
    expect(result.current.submitError).toContain('Geen medewerker')
  })

  it('submit captures an error message', async () => {
    submitWeekExecute.mockRejectedValue(new Error('submit boom'))
    const { result } = renderHook(() => useSubmissions())
    let ok = true
    await act(async () => {
      ok = await result.current.submit('2026-05-01', '2026-05-07')
    })
    expect(ok).toBe(false)
    expect(result.current.submitError).toContain('submit boom')
  })

  it('submit stringifies non-Error throws', async () => {
    submitWeekExecute.mockRejectedValue('plain')
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await result.current.submit('2026-05-01', '2026-05-07')
    })
    expect(result.current.submitError).toContain('plain')
  })

  it('clearSubmitError resets the error', async () => {
    submitWeekExecute.mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => useSubmissions())
    await act(async () => {
      await result.current.submit('2026-05-01', '2026-05-07')
    })
    expect(result.current.submitError).not.toBeNull()
    act(() => {
      result.current.clearSubmitError()
    })
    await waitFor(() => expect(result.current.submitError).toBeNull())
  })
})
