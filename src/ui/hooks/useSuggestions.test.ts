import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

let employeeId: string | null = 'emp-1'
vi.mock('../../store/appStore', () => ({
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ simplicateEmployeeId: employeeId }),
}))

const keychainGet = vi.fn()
const getWeekEntriesExecute = vi.fn()
const generateExecute = vi.fn()
const createSimplicateRepository = vi.fn(() => ({}))
const createUseCases = vi.fn(() => ({
  getWeekEntries: { execute: (id: string, ws: string) => getWeekEntriesExecute(id, ws) },
  generateSuggestions: { execute: (d: string, e: unknown) => generateExecute(d, e) },
}))

vi.mock('../../application/container', () => ({
  keychainRepo: { get: (k: string) => keychainGet(k) },
  createSimplicateRepository: () => createSimplicateRepository(),
  createUseCases: () => createUseCases(),
}))

import { useSuggestions } from './useSuggestions'

describe('useSuggestions', () => {
  beforeEach(() => {
    employeeId = 'emp-1'
    keychainGet.mockReset().mockResolvedValue('secret')
    getWeekEntriesExecute.mockReset().mockResolvedValue({ '2026-05-01': [{ hours: 1 }] })
    generateExecute.mockReset().mockReturnValue([{ projectId: 'p1' }])
    createSimplicateRepository.mockClear()
  })

  it('loads suggestions across 4 weeks', async () => {
    const { result } = renderHook(() => useSuggestions('2026-05-31'))
    await waitFor(() => expect(result.current.suggestions).toEqual([{ projectId: 'p1' }]))
    expect(getWeekEntriesExecute).toHaveBeenCalledTimes(4)
    expect(result.current.isLoading).toBe(false)
  })

  it('does nothing without an employee id', async () => {
    employeeId = null
    const { result } = renderHook(() => useSuggestions('2026-05-31'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(getWeekEntriesExecute).not.toHaveBeenCalled()
  })

  it('does nothing without a selected date', async () => {
    const { result } = renderHook(() => useSuggestions(''))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(getWeekEntriesExecute).not.toHaveBeenCalled()
  })

  it('returns early when api keys are missing', async () => {
    keychainGet.mockResolvedValue(null)
    renderHook(() => useSuggestions('2026-05-31'))
    await waitFor(() => expect(keychainGet).toHaveBeenCalled())
    expect(createSimplicateRepository).not.toHaveBeenCalled()
  })
})
