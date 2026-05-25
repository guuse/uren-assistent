import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
}))

import { TauriSettingsRepository } from './TauriSettingsRepository'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = readTextFile as ReturnType<typeof vi.fn>
const mockWrite = writeTextFile as ReturnType<typeof vi.fn>

describe('TauriSettingsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWrite.mockResolvedValue(undefined)
  })

  it('returns null when file does not exist', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const repo = new TauriSettingsRepository()
    expect(await repo.getSelectedModel()).toBeNull()
  })

  it('returns null when file has no copilot_model key', async () => {
    mockRead.mockResolvedValue(JSON.stringify({}))
    const repo = new TauriSettingsRepository()
    expect(await repo.getSelectedModel()).toBeNull()
  })

  it('returns stored model id', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ copilot_model: 'claude-sonnet' }))
    const repo = new TauriSettingsRepository()
    expect(await repo.getSelectedModel()).toBe('claude-sonnet')
  })

  it('writes model id to file', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const repo = new TauriSettingsRepository()
    await repo.setSelectedModel('gpt-4o')
    expect(mockWrite).toHaveBeenCalledOnce()
    const written = JSON.parse(mockWrite.mock.calls[0]![1] as string) as unknown
    expect(written).toEqual({ copilot_model: 'gpt-4o' })
  })

  it('merges with existing data when writing', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ other_key: 'value' }))
    const repo = new TauriSettingsRepository()
    await repo.setSelectedModel('gpt-4o')
    const written = JSON.parse(mockWrite.mock.calls[0]![1] as string) as unknown
    expect(written).toEqual({ other_key: 'value', copilot_model: 'gpt-4o' })
  })
})
