import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { DayContext } from '../entities/DayContext'
import type { HourEntry } from '../entities/HourEntry'

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

export interface PatternBlock {
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: 1 | 2 | 3 | 4 | 5
  estimatedHours: number
  origin: 'llm-pattern'
}

export interface DayClassificationResult {
  index: number
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: 1 | 2 | 3 | 4 | 5
  relatedIssueIds?: string[]  // e.g. ["GMS-4", "SCHP-41"] — LLM-determined relevant Linear issues
  isPatternBlock?: boolean
  estimatedHours?: number
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
    context?: DayContext,
    historicalEntries?: HourEntry[],
  ): Promise<DayClassificationResult[]>
}
