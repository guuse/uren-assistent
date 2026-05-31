// src/infrastructure/storage/HistoryStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  BaseDirectory: { AppData: 'AppData' },
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/tmp/test'),
}))

import { HistoryStore } from './HistoryStore'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = readTextFile as ReturnType<typeof vi.fn>
const mockWrite = writeTextFile as ReturnType<typeof vi.fn>

function makeBlock(overrides: Partial<ClassifiedBlock> = {}): ClassifiedBlock {
  return {
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
    confidence: 4,
    origin: 'llm',
    ...overrides,
  }
}

describe('HistoryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWrite.mockResolvedValue(undefined)
  })

  describe('load', () => {
    it('starts empty when file does not exist', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      expect(await store.getBlocksForDate('2026-05-19')).toEqual([])
    })

    it('starts empty when file contains malformed JSON', async () => {
      mockRead.mockResolvedValue('{ broken')
      const store = new HistoryStore()
      await store.load()
      expect(await store.getBlocksForDate('2026-05-19')).toEqual([])
    })

    it('loads existing blocks from file', async () => {
      mockRead.mockResolvedValue(
        JSON.stringify({ '2026-05-19': [makeBlock({ blockName: 'Loaded' })] }),
      )
      const store = new HistoryStore()
      await store.load()
      const blocks = await store.getBlocksForDate('2026-05-19')
      expect(blocks).toHaveLength(1)
      expect(blocks[0]!.blockName).toBe('Loaded')
    })

    it('rehydrates overlappingMeetings Date objects and clamps confidence', async () => {
      const raw = {
        '2026-05-19': [
          makeBlock({
            confidence: 99 as ClassifiedBlock['confidence'],
            overlappingMeetings: [
              {
                id: 'm1',
                title: 'Standup',
                start: '2026-05-19T09:00:00.000Z' as unknown as Date,
                end: '2026-05-19T09:30:00.000Z' as unknown as Date,
                attendees: ['a@b.com'],
                status: 'accepted',
              },
            ],
          }),
        ],
      }
      mockRead.mockResolvedValue(JSON.stringify(raw))
      const store = new HistoryStore()
      await store.load()
      const block = (await store.getBlocksForDate('2026-05-19'))[0]!
      const meeting = block.overlappingMeetings![0]!
      expect(meeting.start).toBeInstanceOf(Date)
      expect(meeting.end).toBeInstanceOf(Date)
      // confidence clamped to 5
      expect(block.confidence).toBe(5)
    })

    it('leaves blocks without overlappingMeetings untouched while still clamping confidence', async () => {
      const raw = {
        '2026-05-19': [makeBlock({ confidence: 0 as ClassifiedBlock['confidence'] })],
      }
      mockRead.mockResolvedValue(JSON.stringify(raw))
      const store = new HistoryStore()
      await store.load()
      const block = (await store.getBlocksForDate('2026-05-19'))[0]!
      expect(block.overlappingMeetings).toBeUndefined()
      expect(block.confidence).toBe(1)
    })
  })

  describe('getBlocksForDate', () => {
    it('returns empty array for a date with no data', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      expect(await store.getBlocksForDate('2099-01-01')).toEqual([])
    })
  })

  describe('setBlocksForDate', () => {
    it('persists new blocks for a fresh date', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.setBlocksForDate('2026-05-19', [makeBlock()])
      expect(await store.getBlocksForDate('2026-05-19')).toHaveLength(1)
      expect(mockWrite).toHaveBeenCalledOnce()
      const [path, , opts] = mockWrite.mock.calls[0]!
      expect(path).toBe('/tmp/test/history-store.json')
      expect(opts).toEqual({ baseDir: 'AppData' })
    })

    it('caps oversized arrays and includes optional arrays when present', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.setBlocksForDate('2026-05-19', [
        makeBlock({
          urls: Array.from({ length: 30 }, (_, i) => `u${i}`),
          titles: Array.from({ length: 30 }, (_, i) => `t${i}`),
          rawUrls: Array.from({ length: 10 }, (_, i) => `ru${i}`),
          rawTitles: Array.from({ length: 10 }, (_, i) => `rt${i}`),
          commits: Array.from({ length: 60 }, (_, i) => ({
            sha: `s${i}`,
            message: `m${i}`,
            repo: 'owner/repo',
            branch: 'main',
            timestamp: '2026-05-19T09:00:00.000Z',
            time: '09:00',
            date: '2026-05-19',
          })),
          linearIssues: Array.from({ length: 30 }, (_, i) => ({
            identifier: `ID-${i}`,
            title: `Issue ${i}`,
            completedAt: '2026-05-19T09:00:00.000Z',
            url: 'u',
          })),
        }),
      ])
      const block = (await store.getBlocksForDate('2026-05-19'))[0]!
      expect(block.urls).toHaveLength(20)
      expect(block.titles).toHaveLength(20)
      expect(block.rawUrls).toHaveLength(5)
      expect(block.rawTitles).toHaveLength(5)
      expect(block.commits).toHaveLength(50)
      expect(block.linearIssues).toHaveLength(20)
    })

    it('omits optional arrays when absent on the source block', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.setBlocksForDate('2026-05-19', [makeBlock()])
      const block = (await store.getBlocksForDate('2026-05-19'))[0]!
      expect(block.rawUrls).toBeUndefined()
      expect(block.rawTitles).toBeUndefined()
      expect(block.commits).toBeUndefined()
      expect(block.linearIssues).toBeUndefined()
    })

    it('upserts a block with the same urlPattern instead of duplicating', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.setBlocksForDate('2026-05-19', [makeBlock({ blockName: 'first' })])
      await store.setBlocksForDate('2026-05-19', [makeBlock({ blockName: 'second' })])
      const blocks = await store.getBlocksForDate('2026-05-19')
      expect(blocks).toHaveLength(1)
      expect(blocks[0]!.blockName).toBe('second')
    })

    it('appends a block with a different urlPattern', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.setBlocksForDate('2026-05-19', [makeBlock({ urlPattern: 'a.com' })])
      await store.setBlocksForDate('2026-05-19', [makeBlock({ urlPattern: 'b.com' })])
      expect(await store.getBlocksForDate('2026-05-19')).toHaveLength(2)
    })
  })

  describe('removeBlock', () => {
    it('does nothing when the date has no data', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.removeBlock('2026-05-19', 'github.com')
      expect(mockWrite).not.toHaveBeenCalled()
    })

    it('removes a matching block but keeps the date entry when others remain', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.setBlocksForDate('2026-05-19', [
        makeBlock({ urlPattern: 'a.com' }),
        makeBlock({ urlPattern: 'b.com' }),
      ])
      await store.removeBlock('2026-05-19', 'a.com')
      const blocks = await store.getBlocksForDate('2026-05-19')
      expect(blocks).toHaveLength(1)
      expect(blocks[0]!.urlPattern).toBe('b.com')
    })

    it('deletes the date entry when the last block is removed', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.setBlocksForDate('2026-05-19', [makeBlock({ urlPattern: 'a.com' })])
      await store.removeBlock('2026-05-19', 'a.com')
      expect(await store.getBlocksForDate('2026-05-19')).toEqual([])
      expect(await store.hasDataForDate('2026-05-19')).toBe(false)
    })
  })

  describe('hasDataForDate', () => {
    it('returns false when there is no data for the date', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      expect(await store.hasDataForDate('2026-05-19')).toBe(false)
    })

    it('returns true when there is data for the date', async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      const store = new HistoryStore()
      await store.load()
      await store.setBlocksForDate('2026-05-19', [makeBlock()])
      expect(await store.hasDataForDate('2026-05-19')).toBe(true)
    })
  })

  describe('hasHistoryForWeek', () => {
    let store: HistoryStore

    beforeEach(async () => {
      mockRead.mockRejectedValue(new Error('not found'))
      store = new HistoryStore()
      await store.load()
    })

    it('returns false when no data for any day in week', async () => {
      expect(await store.hasHistoryForWeek('2026-05-18')).toBe(false)
    })

    it('returns true when at least one day in week has data', async () => {
      await store.setBlocksForDate('2026-05-19', [makeBlock({ date: '2026-05-19' })])
      expect(await store.hasHistoryForWeek('2026-05-18')).toBe(true)
    })

    it('returns false when data exists for a different week', async () => {
      await store.setBlocksForDate('2026-05-11', [makeBlock({ date: '2026-05-11' })])
      expect(await store.hasHistoryForWeek('2026-05-18')).toBe(false)
    })
  })
})
