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

export type DayItem =
  | {
      kind: 'meeting'
      index: number
      event: CalendarEvent
      historyBlocks: HistoryBlock[]
      cacheKey: string
    }
  | {
      kind: 'standalone'
      index: number
      block: HistoryBlock
      cacheKey: string
    }

export interface DayClassificationResult {
  index: number
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: number
}

export interface ICopilotRepository {
  classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
    calendarEvents?: CalendarEvent[],
  ): Promise<ClassifiedBlock[]>

  classifyDay(
    date: string,
    items: DayItem[],
    availableProjects: Project[],
    availableServices: Service[],
    cacheHints: Record<string, { projectName: string; serviceName: string }>,
  ): Promise<DayClassificationResult[]>
}
