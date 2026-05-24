// src/infrastructure/storage/HistoryStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HistoryStore } from './HistoryStore'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn().mockRejectedValue(new Error('not found')),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  BaseDirectory: { AppData: 'AppData' },
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/tmp/test'),
}))

describe('HistoryStore.hasHistoryForWeek', () => {
  let store: HistoryStore

  beforeEach(async () => {
    store = new HistoryStore()
    await store.load()
  })

  it('returns false when no data for any day in week', async () => {
    const result = await store.hasHistoryForWeek('2026-05-18')
    expect(result).toBe(false)
  })

  it('returns true when at least one day in week has data', async () => {
    await store.setBlocksForDate('2026-05-19', [{
      urlPattern: 'github.com',
      blockName: 'GitHub',
      summary: 'test',
      urls: [],
      titles: [],
      visitCount: 1,
      startTime: '09:00',
      endTime: '10:00',
      firstVisitTime: '09:00',
      lastVisitTime: '10:00',
      hours: 1,
      date: '2026-05-19',
      confidence: 0.9,
      origin: 'llm',
    }])
    const result = await store.hasHistoryForWeek('2026-05-18')
    expect(result).toBe(true)
  })

  it('returns false when data exists for a different week', async () => {
    await store.setBlocksForDate('2026-05-11', [{
      urlPattern: 'github.com',
      blockName: 'GitHub',
      summary: 'test',
      urls: [],
      titles: [],
      visitCount: 1,
      startTime: '09:00',
      endTime: '10:00',
      firstVisitTime: '09:00',
      lastVisitTime: '10:00',
      hours: 1,
      date: '2026-05-11',
      confidence: 0.9,
      origin: 'llm',
    }])
    const result = await store.hasHistoryForWeek('2026-05-18')
    expect(result).toBe(false)
  })
})
