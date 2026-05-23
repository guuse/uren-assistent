// src/infrastructure/storage/HistoryStore.ts
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { IHistoryStore } from '../../domain/repositories/IHistoryStore'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

const FILENAME = 'history-store.json'

export class HistoryStore implements IHistoryStore {
  private data: Record<string, ClassifiedBlock[]> = {}

  private async filePath(): Promise<string> {
    const dir = await appDataDir()
    return `${dir}/${FILENAME}`
  }

  async load(): Promise<void> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      const parsed = JSON.parse(raw) as Record<string, ClassifiedBlock[]>
      // Rehydrate Date objects in overlappingMeetings (JSON.parse returns strings for Dates)
      for (const blocks of Object.values(parsed)) {
        for (const block of blocks) {
          if (block.overlappingMeetings) {
            block.overlappingMeetings = block.overlappingMeetings.map(m => ({
              ...m,
              start: new Date(m.start),
              end: new Date(m.end),
            }))
          }
        }
      }
      this.data = parsed
    } catch {
      this.data = {}
    }
  }

  private async persist(): Promise<void> {
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(this.data, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
  }

  async getBlocksForDate(date: string): Promise<ClassifiedBlock[]> {
    return this.data[date] ?? []
  }

  async setBlocksForDate(date: string, blocks: ClassifiedBlock[]): Promise<void> {
    const existing = this.data[date] ?? []
    const merged = [...existing]
    for (const block of blocks) {
      // Cap all potentially large arrays before persisting to prevent file bloat.
      // commits and linearIssues are capped (not stripped) so block-level context
      // survives a page reload without re-running "Verwerk week".
      const capped: ClassifiedBlock = {
        ...block,
        urls: block.urls.slice(0, 20),
        titles: block.titles.slice(0, 20),
        ...(block.rawUrls ? { rawUrls: block.rawUrls.slice(0, 5) } : {}),
        ...(block.rawTitles ? { rawTitles: block.rawTitles.slice(0, 5) } : {}),
        ...(block.commits ? { commits: block.commits.slice(0, 50) } : {}),
        ...(block.linearIssues ? { linearIssues: block.linearIssues.slice(0, 20) } : {}),
      }
      const idx = merged.findIndex(b => b.urlPattern === capped.urlPattern)
      if (idx !== -1) {
        merged[idx] = capped
      } else {
        merged.push(capped)
      }
    }
    this.data[date] = merged
    await this.persist()
  }

  async removeBlock(date: string, urlPattern: string): Promise<void> {
    if (!this.data[date]) return
    this.data[date] = this.data[date]!.filter(b => b.urlPattern !== urlPattern)
    if (this.data[date]!.length === 0) delete this.data[date]
    await this.persist()
  }

  async hasDataForDate(date: string): Promise<boolean> {
    return (this.data[date]?.length ?? 0) > 0
  }
}
