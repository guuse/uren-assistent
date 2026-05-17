import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { ITemplateRepository } from '../../domain/repositories/ITemplateRepository'
import type { Template } from '../../domain/entities/Template'

const FILENAME = 'templates.json'

export class TemplateStorageRepository implements ITemplateRepository {
  private async filePath(): Promise<string> {
    const dir = await appDataDir()
    return `${dir}/${FILENAME}`
  }

  async getAll(): Promise<Template[]> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      return JSON.parse(raw) as Template[]
    } catch {
      return []
    }
  }

  async save(template: Template): Promise<void> {
    const all = await this.getAll()
    const index = all.findIndex((t) => t.id === template.id)
    if (index >= 0) {
      all[index] = template
    } else {
      all.push(template)
    }
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(all, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAll()
    const filtered = all.filter((t) => t.id !== id)
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(filtered, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
  }
}
