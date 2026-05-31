import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GeminiRepository } from './GeminiRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'
import type { Project, Service, DayItem } from '../../domain/repositories/ICopilotRepository'
import type { DayContext } from '../../domain/entities/DayContext'
import type { HourEntry } from '../../domain/entities/HourEntry'

// Avoid pulling in Tauri fs / ?raw imports; capture the rendered prompt for assertions.
let lastPrompt = ''
vi.mock('./promptStore', () => ({
  loadPromptTemplate: vi.fn(async (name: string) => `TEMPLATE:${name}\n{{sections}}{{calendarContext}}{{projectList}}{{serviceList}}{{date}}{{blockList}}`),
  renderPrompt: vi.fn((template: string, vars: Record<string, string>) => {
    lastPrompt = template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '')
    return lastPrompt
  }),
}))

function geminiOk(text: string) {
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }
}

function block(overrides: Partial<HistoryBlock> = {}): HistoryBlock {
  return {
    date: '2026-05-20',
    urlPattern: 'github.com/foo',
    urls: ['https://github.com/foo/bar?x=1', 'https://github.com/foo/baz', 'not a url'],
    titles: ['Title A', 'Title B', 'Title C', 'Title D'],
    visitCount: 5,
    firstVisitTime: '09:00',
    lastVisitTime: '10:30',
    hours: 1.5,
    ...overrides,
  }
}

const projects: Project[] = [{ id: 'p1', name: 'Proj' }]
const services: Service[] = [
  { id: 's1', name: 'Dev', projectId: 'p1', hourTypes: [{ id: 'ht1', label: 'Normaal' }] },
  { id: 's2', name: 'Ops', projectId: 'p1' },
]

describe('GeminiRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    lastPrompt = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('classify', () => {
    it('matches LLM results onto blocks and applies fallbacks', async () => {
      fetchMock.mockResolvedValueOnce(
        geminiOk(
          '```json\n' +
            JSON.stringify([
              {
                urlPattern: 'github.com/foo',
                blockName: 'Coding',
                summary: 'Worked on foo',
                projectId: 'p1',
                serviceId: 's1',
                note: 'PR review',
                confidence: 4,
              },
            ]) +
            '\n```',
        ),
      )

      const blocks = [block(), block({ urlPattern: 'unmatched.com', lastVisitTime: '' })]
      const repo = new GeminiRepository()
      const result = await repo.classify(blocks, projects, services, [])

      expect(result).toHaveLength(2)
      // matched block keeps LLM fields
      expect(result[0]).toMatchObject({
        blockName: 'Coding',
        summary: 'Worked on foo',
        projectId: 'p1',
        serviceId: 's1',
        note: 'PR review',
        confidence: 4,
        origin: 'llm',
        startTime: '09:00',
        endTime: '10:30',
      })
      // sanitized urls drop query strings; invalid url kept as-is
      expect(result[0]!.rawUrls).toEqual([
        'https://github.com/foo/bar',
        'https://github.com/foo/baz',
        'not a url',
      ])
      // unmatched block: name falls back to urlPattern, endTime computed via addHours
      expect(result[1]!.blockName).toBe('unmatched.com')
      expect(result[1]!.summary).toBe('')
      expect(result[1]!.endTime).toBe('10:30') // 09:00 + 1.5h
      expect(result[1]!.projectId).toBeUndefined()

      // prompt was rendered with the calendar context omitted (no events)
      expect(lastPrompt).toContain('TEMPLATE:classify-blocks')
    })

    it('includes calendar context and overlapping meetings in the prompt', async () => {
      fetchMock.mockResolvedValueOnce(geminiOk('[]'))
      const events: CalendarEvent[] = [
        {
          id: 'c1',
          title: 'Sync',
          start: new Date('2026-05-20T09:00:00'),
          end: new Date('2026-05-20T09:30:00'),
          attendees: ['a@x.com'],
          status: 'accepted',
        },
        {
          id: 'c2',
          title: 'Other day',
          start: new Date('2026-05-19T09:00:00'),
          end: new Date('2026-05-19T09:30:00'),
          attendees: [],
          status: 'accepted',
        },
      ]
      const overlapping: CalendarEvent = {
        id: 'o1',
        title: 'Overlap',
        start: new Date('2026-05-20T09:15:00'),
        end: new Date('2026-05-20T09:45:00'),
        attendees: [],
        status: 'accepted',
      }
      const blocks = [Object.assign(block(), { overlappingMeetings: [overlapping] })]
      const repo = new GeminiRepository()
      await repo.classify(blocks, projects, services, events)

      expect(lastPrompt).toContain("Today's meetings")
      expect(lastPrompt).toContain('Sync (a@x.com)')
      expect(lastPrompt).not.toContain('Other day')
      expect(lastPrompt).toContain('Overlapping meetings')
      expect(lastPrompt).toContain('Overlap')
    })

    it('throws on invalid JSON', async () => {
      fetchMock.mockResolvedValueOnce(geminiOk('not json'))
      const repo = new GeminiRepository()
      await expect(repo.classify([block()], projects, services)).rejects.toThrow('Gemini returned invalid JSON')
    })

    it('throws when result is not an array', async () => {
      fetchMock.mockResolvedValueOnce(geminiOk('{"foo":1}'))
      const repo = new GeminiRepository()
      await expect(repo.classify([block()], projects, services)).rejects.toThrow('not an array')
    })

    it('renders a calendar event without attendees and tolerates empty blocks', async () => {
      fetchMock.mockResolvedValueOnce(geminiOk('[]'))
      const events: CalendarEvent[] = [
        {
          id: 'c1',
          title: 'Solo focus',
          start: new Date('2026-05-20T09:00:00'),
          end: new Date('2026-05-20T09:30:00'),
          attendees: [],
          status: 'accepted',
        },
      ]
      const repo = new GeminiRepository()
      // Empty blocks array -> blockDate falls back to '' (no calendar context),
      // so pass a block that pins the date, plus assert the no-attendees path via a second call.
      const result = await repo.classify([], projects, services, events)
      expect(result).toEqual([])
      // blockDate '' means calendar context omitted
      expect(lastPrompt).not.toContain('Solo focus')

      // Now with a dated block so the event matches the day and the no-attendee branch runs.
      fetchMock.mockResolvedValueOnce(geminiOk('[]'))
      await repo.classify([block()], projects, services, events)
      expect(lastPrompt).toContain('Solo focus')
      expect(lastPrompt).not.toContain('Solo focus (')
    })

    it('handles empty candidates by defaulting to []', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [] }) })
      const repo = new GeminiRepository()
      const result = await repo.classify([block()], projects, services)
      expect(result[0]!.blockName).toBe('github.com/foo')
    })
  })

  describe('callGemini error handling', () => {
    it('throws a quota message on a non-retryable 429 (attempt cap reached)', async () => {
      vi.useFakeTimers()
      // Always 429 with a retryDelay so backoff is short; exhaust the 3 retries.
      fetchMock.mockResolvedValue({
        status: 429,
        ok: false,
        text: async () => '{"retryDelay":"1s"}',
      })
      const repo = new GeminiRepository()
      const promise = repo.classify([block()], projects, services)
      // Attach the rejection handler before advancing timers so the rejection
      // is never unhandled.
      const assertion = expect(promise).rejects.toThrow('Gemini quota uitgeput')
      // Advance through the retry sleeps.
      await vi.runAllTimersAsync()
      await assertion
      // initial + 3 retries = 4 calls
      expect(fetchMock).toHaveBeenCalledTimes(4)
      vi.useRealTimers()
    })

    it('retries on 429 then succeeds, using exponential backoff when no retryDelay', async () => {
      vi.useFakeTimers()
      fetchMock
        .mockResolvedValueOnce({ status: 429, ok: false, text: async () => 'rate limited' })
        .mockResolvedValueOnce(geminiOk('[]'))
      const repo = new GeminiRepository()
      const promise = repo.classify([block()], projects, services)
      await vi.runAllTimersAsync()
      const result = await promise
      expect(result).toHaveLength(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })

    it('throws a generic error on other non-ok statuses', async () => {
      fetchMock.mockResolvedValueOnce({ status: 500, ok: false, text: async () => 'boom' })
      const repo = new GeminiRepository()
      await expect(repo.classify([block()], projects, services)).rejects.toThrow('Gemini API error: 500 — boom')
    })
  })

  describe('classifyDay', () => {
    const meetingEvent: CalendarEvent = {
      id: 'm1',
      title: 'Planning',
      start: new Date('2026-05-20T09:00:00'),
      end: new Date('2026-05-20T10:00:00'),
      attendees: [],
      status: 'accepted',
    }

    it('returns a bare array response directly', async () => {
      fetchMock.mockResolvedValueOnce(
        geminiOk(
          JSON.stringify([
            { index: 0, blockName: 'B', summary: 'S', projectId: 'p1', serviceId: 's1', note: 'n', confidence: 3 },
          ]),
        ),
      )
      const repo = new GeminiRepository()
      const result = await repo.classifyDay('2026-05-20', [], projects, services, {})
      expect(result).toHaveLength(1)
      expect(result[0]!.blockName).toBe('B')
    })

    it('builds all prompt sections and merges blocks with pattern blocks', async () => {
      const items: DayItem[] = [
        { kind: 'meeting', index: 0, event: meetingEvent, historyBlocks: [block()], cacheKey: 'k0' },
        { kind: 'meeting', index: 1, event: { ...meetingEvent, id: 'm2', title: 'Empty mtg' }, historyBlocks: [], cacheKey: 'k1' },
        { kind: 'standalone', index: 2, block: block({ titles: [] }), cacheKey: 'k2' },
      ]
      const context: DayContext = {
        commits: [
          { sha: 'a', message: 'fix things', repo: 'org/repo', branch: 'main', timestamp: '2026-05-20T09:00:00Z', time: '09:00', date: '2026-05-20' },
          { sha: 'b', message: 'other day', repo: 'org/repo', branch: 'main', timestamp: '2026-05-19T09:00:00Z', time: '09:00', date: '2026-05-19' },
        ],
        linearIssues: [{ identifier: 'ENG-1', title: 'Issue', completedAt: '2026-05-20T10:00:00Z', url: 'u' }],
      }
      const historical: HourEntry[] = [
        {
          id: 'h1',
          employeeId: 'e1',
          projectId: 'p1',
          projectServiceId: 's1',
          hourTypeId: 'ht1',
          hours: 1,
          startDate: '2026-05-18',
          startTime: '09:00',
          endTime: '10:00',
          note: 'x'.repeat(60), // exercise note truncation
        },
        {
          id: 'h2',
          employeeId: 'e1',
          projectId: 'unknown-proj',
          projectServiceId: 'unknown-svc',
          hourTypeId: 'ht1',
          hours: 1,
          startDate: '2026-05-17',
          startTime: '11:00',
          endTime: '12:00',
          note: '', // empty note -> no note suffix
        },
      ]
      const existing: HourEntry[] = [
        {
          id: 'b1',
          employeeId: 'e1',
          projectId: 'p1',
          projectServiceId: 's1',
          hourTypeId: 'ht1',
          hours: 2,
          startDate: '2026-05-20',
          startTime: '13:00',
          endTime: '15:00',
          note: 'already booked',
        },
      ]
      const cacheHints = { 'github.com/foo': { projectName: 'Proj', serviceName: 'Dev' } }

      fetchMock.mockResolvedValueOnce(
        geminiOk(
          JSON.stringify({
            blocks: [
              { index: 0, blockName: 'B', summary: 'S', projectId: 'p1', serviceId: 's1', note: 'n', confidence: 3 },
            ],
            patternBlocks: [
              {
                blockName: 'Pattern',
                summary: 'recurring',
                projectId: 'p1',
                serviceId: 's1',
                note: 'pn',
                confidence: 5,
                estimatedHours: 2,
                origin: 'llm-pattern',
              },
              {
                blockName: 'Pattern2',
                summary: 'r2',
                projectId: 'p1',
                serviceId: 's1',
                hourTypeId: 'ht1',
                note: 'pn2',
                confidence: 4,
                estimatedHours: 1,
                origin: 'llm-pattern',
              },
            ],
          }),
        ),
      )

      const repo = new GeminiRepository()
      const result = await repo.classifyDay('2026-05-20', items, projects, services, cacheHints, context, historical, existing)

      expect(result).toHaveLength(3)
      const patterns = result.filter((r) => r.isPatternBlock)
      expect(patterns).toHaveLength(2)
      expect(patterns[0]!.index).toBe(-1000)
      expect(patterns[1]!.index).toBe(-1001)
      expect(patterns[0]!.hourTypeId).toBeNull() // missing hourTypeId -> null
      expect(patterns[1]!.hourTypeId).toBe('ht1')

      // Prompt assembled all sections
      expect(lastPrompt).toContain('Al geboekt vandaag')
      expect(lastPrompt).toContain('Vergaderingen met browser-context')
      expect(lastPrompt).toContain('geen browser-activiteit rondom deze vergadering')
      expect(lastPrompt).toContain('Losse browser-activiteit')
      expect(lastPrompt).toContain('Cache-hints')
      expect(lastPrompt).toContain('GitHub commits (2026-05-20)')
      expect(lastPrompt).not.toContain('other day')
      expect(lastPrompt).toContain('Linear issues')
      expect(lastPrompt).toContain('Historische boekingen')
      expect(lastPrompt).toContain('…') // truncated note
      // service hour types rendered
      expect(lastPrompt).toContain('urensoorten:')
    })

    it('omits optional sections when data is empty', async () => {
      fetchMock.mockResolvedValueOnce(geminiOk(JSON.stringify({ blocks: [] })))
      const repo = new GeminiRepository()
      const result = await repo.classifyDay('2026-05-20', [], projects, services, {}, undefined, [], [])
      expect(result).toEqual([])
      expect(lastPrompt).not.toContain('Cache-hints')
      expect(lastPrompt).not.toContain('Al geboekt vandaag')
      expect(lastPrompt).not.toContain('Historische boekingen')
    })

    it('renders standalone titles, context with no matching day, and booked entries with fallbacks', async () => {
      const items: DayItem[] = [
        { kind: 'standalone', index: 0, block: block({ titles: ['Has Title'] }), cacheKey: 'k0' },
      ]
      // Context present but no commit on this day and no linear issues -> formatDayContext
      // produces no parts and returns ''.
      const context: DayContext = {
        commits: [
          { sha: 'a', message: 'other day', repo: 'org/repo', branch: 'main', timestamp: '2026-05-19T09:00:00Z', time: '09:00', date: '2026-05-19' },
        ],
        linearIssues: [],
      }
      // Booked entry with an unknown project/service id (fallback to id) and another with a note.
      const existing: HourEntry[] = [
        {
          id: 'b1',
          employeeId: 'e1',
          projectId: 'unknown-proj',
          projectServiceId: 'unknown-svc',
          hourTypeId: 'ht1',
          hours: 1,
          startDate: '2026-05-20',
          startTime: '08:00',
          endTime: '09:00',
          note: '', // no note suffix
        },
        {
          id: 'b2',
          employeeId: 'e1',
          projectId: 'p1',
          projectServiceId: 's1',
          hourTypeId: 'ht1',
          hours: 1,
          startDate: '2026-05-20',
          startTime: '10:00',
          endTime: '11:00',
          note: 'with note',
        },
      ]

      fetchMock.mockResolvedValueOnce(geminiOk(JSON.stringify({ blocks: [] })))
      const repo = new GeminiRepository()
      await repo.classifyDay('2026-05-20', items, projects, services, {}, context, undefined, existing)

      expect(lastPrompt).toContain('Titels: "Has Title"')
      // context produced no parts -> no GitHub/Linear headers
      expect(lastPrompt).not.toContain('GitHub commits')
      expect(lastPrompt).not.toContain('Linear issues')
      // booked fallbacks: unknown ids rendered verbatim, note variants
      expect(lastPrompt).toContain('unknown-proj / unknown-svc')
      expect(lastPrompt).toContain('| "with note"')
    })

    it('throws on invalid JSON', async () => {
      fetchMock.mockResolvedValueOnce(geminiOk('garbage'))
      const repo = new GeminiRepository()
      await expect(repo.classifyDay('2026-05-20', [], projects, services, {})).rejects.toThrow(
        'Gemini returned invalid JSON for classifyDay',
      )
    })

    it('throws when blocks is not an array', async () => {
      fetchMock.mockResolvedValueOnce(geminiOk('{"blocks":"nope"}'))
      const repo = new GeminiRepository()
      await expect(repo.classifyDay('2026-05-20', [], projects, services, {})).rejects.toThrow(
        'unexpected format',
      )
    })

    it('defaults patternBlocks to empty when absent', async () => {
      fetchMock.mockResolvedValueOnce(
        geminiOk(JSON.stringify({ blocks: [{ index: 0, blockName: 'B', summary: '', projectId: null, serviceId: null, note: '', confidence: 1 }] })),
      )
      const repo = new GeminiRepository()
      const result = await repo.classifyDay('2026-05-20', [], projects, services, {})
      expect(result).toHaveLength(1)
    })
  })
})
