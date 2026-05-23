import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { HourEntry } from '../../domain/entities/HourEntry'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function useSuggestions(selectedDate: string) {
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)
  const [suggestions, setSuggestions] = useState<HourEntrySuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!simplicateEmployeeId || !selectedDate) return

    async function load() {
      setIsLoading(true)
      try {
        const apiKey = await keychainRepo.get('simplicate-api-key')
        const apiSecret = await keychainRepo.get('simplicate-api-secret')
        if (!apiKey || !apiSecret) return
        const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
        const { getWeekEntries, generateSuggestions } = createUseCases(repo)

        const allEntries: HourEntry[] = []
        for (let i = 0; i < 4; i++) {
          const weekStart = addDays(selectedDate, -(28 - i * 7))
          const entries = await getWeekEntries.execute(simplicateEmployeeId!, weekStart)
          allEntries.push(...Object.values(entries).flat())
        }

        const result = generateSuggestions.execute(selectedDate, allEntries)
        setSuggestions(result)
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [selectedDate, simplicateEmployeeId])

  return { suggestions, isLoading }
}
