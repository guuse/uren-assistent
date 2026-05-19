import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MappingCacheRepository } from '../../../src/infrastructure/storage/MappingCacheRepository'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  BaseDirectory: { AppData: 'AppData' },
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app-data'),
}))

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = vi.mocked(readTextFile)
const mockWrite = vi.mocked(writeTextFile)

describe('MappingCacheRepository', () => {
  let repo: MappingCacheRepository

  beforeEach(async () => {
    vi.clearAllMocks()
    repo = new MappingCacheRepository()
  })

  it('returns undefined for unknown pattern when file does not exist', async () => {
    mockRead.mockRejectedValueOnce(new Error('file not found'))
    await repo.load()
    expect(repo.get('github.com/org/repo')).toBeUndefined()
  })

  it('returns cached mapping for known pattern', async () => {
    const cache = {
      'github.com/org/repo': { projectId: 'p1', serviceId: 's1', note: 'Dev work' },
    }
    mockRead.mockResolvedValueOnce(JSON.stringify(cache))
    await repo.load()
    expect(repo.get('github.com/org/repo')).toEqual({ projectId: 'p1', serviceId: 's1', note: 'Dev work' })
  })

  it('returns empty cache for corrupt JSON file', async () => {
    mockRead.mockResolvedValueOnce('not valid json {{{{')
    await repo.load()
    expect(repo.getAll()).toEqual({})
  })

  it('persists new mapping to file', async () => {
    mockRead.mockRejectedValueOnce(new Error('file not found'))
    mockWrite.mockResolvedValueOnce(undefined)
    await repo.load()
    await repo.set('github.com/org/repo', { projectId: 'p1', serviceId: 's1', note: 'Dev' })
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('mapping-cache.json'),
      expect.stringContaining('github.com/org/repo'),
      expect.anything(),
    )
  })

  it('getAll returns all cached entries', async () => {
    const cache = {
      'github.com/org/a': { projectId: 'p1', serviceId: 's1', note: 'A' },
      'github.com/org/b': { projectId: 'p2', serviceId: 's2', note: 'B' },
    }
    mockRead.mockResolvedValueOnce(JSON.stringify(cache))
    await repo.load()
    expect(Object.keys(repo.getAll())).toHaveLength(2)
  })
})
