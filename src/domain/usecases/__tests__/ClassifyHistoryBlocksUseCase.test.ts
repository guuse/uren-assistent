import { describe, it, expect, vi } from 'vitest'
import { ClassifyHistoryBlocksUseCase } from '../ClassifyHistoryBlocksUseCase'
import type { HistoryBlock } from '../../entities/HistoryBlock'
import type { CalendarEvent } from '../../entities/CalendarEvent'
import type { Project, Service } from '../../repositories/ICopilotRepository'

const baseBlock: HistoryBlock = {
  date: '2024-03-01',
  urlPattern: 'github.com/org/repo',
  urls: ['https://github.com/org/repo'],
  titles: ['org/repo: Pull Request'],
  visitCount: 5,
  firstVisitTime: '10:00',
  lastVisitTime: '11:00',
  hours: 1,
}

const projects: Project[] = [{ id: 'p1', name: 'Acme' }]
const services: Service[] = [{ id: 's1', name: 'Development', projectId: 'p1' }]

const event: CalendarEvent = {
  id: 'evt1',
  title: 'Sprint Planning',
  start: new Date('2024-03-01T10:00:00'),
  end: new Date('2024-03-01T11:00:00'),
  attendees: ['alice@co.nl'],
  status: 'accepted',
}

function makeLLMResult(block: HistoryBlock) {
  return {
    ...block,
    blockName: 'Acme — development',
    summary: 'Werken aan PR',
    startTime: block.firstVisitTime,
    endTime: block.lastVisitTime,
    projectId: 'p1',
    serviceId: 's1',
    note: 'PR review',
    confidence: 0.9,
    origin: 'llm' as const,
  }
}

describe('ClassifyHistoryBlocksUseCase', () => {
  describe('cache hits', () => {
    it('returns cached result without calling LLM', async () => {
      const classifyMock = vi.fn()
      const cacheMock = { get: vi.fn().mockReturnValue({ blockName: 'Cached', summary: 'Cached summary', projectId: 'p1', serviceId: 's1', note: 'note' }) }
      const uc = new ClassifyHistoryBlocksUseCase({ classify: classifyMock } as never, cacheMock as never)
      const result = await uc.execute([baseBlock], projects, services)
      expect(classifyMock).not.toHaveBeenCalled()
      expect(result[0]!.origin).toBe('cache')
      expect(result[0]!.blockName).toBe('Cached')
    })
  })

  describe('LLM classification', () => {
    it('calls copilot.classify for blocks not in cache', async () => {
      const classifyMock = vi.fn().mockResolvedValue([makeLLMResult(baseBlock)])
      const cacheMock = { get: vi.fn().mockReturnValue(undefined) }
      const uc = new ClassifyHistoryBlocksUseCase({ classify: classifyMock } as never, cacheMock as never)
      const result = await uc.execute([baseBlock], projects, services)
      expect(classifyMock).toHaveBeenCalledOnce()
      expect(result[0]!.origin).toBe('llm')
    })

    it('clamps confidence to [0, 1]', async () => {
      const classifyMock = vi.fn().mockResolvedValue([{ ...makeLLMResult(baseBlock), confidence: 1.5 }])
      const cacheMock = { get: vi.fn().mockReturnValue(undefined) }
      const uc = new ClassifyHistoryBlocksUseCase({ classify: classifyMock } as never, cacheMock as never)
      const result = await uc.execute([baseBlock], projects, services)
      expect(result[0]!.confidence).toBe(1)
    })
  })

  describe('with calendar events', () => {
    it('passes calendarEvents as 4th argument to copilot.classify', async () => {
      const classifyMock = vi.fn().mockResolvedValue([makeLLMResult(baseBlock)])
      const cacheMock = { get: vi.fn().mockReturnValue(undefined) }
      const uc = new ClassifyHistoryBlocksUseCase({ classify: classifyMock } as never, cacheMock as never)
      await uc.execute([baseBlock], projects, services, [event])
      expect(classifyMock).toHaveBeenCalledOnce()
      const callArgs = classifyMock.mock.calls[0]!
      // 4th arg is calendarEvents
      expect(callArgs[3]).toEqual([event])
    })

    it('works without calendarEvents (backward compatible)', async () => {
      const classifyMock = vi.fn().mockResolvedValue([makeLLMResult(baseBlock)])
      const cacheMock = { get: vi.fn().mockReturnValue(undefined) }
      const uc = new ClassifyHistoryBlocksUseCase({ classify: classifyMock } as never, cacheMock as never)
      await expect(uc.execute([baseBlock], projects, services)).resolves.toHaveLength(1)
    })

    it('attaches overlapping meeting when block and event share time and date', async () => {
      const classifyMock = vi.fn().mockResolvedValue([makeLLMResult(baseBlock)])
      const cacheMock = { get: vi.fn().mockReturnValue(undefined) }
      const uc = new ClassifyHistoryBlocksUseCase({ classify: classifyMock } as never, cacheMock as never)
      await uc.execute([baseBlock], projects, services, [event])
      // The blocks passed to classify should have overlappingMeetings populated
      const blocksPassedToLLM = classifyMock.mock.calls[0]![0] as (HistoryBlock & { overlappingMeetings?: CalendarEvent[] })[]
      expect(blocksPassedToLLM[0]!.overlappingMeetings).toHaveLength(1)
      expect(blocksPassedToLLM[0]!.overlappingMeetings![0]!.id).toBe('evt1')
    })

    it('does not attach meeting from a different date', async () => {
      const otherDayEvent: CalendarEvent = {
        ...event,
        id: 'evt2',
        start: new Date('2024-03-02T10:00:00'),
        end: new Date('2024-03-02T11:00:00'),
      }
      const classifyMock = vi.fn().mockResolvedValue([makeLLMResult(baseBlock)])
      const cacheMock = { get: vi.fn().mockReturnValue(undefined) }
      const uc = new ClassifyHistoryBlocksUseCase({ classify: classifyMock } as never, cacheMock as never)
      await uc.execute([baseBlock], projects, services, [otherDayEvent])
      const blocksPassedToLLM = classifyMock.mock.calls[0]![0] as (HistoryBlock & { overlappingMeetings?: CalendarEvent[] })[]
      expect(blocksPassedToLLM[0]!.overlappingMeetings).toHaveLength(0)
    })

    it('attaches overlapping meeting to cache hits', async () => {
      const cacheMock = { get: vi.fn().mockReturnValue({ blockName: 'Cached', summary: '', projectId: 'p1', serviceId: 's1' }) }
      const classifyMock = vi.fn()
      const uc = new ClassifyHistoryBlocksUseCase({ classify: classifyMock } as never, cacheMock as never)
      const result = await uc.execute([baseBlock], projects, services, [event])
      expect(result[0]!.overlappingMeetings).toHaveLength(1)
    })
  })
})
