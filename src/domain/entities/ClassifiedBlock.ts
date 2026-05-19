import type { HistoryBlock } from './HistoryBlock'

export type ClassificationOrigin = 'cache' | 'llm' | 'manual'

export interface ClassifiedBlock extends HistoryBlock {
  startTime: string   // HH:mm — equals firstVisitTime initially
  endTime: string     // HH:mm — startTime + hours
  projectId?: string
  serviceId?: string
  note?: string
  confidence: number  // 0-1; <0.6 = uncertain
  origin: ClassificationOrigin
}

export function createClassifiedBlock(data: ClassifiedBlock): ClassifiedBlock {
  if (data.confidence < 0 || data.confidence > 1) {
    throw new Error(`confidence must be between 0 and 1, got ${data.confidence}`)
  }
  return data
}
