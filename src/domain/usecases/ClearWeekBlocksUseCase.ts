import type { IHistoryStore } from '../repositories/IHistoryStore'

export interface ClearWeekBlocksResult {
  removedCount: number
  removedByDate: Record<string, number>
}

export class ClearWeekBlocksUseCase {
  constructor(private readonly historyStore: IHistoryStore) {}

  async execute(weekDays: string[]): Promise<ClearWeekBlocksResult> {
    let removedCount = 0
    const removedByDate: Record<string, number> = {}

    for (const date of weekDays) {
      const blocks = await this.historyStore.getBlocksForDate(date)
      const llmBlocks = blocks.filter(
        (b) => b.origin === 'llm' || b.origin === 'llm-pattern',
      )
      for (const block of llmBlocks) {
        await this.historyStore.removeBlock(date, block.urlPattern)
      }
      removedByDate[date] = llmBlocks.length
      removedCount += llmBlocks.length
    }

    return { removedCount, removedByDate }
  }
}
