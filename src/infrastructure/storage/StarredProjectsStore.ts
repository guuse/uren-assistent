import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { IStarredProjectsRepository } from '../../domain/repositories/IStarredProjectsRepository'

const FILENAME = 'starred-projects.json'

interface PersistedData {
  starredIds: string[]
}

export class StarredProjectsStore implements IStarredProjectsRepository {
  private ids: Set<string> = new Set()

  private async filePath(): Promise<string> {
    const dir = await appDataDir()
    return `${dir}/${FILENAME}`
  }

  async load(): Promise<void> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      const parsed = JSON.parse(raw) as PersistedData
      this.ids = new Set(parsed.starredIds)
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
