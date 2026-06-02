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
  confidence: 4,
  ...overrides,
})

const projects: Project[] = [{ id: 'proj-1', name: 'Project One' }]
const services: Service[] = [
  { id: 'svc-1', name: 'Service One', projectId: 'proj-1' },
  { id: 'svc-2', name: 'Service Two', projectId: 'proj-1' },
]

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

  it('still emits a meeting block when the LLM omits it (calendar is guaranteed)', async () => {
    const event = makeEvent({ title: 'Sprint review' })
    // LLM returns no results at all — the meeting must not vanish.
    const { copilotRepo, cacheRepo } = makeDeps({}, [])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [], [event])

    expect(result).toHaveLength(1)
    expect(result[0]!.blockName).toBe('Sprint review') // falls back to the event title
    expect(result[0]!.overlappingMeetings).toHaveLength(1)
    expect(result[0]!.projectId).toBeUndefined() // unclassified — user fills it in
  })

  it('falls back to the cached mapping for a meeting the LLM omits', async () => {
    const event = makeEvent({ title: 'All Hands' })
    const cacheAll = { 'All Hands:_solo': { projectId: 'proj-1', serviceId: 'svc-1', note: 'wekelijks' } }
    const { copilotRepo, cacheRepo } = makeDeps(cacheAll, [])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [], [event])

    expect(result).toHaveLength(1)
    expect(result[0]!.projectId).toBe('proj-1')
    expect(result[0]!.serviceId).toBe('svc-1')
  })

  it('consolidates two standalone blocks on the same project+service into one', async () => {
    const blockA = makeBlock({ urlPattern: 'github.com/org/repo@09:00', firstVisitTime: '09:00', lastVisitTime: '10:00', hours: 1 })
    const blockB = makeBlock({ urlPattern: 'github.com/org/repo@14:00', firstVisitTime: '14:00', lastVisitTime: '15:00', hours: 1 })
    const { copilotRepo, cacheRepo } = makeDeps({}, [
      makeResult(0, { blockName: 'PR A', serviceId: 'svc-1' }),
      makeResult(1, { blockName: 'PR B', serviceId: 'svc-1' }),
    ])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [blockA, blockB], [])

    expect(result).toHaveLength(1)
    expect(result[0]!.hours).toBe(2)
    expect(result[0]!.firstVisitTime).toBe('09:00')
    expect(result[0]!.lastVisitTime).toBe('15:00')
  })

  it('sort order — output sorted by startTime ascending', async () => {
    const blockA = makeBlock({ urlPattern: 'a.com', firstVisitTime: '14:00', lastVisitTime: '14:30' })
    const blockB = makeBlock({ urlPattern: 'b.com', firstVisitTime: '09:00', lastVisitTime: '09:30' })
    // Distinct services so consolidation keeps them as two separate blocks.
    const { copilotRepo, cacheRepo } = makeDeps({}, [
      makeResult(0, { blockName: 'Block A', serviceId: 'svc-1' }),
      makeResult(1, { blockName: 'Block B', serviceId: 'svc-2' }),
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

  it('fills hourTypeId from the LLM when it is valid for the chosen service', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    const svc: Service[] = [{ id: 'svc-1', name: 'S', projectId: 'proj-1', hourTypes: [{ id: 'ht-1', label: 'A' }, { id: 'ht-2', label: 'B' }] }]
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0, { hourTypeId: 'ht-2' })])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, svc)
    const result = await useCase.execute('2024-01-15', [block], [])
    expect(result[0]!.hourTypeId).toBe('ht-2')
  })

  it('falls back to the service first hour type when the LLM omits or picks an invalid one', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    const svc: Service[] = [{ id: 'svc-1', name: 'S', projectId: 'proj-1', hourTypes: [{ id: 'ht-1', label: 'A' }, { id: 'ht-2', label: 'B' }] }]
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0, { hourTypeId: 'does-not-exist' })])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, svc)
    const result = await useCase.execute('2024-01-15', [block], [])
    expect(result[0]!.hourTypeId).toBe('ht-1')
  })

  it('accepts optional DayContext without crashing on empty day', async () => {
    const context: DayContext = {
      commits: [{ sha: 'abc', message: 'feat: ESC close', repo: 'octocat/uren', branch: 'main', timestamp: '2026-05-20T10:00:00Z', time: '10:00', date: '2026-05-20' }],
      linearIssues: [{ identifier: 'ENG-42', title: 'Booking modal', completedAt: '2026-05-20T14:00:00Z', url: 'https://linear.app/eng/issue/ENG-42' }],
    }
    const { copilotRepo, cacheRepo } = makeDeps({}, [])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2026-05-20', [], [], context)
    expect(result).toEqual([])
  })

  it('meeting block forwards commits and filters linear issues by LLM relatedIssueIds', async () => {
    const block = makeBlock({ urlPattern: 'zoom.us', firstVisitTime: '10:00', lastVisitTime: '10:30' })
    const event = makeEvent({ title: 'Sync', start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T11:00:00') })
    const context: DayContext = {
      commits: [{ sha: 'c1', message: 'feat: x', repo: 'octocat/uren', branch: 'main', timestamp: '2024-01-15T10:00:00Z', time: '10:00', date: '2024-01-15' }],
      linearIssues: [
        { identifier: 'ENG-1', title: 'A', completedAt: '2024-01-15T12:00:00Z', url: 'u1' },
        { identifier: 'ENG-2', title: 'B', completedAt: '2024-01-15T12:00:00Z', url: 'u2' },
      ],
    }
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0, { relatedIssueIds: ['ENG-2'] })])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [event], context)
    expect(result).toHaveLength(1)
    expect(result[0]!.commits).toHaveLength(1)
    expect(result[0]!.linearIssues!.map(i => i.identifier)).toEqual(['ENG-2'])
    expect(result[0]!.hours).toBe(1)
  })

  it('meeting block keeps all linear issues when LLM gives no relatedIssueIds', async () => {
    const block = makeBlock({ urlPattern: 'meet.google.com', firstVisitTime: '10:00', lastVisitTime: '10:30' })
    const event = makeEvent({ title: 'Sync', start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T10:30:00') })
    const context: DayContext = {
      commits: [],
      linearIssues: [{ identifier: 'ENG-1', title: 'A', completedAt: '2024-01-15T12:00:00Z', url: 'u1' }],
    }
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [event], context)
    expect(result[0]!.linearIssues!.map(i => i.identifier)).toEqual(['ENG-1'])
  })

  it('commit-block (github.com) filters commits to the repo + time window', async () => {
    const block = makeBlock({
      urlPattern: 'github.com/octocat/uren@10:00',
      titles: ['feat: x'],
      firstVisitTime: '10:00',
      lastVisitTime: '11:00',
    })
    const context: DayContext = {
      commits: [
        { sha: 'c1', message: 'in window', repo: 'octocat/uren', branch: 'main', timestamp: '', time: '10:30', date: '2024-01-15' },
        { sha: 'c2', message: 'out of window', repo: 'octocat/uren', branch: 'main', timestamp: '', time: '12:00', date: '2024-01-15' },
        { sha: 'c3', message: 'other repo', repo: 'octocat/other', branch: 'main', timestamp: '', time: '10:30', date: '2024-01-15' },
      ],
      linearIssues: [],
    }
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [], context)
    expect(result[0]!.commits!.map(c => c.sha)).toEqual(['c1'])
  })

  it('commit-block falls back to explicit Linear refs in commit titles', async () => {
    const block = makeBlock({
      urlPattern: 'github.com/octocat/uren@10:00',
      titles: ['fix: ENG-2 thing'],
      firstVisitTime: '10:00',
      lastVisitTime: '11:00',
    })
    const context: DayContext = {
      commits: [{ sha: 'c1', message: 'fix: ENG-2 thing', repo: 'octocat/uren', branch: 'main', timestamp: '', time: '10:30', date: '2024-01-15' }],
      linearIssues: [
        { identifier: 'ENG-1', title: 'A', completedAt: '2024-01-15T12:00:00Z', url: 'u1' },
        { identifier: 'ENG-2', title: 'B', completedAt: '2024-01-15T12:00:00Z', url: 'u2' },
      ],
    }
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [], context)
    expect(result[0]!.linearIssues!.map(i => i.identifier)).toEqual(['ENG-2'])
  })

  it('commit-block with no LLM link and no explicit refs gets an empty linear list', async () => {
    const block = makeBlock({
      urlPattern: 'github.com/octocat/uren@10:00',
      titles: ['chore: no refs here'],
      firstVisitTime: '10:00',
      lastVisitTime: '11:00',
    })
    const context: DayContext = {
      commits: [{ sha: 'c1', message: 'chore', repo: 'octocat/uren', branch: 'main', timestamp: '', time: '10:30', date: '2024-01-15' }],
      linearIssues: [{ identifier: 'ENG-1', title: 'A', completedAt: '2024-01-15T12:00:00Z', url: 'u1' }],
    }
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [], context)
    expect(result[0]!.linearIssues).toEqual([])
  })

  it('standalone block uses LLM relatedIssueIds to pick linear issues', async () => {
    const block = makeBlock({ urlPattern: 'docs.example.com', firstVisitTime: '13:00', lastVisitTime: '13:30' })
    const context: DayContext = {
      commits: [],
      linearIssues: [
        { identifier: 'ENG-1', title: 'A', completedAt: '2024-01-15T12:00:00Z', url: 'u1' },
        { identifier: 'ENG-9', title: 'B', completedAt: '2024-01-15T12:00:00Z', url: 'u2' },
      ],
    }
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0, { relatedIssueIds: ['ENG-9'] })])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [], context)
    expect(result[0]!.linearIssues!.map(i => i.identifier)).toEqual(['ENG-9'])
  })

  it('pattern block (isPatternBlock) becomes an llm-pattern block', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    const { copilotRepo, cacheRepo } = makeDeps({}, [
      makeResult(0, { serviceId: 'svc-other' }),
      makeResult(99, {
        isPatternBlock: true,
        blockName: 'Daily standup',
        estimatedHours: 2,
        projectId: 'proj-1',
        serviceId: 'svc-1',
        hourTypeId: null,
      }),
    ])
    const svc: Service[] = [{ id: 'svc-1', name: 'S', projectId: 'proj-1', hourTypes: [{ id: 'ht-1', label: 'A' }] }]
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, svc)
    const result = await useCase.execute('2024-01-15', [block], [])
    const pattern = result.find(r => r.origin === 'llm-pattern')!
    expect(pattern).toBeDefined()
    expect(pattern.blockName).toBe('Daily standup')
    expect(pattern.hours).toBe(2)
    expect(pattern.hourTypeId).toBe('ht-1')
  })

  it('dedupes a pattern block whose project+service is already covered by an llm result', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    const { copilotRepo, cacheRepo } = makeDeps({}, [
      makeResult(0, { projectId: 'proj-1', serviceId: 'svc-1' }),
      makeResult(99, {
        isPatternBlock: true,
        blockName: 'dup pattern',
        estimatedHours: 1,
        projectId: 'proj-1',
        serviceId: 'svc-1',
      }),
    ])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [])
    expect(result.find(r => r.origin === 'llm-pattern')).toBeUndefined()
    expect(result).toHaveLength(1)
  })

  it('pattern block with null project/service falls back to defaults and is kept', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    const { copilotRepo, cacheRepo } = makeDeps({}, [
      makeResult(99, {
        isPatternBlock: true,
        blockName: 'unscoped pattern',
        projectId: null,
        serviceId: null,
      }),
    ])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [])
    const pattern = result.find(r => r.origin === 'llm-pattern')!
    expect(pattern.projectId).toBeUndefined()
    expect(pattern.hours).toBe(1)
  })

  it('drops an LLM result whose index matches no item', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0), makeResult(5)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [])
    expect(result).toHaveLength(1)
  })

  it('meeting result sets hourTypeId from the chosen service and sanitizes invalid raw urls', async () => {
    // Block carries a non-URL string so sanitizeUrl hits its catch branch.
    const block = makeBlock({ urlPattern: 'meet.google.com', urls: ['::not a url::'], firstVisitTime: '10:00', lastVisitTime: '10:30' })
    const event = makeEvent({ title: 'Sync', start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T11:00:00') })
    const svc: Service[] = [{ id: 'svc-1', name: 'S', projectId: 'proj-1', hourTypes: [{ id: 'ht-1', label: 'A' }] }]
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0, { hourTypeId: 'ht-1' })])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, svc)
    const result = await useCase.execute('2024-01-15', [block], [event])
    expect(result[0]!.hourTypeId).toBe('ht-1')
    expect(result[0]!.rawUrls).toContain('::not a url::')
  })

  it('cache hint resolves project and service names for known cache entries', async () => {
    const block = makeBlock({ urlPattern: 'example.com' })
    // Cache entry for a *meeting* key won't be used directly (meetings go to LLM),
    // but builds a cacheHint passed to classifyDay.
    const cache = { 'Standup:example.com': { projectId: 'proj-1', serviceId: 'svc-1', note: 'n' } }
    const event = makeEvent({ title: 'Standup', start: new Date('2024-01-15T09:00:00'), end: new Date('2024-01-15T09:30:00') })
    const { copilotRepo, cacheRepo } = makeDeps(cache, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    await useCase.execute('2024-01-15', [block], [event])
    const hints = (copilotRepo.classifyDay as ReturnType<typeof vi.fn>).mock.calls[0]![4] as Record<string, { projectName: string }>
    expect(hints['Standup:example.com']!.projectName).toBe('Project One')
  })

  it('cache hint falls back to empty names when project/service are unknown', async () => {
    const block = makeBlock({ urlPattern: 'unknown-site.com' })
    const cache = { 'unknown-site.com': { projectId: 'missing-p', serviceId: 'missing-s', note: 'n' } }
    const { copilotRepo, cacheRepo } = makeDeps(cache, [])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [])
    // No LLM items left (the only item was a cache hit) — classifyDay not called.
    expect(copilotRepo.classifyDay).not.toHaveBeenCalled()
    expect(result[0]!.origin).toBe('cache')
  })

  it('cache standalone forwards commits and linear issues from the context', async () => {
    const block = makeBlock({ urlPattern: 'docs.site.com' })
    const cache = { 'docs.site.com': { projectId: 'proj-1', serviceId: 'svc-1', note: 'n' } }
    const svc: Service[] = [{ id: 'svc-1', name: 'S', projectId: 'proj-1', hourTypes: [{ id: 'ht-1', label: 'A' }] }]
    const context: DayContext = {
      commits: [{ sha: 'c1', message: 'm', repo: 'octocat/uren', branch: 'main', timestamp: '', time: '10:00', date: '2024-01-15' }],
      linearIssues: [{ identifier: 'ENG-1', title: 'A', completedAt: '2024-01-15T12:00:00Z', url: 'u' }],
    }
    const { copilotRepo, cacheRepo } = makeDeps(cache, [])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, svc)
    const result = await useCase.execute('2024-01-15', [block], [], context)
    expect(result[0]!.origin).toBe('cache')
    expect(result[0]!.hourTypeId).toBe('ht-1')
    expect(result[0]!.commits).toHaveLength(1)
    expect(result[0]!.linearIssues).toHaveLength(1)
  })

  it('cache standalone without hour types and without context omits those fields', async () => {
    const block = makeBlock({ urlPattern: 'plain.com' })
    const cache = { 'plain.com': { projectId: 'proj-1', serviceId: 'svc-1', note: 'n' } }
    // services has no hourTypes → resolveHourTypeId returns undefined → hourTypeId omitted
    const { copilotRepo, cacheRepo } = makeDeps(cache, [])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [])
    expect(result[0]!.hourTypeId).toBeUndefined()
    expect(result[0]!.commits).toBeUndefined()
    expect(result[0]!.linearIssues).toBeUndefined()
  })

  it('meeting result with null project and service leaves them unset', async () => {
    const block = makeBlock({ urlPattern: 'meet.com', firstVisitTime: '10:00', lastVisitTime: '10:30' })
    const event = makeEvent({ title: 'Sync', start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T10:30:00') })
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0, { projectId: null, serviceId: null })])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [event])
    expect(result[0]!.projectId).toBeUndefined()
    expect(result[0]!.serviceId).toBeUndefined()
    expect(result[0]!.hourTypeId).toBeUndefined()
  })

  it('standalone non-commit block with null project/service leaves them unset', async () => {
    const block = makeBlock({ urlPattern: 'plain-llm.com' })
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0, { projectId: null, serviceId: null })])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    const result = await useCase.execute('2024-01-15', [block], [])
    expect(result[0]!.projectId).toBeUndefined()
    expect(result[0]!.serviceId).toBeUndefined()
  })

  it('reduce picks the first block when none has a higher visit count', async () => {
    // Two blocks with equal visit counts attached to one meeting — first stays dominant.
    const b1 = makeBlock({ urlPattern: 'first.com', visitCount: 3, firstVisitTime: '10:00', lastVisitTime: '10:10' })
    const b2 = makeBlock({ urlPattern: 'second.com', visitCount: 3, firstVisitTime: '10:15', lastVisitTime: '10:25' })
    const event = makeEvent({ title: 'Standup', start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T10:30:00') })
    const { copilotRepo, cacheRepo } = makeDeps({}, [makeResult(0)])
    const useCase = new GroupAndClassifyDayUseCase(copilotRepo, cacheRepo, projects, services)
    await useCase.execute('2024-01-15', [b1, b2], [event])
    const items = (copilotRepo.classifyDay as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { cacheKey: string }[]
    expect(items[0]!.cacheKey).toBe('Standup:first.com')
  })
})
