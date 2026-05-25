import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWeek } from './useWeek'

// Mock Tauri IPC en dependencies
vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(() => 'employee-1'),
}))
vi.mock('../../application/container', () => ({
  keychainRepo: { get: vi.fn().mockResolvedValue('key') },
  createSimplicateRepository: vi.fn(),
  createUseCases: vi.fn(() => ({
    getWeekEntries: { execute: vi.fn().mockResolvedValue({}) },
  })),
}))

describe('useWeek', () => {
  it('isCurrentWeek is true wanneer selectedWeekStart de maandag van deze week is', () => {
    const { result } = renderHook(() => useWeek())
    expect(result.current.isCurrentWeek).toBe(true)
  })

  it('isCurrentWeek is false na prevWeek()', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.prevWeek() })
    expect(result.current.isCurrentWeek).toBe(false)
  })

  it('goToCurrentWeek reset selectedWeekStart naar maandag van huidige week', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.prevWeek() })
    expect(result.current.isCurrentWeek).toBe(false)
    act(() => { result.current.goToCurrentWeek() })
    expect(result.current.isCurrentWeek).toBe(true)
  })

  it('goToCurrentWeek zet selectedDate op maandag van huidige week', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.prevWeek() })
    act(() => { result.current.goToCurrentWeek() })
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    today.setDate(today.getDate() + diff)
    const expectedMonday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    expect(result.current.selectedDate).toBe(expectedMonday)
  })

  describe('goToDate', () => {
    it('zet selectedDate op de opgegeven datum', () => {
      const { result } = renderHook(() => useWeek())
      act(() => { result.current.goToDate('2024-05-08') })
      expect(result.current.selectedDate).toBe('2024-05-08')
    })

    it('zet selectedWeekStart op de maandag van de opgegeven datum', () => {
      const { result } = renderHook(() => useWeek())
      act(() => { result.current.goToDate('2024-05-08') }) // woensdag
      expect(result.current.selectedWeekStart).toBe('2024-05-06') // maandag
    })

    it('zet selectedWeekStart correct voor een maandag', () => {
      const { result } = renderHook(() => useWeek())
      act(() => { result.current.goToDate('2024-05-06') }) // maandag
      expect(result.current.selectedWeekStart).toBe('2024-05-06')
    })
  })
})
