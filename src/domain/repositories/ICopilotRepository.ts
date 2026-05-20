import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'

export interface Project {
  id: string
  name: string
}

export interface Service {
  id: string
  name: string
  projectId: string
}

export interface ICopilotRepository {
  classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
    calendarEvents?: CalendarEvent[],
  ): Promise<ClassifiedBlock[]>
}
