import { invoke } from '@tauri-apps/api/core'
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import type { ITemplateRepository } from '../../domain/repositories/ITemplateRepository'
import type { Template } from '../../domain/entities/Template'

const FILENAME = 'templates.json'
const BASE = BaseDirectory.AppData

async function ensureDir() {
  await invoke('ensure_app_data_dir')
}

export class TemplateStorageRepository implements ITemplateRepository {
  async getAll(): Promise<Template[]> {
    try {
      const raw = await readTextFile(FILENAME, { baseDir: BASE })
      return JSON.parse(raw) as Template[]
    } catch {
      return []
    }
  }

  async save(template: Template): Promise<void> {
    await ensureDir()
    const all = await this.getAll()
    const index = all.findIndex((t) => t.id === template.id)
    if (index >= 0) {
      all[index] = template
    } else {
      all.push(template)
    }
    await writeTextFile(FILENAME, JSON.stringify(all, null, 2), { baseDir: BASE })
  }

  async delete(id: string): Promise<void> {
    await ensureDir()
    const all = await this.getAll()
    const filtered = all.filter((t) => t.id !== id)
    await writeTextFile(FILENAME, JSON.stringify(filtered, null, 2), { baseDir: BASE })
  }
}
