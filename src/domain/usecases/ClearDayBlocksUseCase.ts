import type { IHistoryStore } from '../repositories/IHistoryStore'

export interface ClearDayBlocksResult {
  removedCount: number
}

export class ClearDayBlocksUseCase {
  constructor(private readonly historyStore: IHistoryStore) {}

  async execute(date: string): Promise<ClearDayBlocksResult> {
    const blocks = await this.historyStore.getBlocksForDate(date)
    const llmBlocks = blocks.filter(
      (b) => b.origin === 'llm' || b.origin === 'llm-pattern',
    )
    for (const block of llmBlocks) {
      await this.historyStore.removeBlock(date, block.urlPattern)
    }
    return { removedCount: llmBlocks.length }
  }
}
