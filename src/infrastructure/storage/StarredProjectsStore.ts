import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { IStarredProjectsRepository } from '../../domain/repositories/IStarredProjectsRepository'

const FILENAME = 'starred-projects.json'

interface PersistedData {
  starredIds: string[]
}

export class StarredProjectsStore implements IStarredProjectsRepository {
  private ids: Set<string> = new Set()
  private cachedPath: string | undefined

  private async filePath(): Promise<string> {
    if (!this.cachedPath) {
      const dir = await appDataDir()
      this.cachedPath = `${dir}/${FILENAME}`
    }
    return this.cachedPath
  }

  async load(): Promise<void> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'starredIds' in parsed &&
        Array.isArray((parsed as Record<string, unknown>).starredIds)
      ) {
        this.ids = new Set((parsed as PersistedData).starredIds)
      } else {
        this.ids = new Set()
      }
    } catch {
      this.ids = new Set()
    }
  }

  getStarredIds(): ReadonlySet<string> {
    return this.ids
  }

  async toggle(projectId: string): Promise<void> {
    if (this.ids.has(projectId)) {
      this.ids.delete(projectId)
    } else {
      this.ids.add(projectId)
    }
    await this.persist()
  }

  private async persist(): Promise<void> {
    const path = await this.filePath()
    const data: PersistedData = { starredIds: Array.from(this.ids) }
    await writeTextFile(path, JSON.stringify(data))
  }
}
