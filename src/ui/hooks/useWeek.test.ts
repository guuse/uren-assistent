import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { HourEntry } from '../../domain/entities/HourEntry'

let employeeId: string | null = 'employee-1'
vi.mock('../../store/appStore', () => ({
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ simplicateEmployeeId: employeeId }),
}))

const keychainGet = vi.fn()
const getWeekEntriesExecute = vi.fn()
const createSimplicateRepository = vi.fn(() => ({}))
const createUseCases = vi.fn(() => ({
  getWeekEntries: { execute: (...a: unknown[]) => getWeekEntriesExecute(...a) },
}))

vi.mock('../../application/container', () => ({
  keychainRepo: { get: (k: string) => keychainGet(k) },
  createSimplicateRepository: () => createSimplicateRepository(),
  createUseCases: () => createUseCases(),
}))

import { useWeek } from './useWeek'

const entry = (hours: number): HourEntry => ({ hours } as unknown as HourEntry)

describe('useWeek', () => {
  beforeEach(() => {
    employeeId = 'employee-1'
    keychainGet.mockReset().mockResolvedValue('key')
    getWeekEntriesExecute.mockReset().mockResolvedValue({})
    createSimplicateRepository.mockClear()
  })

  it('isCurrentWeek is true wanneer selectedWeekStart de maandag van deze week is', () => {
    const { result } = renderHook(() => useWeek())
    expect(result.current.isCurrentWeek).toBe(true)
  })

  it('isCurrentWeek is false na prevWeek()', () => {
    const { result } = renderHook(() => useWeek())
    act(() => {
      result.current.prevWeek()
    })
    expect(result.current.isCurrentWeek).toBe(false)
  })

  it('nextWeek schuift een week vooruit', () => {
    const { result } = renderHook(() => useWeek())
    const start = result.current.selectedWeekStart
    act(() => {
      result.current.nextWeek()
    })
    expect(result.current.selectedWeekStart).not.toBe(start)
    expect(result.current.isCurrentWeek).toBe(false)
  })

  it('goToCurrentWeek reset selectedWeekStart naar maandag van huidige week', () => {
    const { result } = renderHook(() => useWeek())
    act(() => {
      result.current.prevWeek()
    })
    expect(result.current.isCurrentWeek).toBe(false)
    act(() => {
      result.current.goToCurrentWeek()
    })
    expect(result.current.isCurrentWeek).toBe(true)
  })

  it('goToCurrentWeek zet selectedDate op maandag van huidige week', () => {
    const { result } = renderHook(() => useWeek())
    act(() => {
      result.current.prevWeek()
    })
    act(() => {
      result.current.goToCurrentWeek()
    })
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    today.setDate(today.getDate() + diff)
    const expectedMonday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(result.current.selectedDate).toBe(expectedMonday)
  })

  describe('goToDate', () => {
    it('zet selectedDate op de opgegeven datum', () => {
      const { result } = renderHook(() => useWeek())
      act(() => {
        result.current.goToDate('2024-05-08')
      })
      expect(result.current.selectedDate).toBe('2024-05-08')
    })

    it('zet selectedWeekStart op de maandag van de opgegeven datum', () => {
      const { result } = renderHook(() => useWeek())
      act(() => {
        result.current.goToDate('2024-05-08')
      }) // woensdag
      expect(result.current.selectedWeekStart).toBe('2024-05-06') // maandag
    })

    it('zet selectedWeekStart correct voor een maandag', () => {
      const { result } = renderHook(() => useWeek())
      act(() => {
        result.current.goToDate('2024-05-06')
      }) // maandag
      expect(result.current.selectedWeekStart).toBe('2024-05-06')
    })
  })

  it('laadt entries en berekent hoursForDate', async () => {
    const monday = renderHook(() => useWeek()).result.current.selectedWeekStart
    getWeekEntriesExecute.mockResolvedValue({ [monday]: [entry(2), entry(1.5)] })
    const { result } = renderHook(() => useWeek())
    await waitFor(() => expect(result.current.entriesByDate[monday]).toBeDefined())
    expect(result.current.hoursForDate(monday)).toBe(3.5)
    expect(result.current.hoursForDate('1999-01-01')).toBe(0)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('zet een foutmelding bij een fout', async () => {
    getWeekEntriesExecute.mockRejectedValue(new Error('laad fout'))
    const { result } = renderHook(() => useWeek())
    await waitFor(() => expect(result.current.error).toBe('laad fout'))
  })

  it('zet een standaard foutmelding voor non-Error throws', async () => {
    getWeekEntriesExecute.mockRejectedValue('weird')
    const { result } = renderHook(() => useWeek())
    await waitFor(() => expect(result.current.error).toBe('Laden mislukt'))
  })

  it('toont een fout wanneer API keys ontbreken', async () => {
    keychainGet.mockResolvedValue(null)
    const { result } = renderHook(() => useWeek())
    await waitFor(() => expect(result.current.error).toContain('API key'))
    expect(createSimplicateRepository).not.toHaveBeenCalled()
  })

  it('laadt niets zonder employee id', async () => {
    employeeId = null
    const { result } = renderHook(() => useWeek())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(getWeekEntriesExecute).not.toHaveBeenCalled()
  })

  it('refresh roept loadEntries opnieuw aan', async () => {
    const { result } = renderHook(() => useWeek())
    await waitFor(() => expect(getWeekEntriesExecute).toHaveBeenCalled())
    getWeekEntriesExecute.mockClear()
    await act(async () => {
      await result.current.refresh()
    })
    expect(getWeekEntriesExecute).toHaveBeenCalled()
  })
})
