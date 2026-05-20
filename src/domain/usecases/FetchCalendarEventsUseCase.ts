import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { CalendarEvent } from '../entities/CalendarEvent'

export class FetchCalendarEventsUseCase {
  constructor(private readonly repo: IGoogleCalendarRepository) {}

  async execute(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const hasScope = await this.repo.hasCalendarScope()
      if (!hasScope) return []
      return await this.repo.fetchEvents(startDate, endDate)
    } catch {
      return []
    }
  }
}
