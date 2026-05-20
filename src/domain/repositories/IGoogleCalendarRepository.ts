import type { CalendarEvent } from '../entities/CalendarEvent'

export interface IGoogleCalendarRepository {
  /**
   * Fetch calendar events for the given date range (inclusive).
   * Returns only events the authenticated user accepted or responded as tentative.
   */
  fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>

  /**
   * Returns true if the stored Google token has the calendar.readonly scope.
   */
  hasCalendarScope(): Promise<boolean>
}
