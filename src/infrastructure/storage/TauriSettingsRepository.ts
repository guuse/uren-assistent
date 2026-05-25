import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { ISettingsRepository } from '../../domain/repositories/ISettingsRepository'

const FILENAME = 'settings.json'

export class TauriSettingsRepository implements ISettingsRepository {
  private cachedPath: string | undefined

  private async filePath(): Promise<string> {
    if (!this.cachedPath) {
      const dir = await appDataDir()
      this.cachedPath = `${dir}/${FILENAME}`
    }
    return this.cachedPath
  }

  private async readAll(): Promise<Record<string, unknown>> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      return {}
    } catch {
      return {}
    }
  }

  private async writeAll(data: Record<string, unknown>): Promise<void> {
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(data))
  }

  async getSelectedModel(): Promise<string | null> {
    const data = await this.readAll()
    const val = data['copilot_model']
    return typeof val === 'string' ? val : null
  }

  async setSelectedModel(modelId: string): Promise<void> {
    const data = await this.readAll()
    data['copilot_model'] = modelId
    await this.writeAll(data)
  }
}
