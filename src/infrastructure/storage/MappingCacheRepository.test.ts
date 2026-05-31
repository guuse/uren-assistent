import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  BaseDirectory: { AppData: 'AppData' },
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
}))

import { MappingCacheRepository } from './MappingCacheRepository'
import type { CachedMapping } from '../../domain/repositories/IMappingCacheRepository'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = readTextFile as ReturnType<typeof vi.fn>
const mockWrite = writeTextFile as ReturnType<typeof vi.fn>

const mapping = (overrides: Partial<CachedMapping> = {}): CachedMapping => ({
  projectId: 'proj-1',
  serviceId: 'svc-1',
  note: 'some note',
  ...overrides,
})

describe('MappingCacheRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWrite.mockResolvedValue(undefined)
  })

  it('loads empty cache when file does not exist', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const repo = new MappingCacheRepository()
    await repo.load()
    expect(repo.getAll()).toEqual({})
    expect(repo.get('anything')).toBeUndefined()
  })

  it('loads empty cache when file contains malformed JSON', async () => {
    mockRead.mockResolvedValue('{ not valid json')
    const repo = new MappingCacheRepository()
    await repo.load()
    expect(repo.getAll()).toEqual({})
  })

  it('loads existing mappings from file', async () => {
    mockRead.mockResolvedValue(
      JSON.stringify({ 'github.com': mapping({ blockName: 'GitHub', summary: 'code' }) }),
    )
    const repo = new MappingCacheRepository()
    await repo.load()
    const got = repo.get('github.com')
    expect(got).toEqual(mapping({ blockName: 'GitHub', summary: 'code' }))
  })

  it('get returns undefined for unknown pattern', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ 'github.com': mapping() }))
    const repo = new MappingCacheRepository()
    await repo.load()
    expect(repo.get('unknown.com')).toBeUndefined()
  })

  it('getAll returns a shallow copy, not the internal reference', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ 'a.com': mapping() }))
    const repo = new MappingCacheRepository()
    await repo.load()
    const all = repo.getAll()
    all['b.com'] = mapping({ projectId: 'mutated' })
    expect(repo.get('b.com')).toBeUndefined()
  })

  it('set stores mapping and persists to file', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const repo = new MappingCacheRepository()
    await repo.load()
    await repo.set('gitlab.com', mapping({ projectId: 'p9' }))
    expect(repo.get('gitlab.com')).toEqual(mapping({ projectId: 'p9' }))
    expect(mockWrite).toHaveBeenCalledOnce()
    const [path, contents, opts] = mockWrite.mock.calls[0]!
    expect(path).toBe('/mock/app/data/mapping-cache.json')
    expect(JSON.parse(contents as string)).toEqual({ 'gitlab.com': mapping({ projectId: 'p9' }) })
    expect(opts).toEqual({ baseDir: 'AppData' })
  })

  it('set overwrites an existing mapping for the same pattern', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ 'a.com': mapping({ note: 'old' }) }))
    const repo = new MappingCacheRepository()
    await repo.load()
    await repo.set('a.com', mapping({ note: 'new' }))
    expect(repo.get('a.com')).toEqual(mapping({ note: 'new' }))
  })
})
