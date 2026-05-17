import { invoke } from '@tauri-apps/api/core'
import type { IKeychainRepository } from '../../domain/repositories/IKeychainRepository'

export class KeychainRepository implements IKeychainRepository {
  async get(key: string): Promise<string | null> {
    return invoke<string | null>('get_secret', { key })
  }

  async set(key: string, value: string): Promise<void> {
    await invoke('set_secret', { key, value })
  }

  async delete(key: string): Promise<void> {
    await invoke('delete_secret', { key })
  }
}
