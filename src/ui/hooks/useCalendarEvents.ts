// src/ui/hooks/useCalendarEvents.ts
import { useState, useCallback } from 'react'
import { createCalendarRepository, createFetchCalendarEventsUseCase } from '../../application/container'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'

export interface UseCalendarEventsResult {
  events: CalendarEvent[]
  loading: boolean
  error: string | null
  hasCalendarScope: boolean
  fetch: (startDate: Date, endDate: Date) => Promise<void>
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCalendarScope, setHasCalendarScope] = useState(true)

  const fetch = useCallback(async (startDate: Date, endDate: Date) => {
    setLoading(true)
    setError(null)
    try {
      const calendarRepo = createCalendarRepository()
      const hasScope = await calendarRepo.hasCalendarScope()
      setHasCalendarScope(hasScope)

      if (!hasScope) {
        setEvents([])
        return
      }

      const uc = createFetchCalendarEventsUseCase()
      const result = await uc.execute(startDate, endDate)
      setEvents(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { events, loading, error, hasCalendarScope, fetch }
}
