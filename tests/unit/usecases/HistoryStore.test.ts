// tests/unit/usecases/HistoryStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  BaseDirectory: { AppData: 'AppData' },
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app'),
}))

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { HistoryStore } from '../../../src/infrastructure/storage/HistoryStore'
import type { ClassifiedBlock } from '../../../src/domain/entities/ClassifiedBlock'

function makeBlock(urlPattern: string, date: string): ClassifiedBlock {
  return {
    date,
    urlPattern,
    urls: [],
    titles: [],
    visitCount: 1,
    firstVisitTime: '09:00',
    lastVisitTime: '10:00',
    hours: 1,
    blockName: 'Test',
    summary: 'test',
    startTime: '09:00',
    endTime: '10:00',
    confidence: 0.9,
    origin: 'llm',
  }
}

describe('HistoryStore', () => {
  beforeEach(() => {
    vi.mocked(readTextFile).mockRejectedValue(new Error('not found'))
    vi.mocked(writeTextFile).mockResolvedValue(undefined)
  })

  it('geeft lege array terug voor onbekende datum', async () => {
    const store = new HistoryStore()
    await store.load()
    const blocks = await store.getBlocksForDate('2026-05-21')
    expect(blocks).toEqual([])
  })

  it('slaat blokken op en haalt ze terug', async () => {
    const store = new HistoryStore()
    await store.load()
    const block = makeBlock('github.com', '2026-05-21')
    await store.setBlocksForDate('2026-05-21', [block])
    const blocks = await store.getBlocksForDate('2026-05-21')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.urlPattern).toBe('github.com')
  })

  it('mergt nieuwe blokken met bestaande op basis van urlPattern', async () => {
    const store = new HistoryStore()
    await store.load()
    const block1 = makeBlock('github.com', '2026-05-21')
    const block2 = makeBlock('figma.com', '2026-05-21')
    await store.setBlocksForDate('2026-05-21', [block1])
    await store.setBlocksForDate('2026-05-21', [block2])
    const blocks = await store.getBlocksForDate('2026-05-21')
    expect(blocks).toHaveLength(2)
  })

  it('verwijdert een blok op urlPattern', async () => {
    const store = new HistoryStore()
    await store.load()
    const block = makeBlock('github.com', '2026-05-21')
    await store.setBlocksForDate('2026-05-21', [block])
    await store.removeBlock('2026-05-21', 'github.com')
    const blocks = await store.getBlocksForDate('2026-05-21')
    expect(blocks).toHaveLength(0)
  })

  it('hasDataForDate geeft false terug voor lege datum', async () => {
    const store = new HistoryStore()
    await store.load()
    expect(await store.hasDataForDate('2026-05-21')).toBe(false)
  })

  it('hasDataForDate geeft true terug na setBlocksForDate', async () => {
    const store = new HistoryStore()
    await store.load()
    await store.setBlocksForDate('2026-05-21', [makeBlock('github.com', '2026-05-21')])
    expect(await store.hasDataForDate('2026-05-21')).toBe(true)
  })

  it('laadt bestaande data uit JSON-bestand', async () => {
    const block = makeBlock('github.com', '2026-05-21')
    const stored = { '2026-05-21': [block] }
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(stored))
    const store = new HistoryStore()
    await store.load()
    expect(await store.hasDataForDate('2026-05-21')).toBe(true)
  })
})
