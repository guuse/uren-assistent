// src/domain/repositories/IHistoryStore.ts
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'

export interface IHistoryStore {
  load(): Promise<void>
  getBlocksForDate(date: string): Promise<ClassifiedBlock[]>
  setBlocksForDate(date: string, blocks: ClassifiedBlock[]): Promise<void>
  removeBlock(date: string, urlPattern: string): Promise<void>
  hasDataForDate(date: string): Promise<boolean>
  hasHistoryForWeek(weekStart: string): Promise<boolean>
}
