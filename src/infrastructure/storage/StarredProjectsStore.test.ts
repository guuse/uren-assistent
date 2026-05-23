import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Tauri APIs before importing the store
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
}))

import { StarredProjectsStore } from './StarredProjectsStore'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = readTextFile as ReturnType<typeof vi.fn>
const mockWrite = writeTextFile as ReturnType<typeof vi.fn>

describe('StarredProjectsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWrite.mockResolvedValue(undefined)
  })

  it('laadt lege set als bestand niet bestaat', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const store = new StarredProjectsStore()
    await store.load()
    expect(store.getStarredIds().size).toBe(0)
  })

  it('laadt gestarrde IDs uit bestand', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ starredIds: ['p1', 'p2'] }))
    const store = new StarredProjectsStore()
    await store.load()
    expect(store.getStarredIds().has('p1')).toBe(true)
    expect(store.getStarredIds().has('p2')).toBe(true)
  })

  it('toggle voegt toe als nog niet gestarred', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const store = new StarredProjectsStore()
    await store.load()
    await store.toggle('p1')
    expect(store.getStarredIds().has('p1')).toBe(true)
    expect(mockWrite).toHaveBeenCalledOnce()
  })

  it('toggle verwijdert als al gestarred', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ starredIds: ['p1'] }))
    const store = new StarredProjectsStore()
    await store.load()
    await store.toggle('p1')
    expect(store.getStarredIds().has('p1')).toBe(false)
    expect(mockWrite).toHaveBeenCalledOnce()
  })

  it('schrijft correct JSON-formaat na toggle', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const store = new StarredProjectsStore()
    await store.load()
    await store.toggle('p42')
    const written = JSON.parse((mockWrite as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string) as unknown
    expect(written).toEqual({ starredIds: ['p42'] })
  })
})
