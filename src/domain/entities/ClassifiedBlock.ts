// src/domain/entities/ClassifiedBlock.ts
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
