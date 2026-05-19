import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { IMappingCacheRepository, CachedMapping } from '../../domain/repositories/IMappingCacheRepository'

const FILENAME = 'mapping-cache.json'

export class MappingCacheRepository implements IMappingCacheRepository {
  private cache: Record<string, CachedMapping> = {}

  private async filePath(): Promise<string> {
    const dir = await appDataDir()
    return `${dir}/${FILENAME}`
  }

  async load(): Promise<void> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      this.cache = JSON.parse(raw) as Record<string, CachedMapping>
    } catch {
      this.cache = {}
    }
  }

  get(urlPattern: string): CachedMapping | undefined {
    return this.cache[urlPattern]
  }

  getAll(): Record<string, CachedMapping> {
    return { ...this.cache }
  }

  async set(urlPattern: string, mapping: CachedMapping): Promise<void> {
    this.cache[urlPattern] = mapping
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(this.cache, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
  }
}
