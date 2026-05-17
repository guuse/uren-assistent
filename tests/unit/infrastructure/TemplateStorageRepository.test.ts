import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TemplateStorageRepository } from '../../../src/infrastructure/storage/TemplateStorageRepository'
import type { SingleTemplate } from '../../../src/domain/entities/Template'

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

const template: SingleTemplate = {
  id: 'abc-123',
  name: 'Code review',
  type: 'single',
  color: '#63ffb4',
  startTime: '10:00',
  endTime: '11:00',
}

describe('TemplateStorageRepository', () => {
  let repo: TemplateStorageRepository

  beforeEach(() => {
    repo = new TemplateStorageRepository()
    vi.clearAllMocks()
  })

  it('returns empty array when file does not exist', async () => {
    mockRead.mockRejectedValueOnce(new Error('file not found'))
    const result = await repo.getAll()
    expect(result).toEqual([])
  })

  it('returns parsed templates from file', async () => {
    mockRead.mockResolvedValueOnce(JSON.stringify([template]))
    const result = await repo.getAll()
    expect(result).toEqual([template])
  })

  it('saves template by appending to existing list', async () => {
    mockRead.mockResolvedValueOnce(JSON.stringify([]))
    mockWrite.mockResolvedValueOnce(undefined)
    await repo.save(template)
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('templates.json'),
      JSON.stringify([template], null, 2),
      expect.anything(),
    )
  })

  it('deletes template by id', async () => {
    mockRead.mockResolvedValueOnce(JSON.stringify([template]))
    mockWrite.mockResolvedValueOnce(undefined)
    await repo.delete('abc-123')
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('templates.json'),
      JSON.stringify([], null, 2),
      expect.anything(),
    )
  })
})
