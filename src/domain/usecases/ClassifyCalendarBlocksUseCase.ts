import type { CalendarEvent } from '../entities/CalendarEvent'
import type { CalendarBlock } from '../entities/CalendarBlock'
import { calendarEventToBlock } from '../entities/CalendarBlock'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'

export class ClassifyCalendarBlocksUseCase {
  constructor(private readonly copilot: ICopilotRepository) {}

  async execute(
    events: CalendarEvent[],
    projects: Project[],
    services: Service[],
  ): Promise<CalendarBlock[]> {
    if (events.length === 0) return []

    const asBlocks = events.map(calendarEventToBlock)

    const classified = await this.copilot.classify(asBlocks, projects, services)

    return classified.map((block, idx) => {
      const event = events[idx]!
      return {
        ...block,
        origin: 'calendar' as const,
        calendarEventId: event.id,
        startTime: asBlocks[idx]!.startTime,
        endTime: asBlocks[idx]!.endTime,
        date: asBlocks[idx]!.date,
        hours: asBlocks[idx]!.hours,
      }
    })
  }
}
