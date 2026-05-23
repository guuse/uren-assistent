import { describe, it, expect, vi } from 'vitest'
import { GroupAndClassifyDayUseCase } from './GroupAndClassifyDayUseCase'
import type { ICopilotRepository, Project, Service, DayClassificationResult } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { DayContext } from '../entities/DayContext'

const makeBlock = (overrides: Partial<HistoryBlock> = {}): HistoryBlock => ({
  date: '2024-01-15',
  urlPattern: 'github.com/org/repo',
  urls: ['https://github.com/org/repo'],
  titles: ['GitHub'],
  visitCount: 5,
  firstVisitTime: '09:00',
  lastVisitTime: '09:30',
  hours: 0.5,
  ...overrides,
})

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'evt-1',
  title: 'Standup',
  start: new Date('2024-01-15T10:00:00'),
  end: new Date('2024-01-15T10:30:00'),
  attendees: [],
  status: 'accepted',
  ...overrides,
})

const makeResult = (index: number, overrides: Partial<DayClassificationResult> = {}): DayClassificationResult => ({
  index,
  blockName: 'My Block',
  summary: 'A summary',
  projectId: 'proj-1',
  serviceId: 'svc-1',
  note: 'note',
  confidence: 0.9,
  ...overrides,
})

const projects: Project[] = [{ id: 'proj-1', name: 'Project One' }]
const services: Service[] = [{ id: 'svc-1', name: 'Service One', projectId: 'proj-1' }]

function makeDeps(cacheAll: Record<string, { projectId: string; serviceId: string; note: string; blockName?: string; summary?: string }> = {}, classifyDayResults: DayClassificationResult[] = []) {
  const copilotRepo: ICopilotRepository = {
    classify: vi.fn(),
    classifyDay: vi.fn().mockResolvedValue(classifyDayResults),
  }
  const cacheRepo: IMappingCacheRepository = {
    get: vi.fn(),
    set: vi.fn(),
    getAll: vi.fn().mockReturnValue(cacheAll),
  }
  return { copilotRepo, cacheRepo }
}

describe('GroupAndClassifyDayUseCase', () => {
  it('cache path — standalone block with cache hit skips LLM, returns origin cache', async () => {
    const block = makeBlock({ urlPattern: 'github.com/org/repo' })
    const cache = {
      'github.com/org/repo': { projectId: 'proj-1', serviceId: 'svc-1', note: 'cached note', blockName: 'Cached Block', summary: 'Cached summary' },
    }
    const { copilotRepo, cacheRepo } = makeDeps(cache, [])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [])

    expect(copilotRepo.classifyDay).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]!.origin).toBe('cache')
    expect(result[0]!.projectId).toBe('proj-1')
    expect(result[0]!.blockName).toBe('Cached Block')
  })

  it('LLM path — standalone block with no cache hit calls classifyDay, returns origin llm', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [])

    expect(copilotRepo.classifyDay).toHaveBeenCalledOnce()
    expect(result).toHaveLength(1)
    expect(result[0]!.origin).toBe('llm')
  })

  it('meeting always goes to LLM even with matching cache key', async () => {
    const block = makeBlock({ urlPattern: 'zoom.us', firstVisitTime: '10:00', lastVisitTime: '10:30' })
    const event = makeEvent({ title: 'Standup' })
    // cacheKey for meeting with this block would be "Standup:zoom.us"
    const cache = {
      'Standup:zoom.us': { projectId: 'proj-1', serviceId: 'svc-1', note: 'cached', blockName: 'Meeting Block', summary: 'Meeting summary' },
    }
    const { copilotRepo, cacheRepo } = makeDeps(cache, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [event])

    expect(copilotRepo.classifyDay).toHaveBeenCalledOnce()
    expect(result).toHaveLength(1)
    expect(result[0]!.origin).toBe('llm')
  })

  it('solo meeting (no history blocks) — cacheKey is title:_solo, calls classifyDay', async () => {
    const event = makeEvent({ title: 'All Hands' })
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [], [event])

    expect(copilotRepo.classifyDay).toHaveBeenCalledOnce()
    const items = (copilotRepo.classifyDay as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { cacheKey: string }[]
    expect(items[0]!.cacheKey).toBe('All Hands:_solo')
    expect(result).toHaveLength(1)
    expect(result[0]!.origin).toBe('llm')
  })

  it('sort order — output sorted by startTime ascending', async () => {
    const blockA = makeBlock({ urlPattern: 'a.com', firstVisitTime: '14:00', lastVisitTime: '14:30' })
    const blockB = makeBlock({ urlPattern: 'b.com', firstVisitTime: '09:00', lastVisitTime: '09:30' })
    const { copilotRepo, cacheRepo } = makeDeps({}, [
      makeResult(0, { blockName: 'Block A' }),
      makeResult(1, { blockName: 'Block B' }),
    ])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [blockA, blockB], [])

    expect(result[0]!.startTime).toBe('09:00')
    expect(result[1]!.startTime).toBe('14:00')  })

  it('mixed day — one cache hit (standalone), one LLM (meeting), both in result', async () => {
    const standaloneBlock = makeBlock({ urlPattern: 'docs.example.com', firstVisitTime: '08:00', lastVisitTime: '08:30' })
    const meetingBlock = makeBlock({ urlPattern: 'zoom.us', firstVisitTime: '10:00', lastVisitTime: '10:30' })
    const event = makeEvent({ title: 'Sync', start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T10:30:00') })
    const cache = {
      'docs.example.com': { projectId: 'proj-1', serviceId: 'svc-1', note: 'cached', blockName: 'Docs Block', summary: 'docs summary' },
    }
    const { copilotRepo, cacheRepo } = makeDeps(cache, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [standaloneBlock, meetingBlock], [event])

    expect(result).toHaveLength(2)
    const cacheItem = result.find(r => r.origin === 'cache')
    const llmItem = result.find(r => r.origin === 'llm')
    expect(cacheItem).toBeDefined()
    expect(llmItem).toBeDefined()
    expect(copilotRepo.classifyDay).toHaveBeenCalledOnce()
  })

  it('uses the highest-visitCount block urlPattern in the meeting cacheKey', async () => {
    const lowBlock = makeBlock({ urlPattern: 'low.com', visitCount: 2, firstVisitTime: '10:05', lastVisitTime: '10:10' })
    const highBlock = makeBlock({ urlPattern: 'dominant.com', visitCount: 5, firstVisitTime: '10:15', lastVisitTime: '10:25' })
    const event = makeEvent({ title: 'Standup', start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T10:30:00') })
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    await useCase.execute('2024-01-15', [lowBlock, highBlock], [event])

    const calledItems = (copilotRepo.classifyDay as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { kind: string; cacheKey: string }[]
    const meetingItem = calledItems.find(i => i.kind === 'meeting')!
    expect(meetingItem.cacheKey).toBe('Standup:dominant.com')
  })

  it('accepts optional DayContext without crashing on empty day', async () => {
    const context: DayContext = {
      commits: [{ sha: 'abc', message: 'feat: ESC close', repo: 'guuse/uren', branch: 'main', timestamp: '2026-05-20T10:00:00Z', time: '10:00', date: '2026-05-20' }],
      linearIssues: [{ identifier: 'ENG-42', title: 'Booking modal', completedAt: '2026-05-20T14:00:00Z', url: 'https://linear.app/eng/issue/ENG-42' }],
    }
    const { copilotRepo, cacheRepo } = makeDeps({}, [])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2026-05-20', [], [], context)
    expect(result).toEqual([])
  })
})
