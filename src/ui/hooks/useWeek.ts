import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { HourEntry } from '../../domain/entities/HourEntry'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]!
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

export function useWeek() {
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)

  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() =>
    getMondayOf(new Date()),
  )
  const [selectedDate, setSelectedDate] = useState<string>(todayString)
  const [entriesByDate, setEntriesByDate] = useState<Record<string, HourEntry[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    if (!simplicateEmployeeId) return
    setIsLoading(true)
    setError(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')
      const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { getWeekEntries } = createUseCases(repo)
      const result = await getWeekEntries.execute(simplicateEmployeeId, selectedWeekStart)
      setEntriesByDate(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden mislukt')
    } finally {
      setIsLoading(false)
    }
  }, [simplicateEmployeeId, selectedWeekStart])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  function prevWeek() {
    setSelectedWeekStart((w) => addDays(w, -7))
  }

  function nextWeek() {
    setSelectedWeekStart((w) => addDays(w, 7))
  }

  const weekDays = [0, 1, 2, 3, 4].map((i) => addDays(selectedWeekStart, i))

  function hoursForDate(date: string): number {
    return (entriesByDate[date] ?? []).reduce((sum, e) => sum + e.hours, 0)
  }

  return {
    selectedWeekStart,
    selectedDate,
    selectDate: setSelectedDate,
    entriesByDate,
    weekDays,
    hoursForDate,
    isLoading,
    error,
    prevWeek,
    nextWeek,
    refresh: loadEntries,
  }
}
