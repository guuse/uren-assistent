import { describe, it, expect, vi } from 'vitest'
import { CopilotRepository } from './CopilotRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify([{
          urlPattern: 'github.com',
          blockName: 'GitHub — review',
          summary: 'Code review',
          projectId: 'proj-1',
          serviceId: 'svc-1',
          note: 'review',
          confidence: 4,
        }]),
      },
    }],
  })),
}))

const block: HistoryBlock = {
  urlPattern: 'github.com',
  urls: [
    'https://github.com/org/repo/pull/42?tab=files#diff',
    'https://github.com/org/repo/pull/42',
  ],
  titles: [
    'Files changed · Pull Request #42 · org/repo',
    'Pull Request #42 · org/repo',
    'Some very long title that exceeds eighty characters and should be truncated by the evidence panel',
  ],
  visitCount: 5,
  hours: 1,
  date: '2026-05-21',
  firstVisitTime: '09:00',
  lastVisitTime: '10:00',
}

describe('CopilotRepository.classify', () => {
  it('sets rawUrls as sanitized URLs (no query/fragment), max 5', async () => {
    const repo = new CopilotRepository('test-token')
    const results = await repo.classify([block], [], [], [])
    const first = results[0]
    expect(first).toBeDefined()
    expect(first!.rawUrls).toEqual([
      'https://github.com/org/repo/pull/42',
      'https://github.com/org/repo/pull/42',
    ])
  })

  it('sets rawTitles from block.titles, max 5', async () => {
    const repo = new CopilotRepository('test-token')
    const results = await repo.classify([block], [], [], [])
    const first = results[0]
    expect(first).toBeDefined()
    expect(first!.rawTitles).toHaveLength(3)
    expect(first!.rawTitles![0]).toBe('Files changed · Pull Request #42 · org/repo')
  })
})
