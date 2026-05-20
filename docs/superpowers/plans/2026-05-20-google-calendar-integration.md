# Google Calendar Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch Google Calendar events for the same days as an imported browser history file, display them as bookable blocks in the import review UI, and feed them as context to the AI classifier.

**Architecture:** A new `IGoogleCalendarRepository` / `GoogleCalendarRepository` fetches events from the Google Calendar API using the existing stored access token. A `FetchCalendarEventsUseCase` wraps the fetch and always returns safely (empty array on failure). A `ClassifyCalendarBlocksUseCase` classifies calendar events into bookable `CalendarBlock` entities. `ClassifyHistoryBlocksUseCase` gains an optional `calendarEvents` parameter that enriches the Copilot prompt. The `useImport` hook orchestrates everything; `ImportPage` shows the scope-missing banner if needed.

**Tech Stack:** TypeScript strict, React, Tauri (fetch via standard browser fetch in renderer), Vitest for unit tests, existing Google OAuth token from macOS Keychain.

---

## File Map

| Action | File |
|---|---|
| Create | `src/domain/entities/CalendarEvent.ts` |
| Create | `src/domain/entities/CalendarBlock.ts` |
| Modify | `src/domain/entities/ClassifiedBlock.ts` |
| Create | `src/domain/repositories/IGoogleCalendarRepository.ts` |
| Create | `src/domain/usecases/FetchCalendarEventsUseCase.ts` |
| Create | `src/domain/usecases/ClassifyCalendarBlocksUseCase.ts` |
| Modify | `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts` |
| Modify | `src/infrastructure/copilot/CopilotRepository.ts` |
| Create | `src/infrastructure/googlecalendar/GoogleCalendarRepository.ts` |
| Modify | `src/application/container.ts` |
| Create | `src/ui/hooks/useCalendarEvents.ts` |
| Modify | `src/ui/hooks/useImport.ts` |
| Modify | `src/ui/pages/ImportPage.tsx` |
| Create | `src/domain/usecases/__tests__/FetchCalendarEventsUseCase.test.ts` |
| Create | `src/domain/usecases/__tests__/ClassifyCalendarBlocksUseCase.test.ts` |
| Modify | `src/domain/usecases/__tests__/ClassifyHistoryBlocksUseCase.test.ts` |

---

## Task 1: `CalendarEvent` entity

**Files:**
- Create: `src/domain/entities/CalendarEvent.ts`

- [ ] **Step 1: Create the entity**

```ts
// src/domain/entities/CalendarEvent.ts
export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  attendees: string[]   // email addresses
  status: 'accepted' | 'tentative'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/entities/CalendarEvent.ts
git commit -m "feat: add CalendarEvent domain entity"
```

---

## Task 2: `CalendarBlock` entity

**Files:**
- Create: `src/domain/entities/CalendarBlock.ts`

`CalendarBlock` is a bookable block sourced from a calendar event. It uses `origin: 'calendar'` which is also added to `ClassifiedBlock`.

- [ ] **Step 1: Extend `ClassifiedBlock` origin union**

In `src/domain/entities/ClassifiedBlock.ts`, change line 12:

```ts
// Before:
  origin: 'llm' | 'cache' | 'manual'

// After:
  origin: 'llm' | 'cache' | 'manual' | 'calendar'
  overlappingMeetings?: import('./CalendarEvent').CalendarEvent[]
```

The full file after edit:

```ts
import type { HistoryBlock } from './HistoryBlock'

export interface ClassifiedBlock extends HistoryBlock {
  blockName: string
  summary: string
  startTime: string
  endTime: string
  projectId?: string
  serviceId?: string
  note?: string
  confidence: number
  origin: 'llm' | 'cache' | 'manual' | 'calendar'
  overlappingMeetings?: import('./CalendarEvent').CalendarEvent[]
}
```

- [ ] **Step 2: Create `CalendarBlock`**

```ts
// src/domain/entities/CalendarBlock.ts
import type { CalendarEvent } from './CalendarEvent'
import type { ClassifiedBlock } from './ClassifiedBlock'

/**
 * A bookable block sourced from a Google Calendar event.
 * Extends ClassifiedBlock so it can flow through the same review UI.
 * `urlPattern` is set to `calendar:<eventId>` — a stable synthetic key.
 */
export interface CalendarBlock extends ClassifiedBlock {
  origin: 'calendar'
  calendarEventId: string
}

export function calendarEventToBlock(event: CalendarEvent): CalendarBlock {
  const pad = (n: number) => String(n).padStart(2, '0')
  const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const hours = Math.max(0.5, Math.round(((event.end.getTime() - event.start.getTime()) / 3600000) * 2) / 2)
  const date = event.start.toISOString().slice(0, 10)

  return {
    // HistoryBlock fields
    date,
    urlPattern: `calendar:${event.id}`,
    urls: [],
    titles: [event.title],
    visitCount: 0,
    firstVisitTime: toTime(event.start),
    lastVisitTime: toTime(event.end),
    hours,
    // ClassifiedBlock fields
    blockName: event.title,
    summary: '',
    startTime: toTime(event.start),
    endTime: toTime(event.end),
    confidence: 0,
    origin: 'calendar',
    // CalendarBlock fields
    calendarEventId: event.id,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/entities/CalendarBlock.ts src/domain/entities/ClassifiedBlock.ts
git commit -m "feat: add CalendarBlock entity and extend ClassifiedBlock origin"
```

---

## Task 3: `IGoogleCalendarRepository` interface

**Files:**
- Create: `src/domain/repositories/IGoogleCalendarRepository.ts`

- [ ] **Step 1: Create the interface**

```ts
// src/domain/repositories/IGoogleCalendarRepository.ts
import type { CalendarEvent } from '../entities/CalendarEvent'

export interface IGoogleCalendarRepository {
  /**
   * Fetch calendar events for the given date range (inclusive).
   * Returns only events the authenticated user accepted or responded as tentative.
   */
  fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>

  /**
   * Returns true if the stored Google token has the calendar.readonly scope.
   */
  hasCalendarScope(): Promise<boolean>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/repositories/IGoogleCalendarRepository.ts
git commit -m "feat: add IGoogleCalendarRepository interface"
```

---

## Task 4: `FetchCalendarEventsUseCase` — test first

**Files:**
- Create: `src/domain/usecases/__tests__/FetchCalendarEventsUseCase.test.ts`
- Create: `src/domain/usecases/FetchCalendarEventsUseCase.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/usecases/__tests__/FetchCalendarEventsUseCase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { FetchCalendarEventsUseCase } from '../FetchCalendarEventsUseCase'
import type { IGoogleCalendarRepository } from '../../repositories/IGoogleCalendarRepository'
import type { CalendarEvent } from '../../entities/CalendarEvent'

const start = new Date('2024-03-01T00:00:00')
const end = new Date('2024-03-01T23:59:59')

const mockEvent: CalendarEvent = {
  id: 'evt1',
  title: 'Sprint Planning',
  start: new Date('2024-03-01T10:00:00'),
  end: new Date('2024-03-01T11:00:00'),
  attendees: ['alice@co.nl'],
  status: 'accepted',
}

function makeRepo(overrides?: Partial<IGoogleCalendarRepository>): IGoogleCalendarRepository {
  return {
    fetchEvents: vi.fn().mockResolvedValue([mockEvent]),
    hasCalendarScope: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('FetchCalendarEventsUseCase', () => {
  it('returns events from repository', async () => {
    const repo = makeRepo()
    const uc = new FetchCalendarEventsUseCase(repo)
    const result = await uc.execute(start, end)
    expect(result).toEqual([mockEvent])
    expect(repo.fetchEvents).toHaveBeenCalledWith(start, end)
  })

  it('returns empty array when scope is missing', async () => {
    const repo = makeRepo({ hasCalendarScope: vi.fn().mockResolvedValue(false) })
    const uc = new FetchCalendarEventsUseCase(repo)
    const result = await uc.execute(start, end)
    expect(result).toEqual([])
    expect(repo.fetchEvents).not.toHaveBeenCalled()
  })

  it('returns empty array when fetchEvents throws', async () => {
    const repo = makeRepo({ fetchEvents: vi.fn().mockRejectedValue(new Error('network')) })
    const uc = new FetchCalendarEventsUseCase(repo)
    const result = await uc.execute(start, end)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- FetchCalendarEventsUseCase
```

Expected: FAIL with "Cannot find module '../FetchCalendarEventsUseCase'"

- [ ] **Step 3: Implement the use case**

```ts
// src/domain/usecases/FetchCalendarEventsUseCase.ts
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { CalendarEvent } from '../entities/CalendarEvent'

export class FetchCalendarEventsUseCase {
  constructor(private readonly repo: IGoogleCalendarRepository) {}

  async execute(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const hasScope = await this.repo.hasCalendarScope()
      if (!hasScope) return []
      return await this.repo.fetchEvents(startDate, endDate)
    } catch {
      return []
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- FetchCalendarEventsUseCase
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/usecases/FetchCalendarEventsUseCase.ts src/domain/usecases/__tests__/FetchCalendarEventsUseCase.test.ts
git commit -m "feat: add FetchCalendarEventsUseCase with tests"
```

---

## Task 5: `ClassifyCalendarBlocksUseCase` — test first

**Files:**
- Create: `src/domain/usecases/__tests__/ClassifyCalendarBlocksUseCase.test.ts`
- Create: `src/domain/usecases/ClassifyCalendarBlocksUseCase.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/usecases/__tests__/ClassifyCalendarBlocksUseCase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ClassifyCalendarBlocksUseCase } from '../ClassifyCalendarBlocksUseCase'
import type { CalendarEvent } from '../../entities/CalendarEvent'
import type { Project, Service } from '../../repositories/ICopilotRepository'

const event: CalendarEvent = {
  id: 'evt1',
  title: 'Sprint Planning',
  start: new Date('2024-03-01T10:00:00'),
  end: new Date('2024-03-01T11:00:00'),
  attendees: ['alice@co.nl'],
  status: 'accepted',
}

const projects: Project[] = [{ id: 'p1', name: 'Acme' }]
const services: Service[] = [{ id: 's1', name: 'Development', projectId: 'p1' }]

describe('ClassifyCalendarBlocksUseCase', () => {
  it('returns a CalendarBlock for each event with pre-filled blockName', async () => {
    const classifyMock = vi.fn().mockResolvedValue([
      {
        urlPattern: 'calendar:evt1',
        blockName: 'Sprint Planning',
        summary: 'Sprint planning sessie',
        projectId: 'p1',
        serviceId: 's1',
        note: '',
        confidence: 0.8,
        origin: 'calendar' as const,
        date: '2024-03-01',
        urls: [],
        titles: ['Sprint Planning'],
        visitCount: 0,
        firstVisitTime: '10:00',
        lastVisitTime: '11:00',
        hours: 1,
        startTime: '10:00',
        endTime: '11:00',
      },
    ])
    const copilotRepo = { classify: classifyMock }
    const uc = new ClassifyCalendarBlocksUseCase(copilotRepo as never)
    const result = await uc.execute([event], projects, services)
    expect(result).toHaveLength(1)
    expect(result[0]!.calendarEventId).toBe('evt1')
    expect(result[0]!.origin).toBe('calendar')
    expect(result[0]!.blockName).toBe('Sprint Planning')
  })

  it('returns empty array for empty events input', async () => {
    const copilotRepo = { classify: vi.fn() }
    const uc = new ClassifyCalendarBlocksUseCase(copilotRepo as never)
    const result = await uc.execute([], projects, services)
    expect(result).toEqual([])
    expect(copilotRepo.classify).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- ClassifyCalendarBlocksUseCase
```

Expected: FAIL with "Cannot find module '../ClassifyCalendarBlocksUseCase'"

- [ ] **Step 3: Implement the use case**

```ts
// src/domain/usecases/ClassifyCalendarBlocksUseCase.ts
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { CalendarBlock } from '../entities/CalendarBlock'
import { calendarEventToBlock } from '../entities/CalendarBlock'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'

export class ClassifyCalendarBlocksUseCase {
  constructor(private readonly copilot: ICopilotRepository) {}

  async execute(
    events: CalendarEvent[],
    projects: Project[],
    services: Service[],
  ): Promise<CalendarBlock[]> {
    if (events.length === 0) return []

    // Convert events to HistoryBlock-shaped objects for the classify call
    const asBlocks = events.map(calendarEventToBlock)

    const classified = await this.copilot.classify(asBlocks, projects, services)

    return classified.map((block, idx) => {
      const event = events[idx]!
      return {
        ...block,
        origin: 'calendar' as const,
        calendarEventId: event.id,
        // Ensure time/date always comes from the original event, not LLM
        startTime: asBlocks[idx]!.startTime,
        endTime: asBlocks[idx]!.endTime,
        date: asBlocks[idx]!.date,
        hours: asBlocks[idx]!.hours,
      }
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- ClassifyCalendarBlocksUseCase
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/usecases/ClassifyCalendarBlocksUseCase.ts src/domain/usecases/__tests__/ClassifyCalendarBlocksUseCase.test.ts
git commit -m "feat: add ClassifyCalendarBlocksUseCase with tests"
```

---

## Task 6: Enrich `ClassifyHistoryBlocksUseCase` with calendar context

**Files:**
- Modify: `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts`
- Modify: `src/domain/usecases/__tests__/ClassifyHistoryBlocksUseCase.test.ts` (add calendar context tests)
- Modify: `src/infrastructure/copilot/CopilotRepository.ts` (enrich prompt)

### Part A — update use case

- [ ] **Step 1: Write tests for the calendar context enrichment**

Find the existing test file for `ClassifyHistoryBlocksUseCase` (likely at `src/domain/usecases/__tests__/ClassifyHistoryBlocksUseCase.test.ts`). Add the following test cases:

```ts
// Add these imports at the top of the existing test file:
import type { CalendarEvent } from '../../entities/CalendarEvent'

// Add these test cases inside the existing describe block:
describe('with calendar events', () => {
  const calendarEvents: CalendarEvent[] = [
    {
      id: 'evt1',
      title: 'Sprint Planning',
      start: new Date('2024-03-01T10:00:00'),
      end: new Date('2024-03-01T11:00:00'),
      attendees: ['alice@co.nl'],
      status: 'accepted',
    },
  ]

  it('passes calendarEvents to copilot.classify', async () => {
    // Re-use the existing block fixture from the test file
    // (block with date '2024-03-01', firstVisitTime '10:00', lastVisitTime '10:30')
    // The classify mock should be called with calendarEvents attached
    const classifyMock = vi.fn().mockResolvedValue([/* same classified result as existing tests */])
    const copilot = { classify: classifyMock }
    const cache = { get: vi.fn().mockReturnValue(null), set: vi.fn(), load: vi.fn() }
    const uc = new ClassifyHistoryBlocksUseCase(copilot as never, cache as never)
    await uc.execute([/* existing block fixture */], [], [], calendarEvents)
    expect(classifyMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      calendarEvents,
    )
  })

  it('works without calendarEvents (backward compatible)', async () => {
    const classifyMock = vi.fn().mockResolvedValue([/* same classified result */])
    const copilot = { classify: classifyMock }
    const cache = { get: vi.fn().mockReturnValue(null), set: vi.fn(), load: vi.fn() }
    const uc = new ClassifyHistoryBlocksUseCase(copilot as never, cache as never)
    // No calendarEvents argument — must not throw
    await expect(uc.execute([/* existing block fixture */], [], [])).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- ClassifyHistoryBlocksUseCase
```

Expected: FAIL — the new tests call `execute` with a 4th argument that doesn't exist yet.

- [ ] **Step 3: Update `ClassifyHistoryBlocksUseCase` to accept calendar events**

Replace `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts` with:

```ts
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const totalMinutes = h * 60 + m + Math.round(hours * 60)
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

function getOverlappingMeetings(block: HistoryBlock, events: CalendarEvent[]): CalendarEvent[] {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number) as [number, number]
    return h * 60 + m
  }
  const blockStart = toMinutes(block.firstVisitTime)
  const blockEnd = toMinutes(block.lastVisitTime || addHoursToTime(block.firstVisitTime, block.hours))

  return events.filter(ev => {
    const evDate = ev.start.toISOString().slice(0, 10)
    if (evDate !== block.date) return false
    const pad = (n: number) => String(n).padStart(2, '0')
    const evStart = toMinutes(`${pad(ev.start.getHours())}:${pad(ev.start.getMinutes())}`)
    const evEnd = toMinutes(`${pad(ev.end.getHours())}:${pad(ev.end.getMinutes())}`)
    return evStart < blockEnd && evEnd > blockStart
  })
}

export class ClassifyHistoryBlocksUseCase {
  constructor(
    private copilot: ICopilotRepository,
    private cache: IMappingCacheRepository,
  ) {}

  async execute(
    blocks: HistoryBlock[],
    projects: Project[],
    services: Service[],
    calendarEvents: CalendarEvent[] = [],
  ): Promise<ClassifiedBlock[]> {
    const cacheHits: ClassifiedBlock[] = []
    const needsLLM: HistoryBlock[] = []

    for (const block of blocks) {
      const cached = this.cache.get(block.urlPattern)
      if (cached) {
        cacheHits.push({
          ...block,
          blockName: cached.blockName ?? block.urlPattern,
          summary: cached.summary ?? '',
          startTime: block.firstVisitTime,
          endTime: block.lastVisitTime || addHoursToTime(block.firstVisitTime, block.hours),
          projectId: cached.projectId,
          serviceId: cached.serviceId,
          note: cached.note,
          confidence: 1.0,
          origin: 'cache',
          overlappingMeetings: getOverlappingMeetings(block, calendarEvents),
        })
      } else {
        needsLLM.push(block)
      }
    }

    let llmResults: ClassifiedBlock[] = []
    if (needsLLM.length > 0) {
      // Attach overlapping meetings to each block before sending to LLM
      const blocksWithMeetings = needsLLM.map(b => ({
        ...b,
        overlappingMeetings: getOverlappingMeetings(b, calendarEvents),
      }))
      const raw = await this.copilot.classify(blocksWithMeetings, projects, services, calendarEvents)
      llmResults = raw.map(r => ({
        ...r,
        confidence: Math.min(1, Math.max(0, r.confidence)),
      }))
    }

    const resultMap = new Map<string, ClassifiedBlock>()
    for (const r of [...cacheHits, ...llmResults]) {
      resultMap.set(`${r.date}__${r.urlPattern}`, r)
    }

    return blocks.map(b => resultMap.get(`${b.date}__${b.urlPattern}`)!)
  }
}
```

- [ ] **Step 4: Update `ICopilotRepository` to accept optional calendarEvents**

Replace `src/domain/repositories/ICopilotRepository.ts` with:

```ts
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'

export interface Project {
  id: string
  name: string
}

export interface Service {
  id: string
  name: string
  projectId: string
}

export interface ICopilotRepository {
  classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
    calendarEvents?: CalendarEvent[],
  ): Promise<ClassifiedBlock[]>
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- ClassifyHistoryBlocksUseCase
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/usecases/ClassifyHistoryBlocksUseCase.ts src/domain/repositories/ICopilotRepository.ts src/domain/usecases/__tests__/ClassifyHistoryBlocksUseCase.test.ts
git commit -m "feat: enrich ClassifyHistoryBlocksUseCase with calendar event context"
```

### Part B — enrich the Copilot prompt

- [ ] **Step 7: Update `CopilotRepository` to accept and inject calendar context into the prompt**

Replace `src/infrastructure/copilot/CopilotRepository.ts` with:

```ts
import { invoke } from '@tauri-apps/api/core'
import type { ICopilotRepository, Project, Service } from '../../domain/repositories/ICopilotRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'

interface CopilotChoice {
  message: { content: string }
}

interface CopilotResponse {
  choices: CopilotChoice[]
}

interface LLMBlockResult {
  urlPattern: string
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: number
}

function formatCalendarContext(calendarEvents: CalendarEvent[], blockDate: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

  const dayEvents = calendarEvents.filter(e => e.start.toISOString().slice(0, 10) === blockDate)
  if (dayEvents.length === 0) return ''

  const list = dayEvents
    .map(e => `- ${toTime(e.start)}–${toTime(e.end)} ${e.title}${e.attendees.length > 0 ? ` (${e.attendees.join(', ')})` : ''}`)
    .join('\n')

  return `\n## Today's meetings\n${list}\n`
}

function formatOverlappingMeetings(block: HistoryBlock & { overlappingMeetings?: CalendarEvent[] }): string {
  if (!block.overlappingMeetings || block.overlappingMeetings.length === 0) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const list = block.overlappingMeetings
    .map(e => `- ${toTime(e.start)}–${toTime(e.end)} ${e.title}`)
    .join('\n')
  return `\n  Overlapping meetings:\n${list}`
}

export class CopilotRepository implements ICopilotRepository {
  constructor(private readonly copilotToken: string) {}

  async classify(
    blocks: (HistoryBlock & { overlappingMeetings?: CalendarEvent[] })[],
    availableProjects: Project[],
    availableServices: Service[],
    calendarEvents: CalendarEvent[] = [],
  ): Promise<ClassifiedBlock[]> {
    const projectList = availableProjects
      .map(p => `- id: "${p.id}", name: "${p.name}"`)
      .join('\n')
    const serviceList = availableServices
      .map(s => `- id: "${s.id}", name: "${s.name}", projectId: "${s.projectId}"`)
      .join('\n')
    const blockList = blocks
      .map(b =>
        `- urlPattern: "${b.urlPattern}", urls: [${b.urls.slice(0, 5).map(u => `"${u}"`).join(', ')}], titles: [${b.titles.slice(0, 3).map(t => `"${t}"`).join(', ')}], visitCount: ${b.visitCount}${formatOverlappingMeetings(b)}`
      )
      .join('\n')

    // Use the date of the first block for the calendar context header
    const blockDate = blocks[0]?.date ?? ''
    const calendarContext = formatCalendarContext(calendarEvents, blockDate)

    const prompt = `You are a time-tracking assistant helping a developer record their work hours.

For each browser activity block, you must:
1. Generate a human-readable name (e.g. "Eindhoven Doet — development", "Harborn hosting — beheer")
2. Write a short summary of what was done (max 120 chars, Dutch preferred)
3. Match to a project and service if possible
${calendarContext}
Available projects:
${projectList}

Available services (linked to projects by projectId):
${serviceList}

Browser activity blocks to process:
${blockList}

Return a JSON array. Each item must have:
- urlPattern (string, exact match from input — used as identifier)
- blockName (string, human-readable work block name, max 60 chars)
- summary (string, short description of the work, max 120 chars, Dutch preferred)
- projectId (string | null, must be one of the available project IDs)
- serviceId (string | null, must be a service ID whose projectId matches the chosen project)
- note (string, short booking note, max 80 chars)
- confidence (number 0-1, how confident you are in the project match)

Return ONLY a valid JSON array, no markdown, no explanation.`

    const responseText = await invoke<string>('copilot_request', {
      args: {
        token: this.copilotToken,
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      },
    })

    const data = JSON.parse(responseText) as CopilotResponse
    const raw = data.choices[0]?.message.content ?? '[]'
    const content = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

    let results: LLMBlockResult[]
    try {
      results = JSON.parse(content) as LLMBlockResult[]
    } catch {
      throw new Error('Copilot returned invalid JSON')
    }

    if (!Array.isArray(results)) {
      throw new Error('Copilot returned unexpected response format (not an array)')
    }

    const addHours = (time: string, hours: number): string => {
      const [h, m] = time.split(':').map(Number) as [number, number]
      const total = h * 60 + m + Math.round(hours * 60)
      return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    }

    return blocks.map(block => {
      const match = results.find(r => r.urlPattern === block.urlPattern)
      const classified: ClassifiedBlock = {
        ...block,
        blockName: match?.blockName ?? block.urlPattern,
        summary: match?.summary ?? '',
        startTime: block.firstVisitTime,
        endTime: block.lastVisitTime || addHours(block.firstVisitTime, block.hours),
        confidence: Math.min(1, Math.max(0, match?.confidence ?? 0)),
        origin: 'llm' as const,
      }
      if (match?.projectId) classified.projectId = match.projectId
      if (match?.serviceId) classified.serviceId = match.serviceId
      if (match?.note) classified.note = match.note
      return classified
    })
  }
}
```

- [ ] **Step 8: Run all tests**

```bash
npm run test
```

Expected: All existing tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/infrastructure/copilot/CopilotRepository.ts
git commit -m "feat: inject calendar meeting context into Copilot prompt"
```

---

## Task 7: `GoogleCalendarRepository` infrastructure

**Files:**
- Create: `src/infrastructure/googlecalendar/GoogleCalendarRepository.ts`

- [ ] **Step 1: Create the repository**

```ts
// src/infrastructure/googlecalendar/GoogleCalendarRepository.ts
import type { IGoogleCalendarRepository } from '../../domain/repositories/IGoogleCalendarRepository'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'
import type { IKeychainRepository } from '../../domain/repositories/IKeychainRepository'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const TOKEN_INFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo'
const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

interface GoogleEventAttendee {
  email: string
  self?: boolean
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction'
}

interface GoogleEventDateTime {
  dateTime?: string
  date?: string
}

interface GoogleEvent {
  id: string
  summary?: string
  start: GoogleEventDateTime
  end: GoogleEventDateTime
  attendees?: GoogleEventAttendee[]
  status?: string
}

interface GoogleEventsListResponse {
  items?: GoogleEvent[]
}

export class GoogleCalendarRepository implements IGoogleCalendarRepository {
  constructor(
    private readonly keychain: IKeychainRepository,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async hasCalendarScope(): Promise<boolean> {
    try {
      const token = await this.getValidToken()
      if (!token) return false
      const res = await fetch(`${TOKEN_INFO_URL}?access_token=${encodeURIComponent(token)}`)
      if (!res.ok) return false
      const data = await res.json() as { scope?: string }
      return (data.scope ?? '').includes(CALENDAR_SCOPE)
    } catch {
      return false
    }
  }

  async fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const token = await this.getValidToken()
    if (!token) return []

    const timeMin = new Date(startDate)
    timeMin.setHours(0, 0, 0, 0)
    const timeMax = new Date(endDate)
    timeMax.setHours(23, 59, 59, 999)

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    })

    const res = await fetch(`${CALENDAR_API_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error(`Calendar API error: ${res.status}`)

    const data = await res.json() as GoogleEventsListResponse
    const items = data.items ?? []

    return items
      .filter(ev => this.isAttending(ev))
      .map(ev => this.toCalendarEvent(ev))
      .filter((ev): ev is CalendarEvent => ev !== null)
  }

  private isAttending(ev: GoogleEvent): boolean {
    if (!ev.attendees) return true // solo events have no attendees array
    const self = ev.attendees.find(a => a.self)
    if (!self) return true
    return self.responseStatus === 'accepted' || self.responseStatus === 'tentative'
  }

  private toCalendarEvent(ev: GoogleEvent): CalendarEvent | null {
    const startStr = ev.start.dateTime ?? ev.start.date
    const endStr = ev.end.dateTime ?? ev.end.date
    if (!startStr || !endStr) return null

    const attendees = (ev.attendees ?? [])
      .filter(a => !a.self)
      .map(a => a.email)

    const selfAttendee = (ev.attendees ?? []).find(a => a.self)
    const status = (selfAttendee?.responseStatus === 'tentative' ? 'tentative' : 'accepted') as 'accepted' | 'tentative'

    return {
      id: ev.id,
      title: ev.summary ?? '(geen titel)',
      start: new Date(startStr),
      end: new Date(endStr),
      attendees,
      status,
    }
  }

  private async getValidToken(): Promise<string | null> {
    const token = await this.keychain.get('google-access-token')
    const expiryStr = await this.keychain.get('google-token-expiry')
    if (!token) return null

    const expiry = expiryStr ? Number(expiryStr) : 0
    if (Date.now() < expiry - 60_000) return token

    // Try to refresh
    const refreshToken = await this.keychain.get('google-refresh-token')
    if (!refreshToken) return null

    try {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      })
      if (!res.ok) return null
      const data = await res.json() as { access_token: string; expires_in?: number }
      const newExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
      await this.keychain.set('google-access-token', data.access_token)
      await this.keychain.set('google-token-expiry', String(newExpiry))
      return data.access_token
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/googlecalendar/GoogleCalendarRepository.ts
git commit -m "feat: add GoogleCalendarRepository"
```

---

## Task 8: Wire up in `container.ts` and add OAuth scope

**Files:**
- Modify: `src/application/container.ts`
- Modify: `src/ui/hooks/useAuth.ts`

- [ ] **Step 1: Add calendar factory to container**

Replace `src/application/container.ts` with:

```ts
import { KeychainRepository } from '../infrastructure/keychain/KeychainRepository'
import { SimplicateRepository } from '../infrastructure/simplicate/SimplicateRepository'
import { TemplateStorageRepository } from '../infrastructure/storage/TemplateStorageRepository'
import { MappingCacheRepository } from '../infrastructure/storage/MappingCacheRepository'
import { CopilotRepository } from '../infrastructure/copilot/CopilotRepository'
import { GoogleCalendarRepository } from '../infrastructure/googlecalendar/GoogleCalendarRepository'
import { BookTemplateUseCase } from '../domain/usecases/BookTemplateUseCase'
import { DeleteTemplateUseCase } from '../domain/usecases/DeleteTemplateUseCase'
import { FetchSimplicateDataUseCase } from '../domain/usecases/FetchSimplicateDataUseCase'
import { SaveTemplateUseCase } from '../domain/usecases/SaveTemplateUseCase'
import { ParseBrowserHistoryUseCase } from '../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../domain/usecases/ClassifyHistoryBlocksUseCase'
import { FetchCalendarEventsUseCase } from '../domain/usecases/FetchCalendarEventsUseCase'
import { ClassifyCalendarBlocksUseCase } from '../domain/usecases/ClassifyCalendarBlocksUseCase'
import type { ISimplicateRepository } from '../domain/repositories/ISimplicateRepository'
import type { ICopilotRepository } from '../domain/repositories/ICopilotRepository'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string

// Repositories
export const keychainRepo = new KeychainRepository()
export const templateRepo = new TemplateStorageRepository()
export const mappingCacheRepo = new MappingCacheRepository()

// SimplicateRepository is created lazily after credentials are loaded
export function createSimplicateRepository(baseUrl: string, apiKey: string, apiSecret: string) {
  return new SimplicateRepository(baseUrl, apiKey, apiSecret)
}

export function createCopilotRepository(token: string): ICopilotRepository {
  return new CopilotRepository(token)
}

export function createCalendarRepository() {
  return new GoogleCalendarRepository(keychainRepo, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
}

export function createFetchCalendarEventsUseCase() {
  return new FetchCalendarEventsUseCase(createCalendarRepository())
}

export function createClassifyCalendarBlocksUseCase(copilotRepo: ICopilotRepository) {
  return new ClassifyCalendarBlocksUseCase(copilotRepo)
}

// Use cases (stateless, created with injected repos)
export function createUseCases(simplicateRepo: ISimplicateRepository) {
  return {
    saveTemplate: new SaveTemplateUseCase(templateRepo),
    deleteTemplate: new DeleteTemplateUseCase(templateRepo),
    bookTemplate: new BookTemplateUseCase(simplicateRepo),
    fetchSimplicateData: new FetchSimplicateDataUseCase(simplicateRepo),
    parseBrowserHistory: new ParseBrowserHistoryUseCase(),
    classifyHistoryBlocks: (copilotRepo: ICopilotRepository) =>
      new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo),
  }
}
```

- [ ] **Step 2: Add `calendar.readonly` scope to the OAuth flow**

In `src/ui/hooks/useAuth.ts`, the Tauri `start_google_oauth` command receives `clientId`. The scopes are configured in the Rust command (in `src-tauri/`). Open the Rust file that handles `start_google_oauth` and add `https://www.googleapis.com/auth/calendar.readonly` to the scopes array.

Find the file:
```bash
grep -r "calendar\|scope" src-tauri/src --include="*.rs" -l
grep -r "start_google_oauth" src-tauri/src --include="*.rs" -l
```

In that file, locate the scopes definition (it will look like a Vec or a string with `openid email profile`) and add the calendar scope:

```rust
// Before (example — exact code may differ):
let scopes = "openid email profile";

// After:
let scopes = "openid email profile https://www.googleapis.com/auth/calendar.readonly";
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/application/container.ts src-tauri/src/
git commit -m "feat: wire GoogleCalendarRepository into container, add calendar OAuth scope"
```

---

## Task 9: `useCalendarEvents` hook

**Files:**
- Create: `src/ui/hooks/useCalendarEvents.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/ui/hooks/useCalendarEvents.ts
import { useState, useCallback } from 'react'
import { createCalendarRepository, createFetchCalendarEventsUseCase } from '../../application/container'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'

export interface UseCalendarEventsResult {
  events: CalendarEvent[]
  loading: boolean
  error: string | null
  hasCalendarScope: boolean
  fetch: (startDate: Date, endDate: Date) => Promise<void>
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCalendarScope, setHasCalendarScope] = useState(true)

  const fetch = useCallback(async (startDate: Date, endDate: Date) => {
    setLoading(true)
    setError(null)
    try {
      const calendarRepo = createCalendarRepository()
      const hasScope = await calendarRepo.hasCalendarScope()
      setHasCalendarScope(hasScope)

      if (!hasScope) {
        setEvents([])
        return
      }

      const uc = createFetchCalendarEventsUseCase()
      const result = await uc.execute(startDate, endDate)
      setEvents(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { events, loading, error, hasCalendarScope, fetch }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useCalendarEvents.ts
git commit -m "feat: add useCalendarEvents hook"
```

---

## Task 10: Update `useImport` to orchestrate calendar events

**Files:**
- Modify: `src/ui/hooks/useImport.ts`

- [ ] **Step 1: Update `useImport` to fetch calendar events and classify meetings**

Replace `src/ui/hooks/useImport.ts` with:

```ts
// src/ui/hooks/useImport.ts
import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import {
  mappingCacheRepo,
  createCopilotRepository,
  keychainRepo,
  createSimplicateRepository,
  createCalendarRepository,
  createFetchCalendarEventsUseCase,
  createClassifyCalendarBlocksUseCase,
} from '../../application/container'
import { ParseBrowserHistoryUseCase, ParseError } from '../../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../../domain/usecases/ClassifyHistoryBlocksUseCase'
import { BookTemplateUseCase } from '../../domain/usecases/BookTemplateUseCase'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'
import type { CachedMapping } from '../../domain/repositories/IMappingCacheRepository'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type ImportStatus = 'idle' | 'parsing' | 'classifying' | 'ready' | 'booking' | 'done'

export interface ImportState {
  status: ImportStatus
  error: string | null
  blocks: ClassifiedBlock[]
  minVisits: number
  setMinVisits: (n: number) => void
  analyseFile: (csvContent: string) => Promise<void>
  updateBlock: (index: number, updates: Partial<ClassifiedBlock>) => void
  removeBlock: (index: number) => void
  confirmBlock: (index: number, mapping: CachedMapping) => Promise<void>
  bookAll: () => Promise<void>
  bookingResults: Record<number, 'success' | 'error' | string>
  selectedBlockIndex: number | null
  openBlock: (index: number) => void
  closeBlock: () => void
  fetchServices: (projectId: string) => Promise<{ id: string; name: string }[]>
  hasCalendarScope: boolean
}

export function useImport(): ImportState {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<ClassifiedBlock[]>([])
  const [minVisits, setMinVisits] = useState(3)
  const [bookingResults, setBookingResults] = useState<Record<number, 'success' | 'error' | string>>({})
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null)
  const [hasCalendarScope, setHasCalendarScope] = useState(true)

  const openBlock = useCallback((index: number) => {
    setSelectedBlockIndex(index)
  }, [])

  const closeBlock = useCallback(() => {
    setSelectedBlockIndex(null)
  }, [])

  const fetchServices = useCallback(async (projectId: string) => {
    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    if (!apiKey || !apiSecret) return []
    const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    return simplicateRepo.getServices(projectId)
  }, [])

  const projects = useAppStore(s => s.projects)
  const services = useAppStore(s => s.services)
  const copilotToken = useAppStore(s => s.copilotToken)

  const analyseFile = useCallback(async (csvContent: string) => {
    setError(null)
    setStatus('parsing')
    try {
      await mappingCacheRepo.load()

      const parseUseCase = new ParseBrowserHistoryUseCase()
      const historyBlocks = await parseUseCase.execute(csvContent, minVisits)

      if (historyBlocks.length === 0) {
        setBlocks([])
        setStatus('ready')
        return
      }

      if (projects.length === 0) {
        setError('Laad eerst je projecten via de instellingen.')
        setStatus('idle')
        return
      }

      const token = copilotToken
      if (!token) {
        setError('Stel eerst een GitHub Copilot token in via de instellingen.')
        setStatus('idle')
        return
      }

      // Determine date range from parsed blocks
      const dates = historyBlocks.map(b => b.date).sort()
      const startDate = new Date(dates[0]! + 'T00:00:00')
      const endDate = new Date(dates[dates.length - 1]! + 'T23:59:59')

      // Fetch calendar events in parallel with nothing (no blocking work yet)
      let calendarEvents: CalendarEvent[] = []
      try {
        const calendarRepo = createCalendarRepository()
        const hasScope = await calendarRepo.hasCalendarScope()
        setHasCalendarScope(hasScope)
        if (hasScope) {
          const calendarUc = createFetchCalendarEventsUseCase()
          calendarEvents = await calendarUc.execute(startDate, endDate)
        }
      } catch {
        // Calendar fetch failure must never block the import
        calendarEvents = []
      }

      setStatus('classifying')

      const copilotRepo = createCopilotRepository(token)
      const classifyUseCase = new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo)

      // Classify history blocks (with calendar context injected)
      const classifiedHistory = await classifyUseCase.execute(
        historyBlocks,
        projects,
        services,
        calendarEvents,
      )

      // Classify calendar events as their own bookable blocks
      let calendarBlocks: ClassifiedBlock[] = []
      if (calendarEvents.length > 0) {
        const classifyCalendarUc = createClassifyCalendarBlocksUseCase(copilotRepo)
        calendarBlocks = await classifyCalendarUc.execute(calendarEvents, projects, services)
      }

      // Merge and sort by date + startTime
      const allBlocks = [...classifiedHistory, ...calendarBlocks].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return a.startTime.localeCompare(b.startTime)
      })

      setBlocks(allBlocks)
      setStatus('ready')
    } catch (e) {
      if (e instanceof ParseError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
      setStatus('idle')
    }
  }, [minVisits, projects, services, copilotToken])

  const updateBlock = useCallback((index: number, updates: Partial<ClassifiedBlock>) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...updates } : b))
  }, [])

  const removeBlock = useCallback((index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index))
  }, [])

  const confirmBlock = useCallback(async (index: number, mapping: CachedMapping) => {
    await mappingCacheRepo.set(blocks[index]!.urlPattern, {
      projectId: mapping.projectId,
      serviceId: mapping.serviceId,
      note: mapping.note,
      blockName: blocks[index]!.blockName,
      summary: blocks[index]!.summary,
    })
    updateBlock(index, {
      projectId: mapping.projectId,
      serviceId: mapping.serviceId,
      note: mapping.note,
      origin: 'manual',
      confidence: 1.0,
    })
  }, [blocks, updateBlock])

  const bookAll = useCallback(async () => {
    setStatus('booking')
    const results: Record<number, 'success' | 'error' | string> = {}

    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    const employeeId = await keychainRepo.get('simplicate-employee-id')
    if (!apiKey || !apiSecret || !employeeId) {
      setError('Simplicate credentials niet ingesteld.')
      setStatus('idle')
      return
    }
    const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    const bookTemplate = new BookTemplateUseCase(simplicateRepo)

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!
      if (!block.projectId || !block.serviceId) {
        results[i] = 'Ontbrekende project of dienst'
        continue
      }
      try {
        await bookTemplate.execute({
          template: {
            id: `import-${i}`,
            name: block.blockName,
            type: 'single',
            color: '#6c63ff',
            projectId: block.projectId,
            serviceId: block.serviceId,
            startTime: block.startTime,
            endTime: block.endTime,
          },
          employeeId,
          note: block.note ?? '',
          weekStartDate: block.date,
        })
        results[i] = 'success'
        // Only cache mappings for non-calendar blocks (calendar blocks have synthetic urlPattern)
        if (block.origin !== 'calendar') {
          await mappingCacheRepo.set(block.urlPattern, {
            projectId: block.projectId,
            serviceId: block.serviceId,
            note: block.note ?? '',
            blockName: block.blockName,
            summary: block.summary,
          })
        }
      } catch (e) {
        results[i] = e instanceof Error ? e.message : 'error'
      }
    }

    setBookingResults(results)
    setStatus('done')
  }, [blocks])

  return {
    status,
    error,
    blocks,
    minVisits,
    setMinVisits,
    analyseFile,
    updateBlock,
    removeBlock,
    confirmBlock,
    bookAll,
    bookingResults,
    selectedBlockIndex,
    openBlock,
    closeBlock,
    fetchServices,
    hasCalendarScope,
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useImport.ts
git commit -m "feat: orchestrate calendar events in useImport"
```

---

## Task 11: Update `ImportPage` — calendar scope banner + meeting badge

**Files:**
- Modify: `src/ui/pages/ImportPage.tsx`

- [ ] **Step 1: Add `hasCalendarScope` to destructured values and render the banner + meeting badge**

Replace `src/ui/pages/ImportPage.tsx` with:

```tsx
import { useRef, useState, useMemo } from 'react'
import { useImport } from '../hooks/useImport'
import { useAppStore } from '../../store/appStore'
import ImportBlockModal from '../components/ImportBlockModal'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function blockStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return '#ff6584'
  if (block.origin === 'cache') return '#43b89c'
  if (block.confidence < 0.6) return '#f59e0b'
  return '#43b89c'
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projects = useAppStore(s => s.projects)
  const {
    status, error, blocks, minVisits, setMinVisits,
    analyseFile, updateBlock, removeBlock, bookAll, bookingResults,
    selectedBlockIndex, openBlock, closeBlock, fetchServices,
    hasCalendarScope,
  } = useImport()

  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  async function handleFile(file: File) {
    const text = await file.text()
    await analyseFile(text)
    setSelectedDay(null)
  }

  const isLoading = status === 'parsing' || status === 'classifying' || status === 'booking'

  const dayMap = useMemo(() => {
    const map = new Map<string, number[]>()
    blocks.forEach((b, i) => {
      if (!map.has(b.date)) map.set(b.date, [])
      map.get(b.date)!.push(i)
    })
    return map
  }, [blocks])

  const days = useMemo(() => [...dayMap.keys()].sort(), [dayMap])

  const activeDay = selectedDay && dayMap.has(selectedDay) ? selectedDay : days[0] ?? null
  const dayBlocks = activeDay ? (dayMap.get(activeDay) ?? []).map(i => ({ i, block: blocks[i]! })) : []
  const selectedBlock = selectedBlockIndex !== null ? blocks[selectedBlockIndex] ?? null : null
  const totalReady = blocks.filter(b => b.projectId && b.serviceId).length

  return (
    <div className="flex flex-col h-screen" style={{ background: '#12121e', color: '#ccc' }}>
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: '#2d2d44' }}>
        <h1 className="text-lg font-bold text-white">Importeer browsergeschiedenis</h1>

        <div
          className="flex-1 border-2 border-dashed rounded-lg px-4 py-2 text-center cursor-pointer text-sm transition-colors"
          style={{ borderColor: '#3d3d5c', color: '#888' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          Sleep Chrome history CSV hiernaartoe of klik
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: '#888' }}>Min. bezoeken:</label>
          <input
            type="number"
            min={1}
            value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-14 rounded px-2 py-1 text-sm text-white border"
            style={{ background: '#1a1a2e', borderColor: '#3d3d5c' }}
          />
        </div>

        {blocks.length > 0 && (
          <button
            onClick={bookAll}
            disabled={totalReady === 0 || isLoading || status === 'done'}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: totalReady > 0 && !isLoading ? '#6c63ff' : '#2d2d44',
              color: totalReady > 0 && !isLoading ? '#fff' : '#555',
              cursor: totalReady > 0 && !isLoading ? 'pointer' : 'not-allowed',
            }}
          >
            Boek {totalReady} klaar
          </button>
        )}
      </div>

      {/* Calendar scope banner */}
      {!hasCalendarScope && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-sm flex items-center justify-between" style={{ background: '#1a1a2e', color: '#888', border: '1px solid #3d3d5c' }}>
          <span>Verbind Google Agenda voor rijkere AI-classificatie</span>
          <button
            className="ml-4 px-3 py-1 rounded text-xs font-semibold"
            style={{ background: '#6c63ff', color: '#fff' }}
            onClick={() => window.location.reload()}
          >
            Opnieuw inloggen
          </button>
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-sm" style={{ background: '#2a1a1e', color: '#ff6584', border: '1px solid #4a2a2e' }}>
          {error}
        </div>
      )}
      {isLoading && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-sm" style={{ background: '#1a1a2e', color: '#6c63ff' }}>
          {status === 'parsing' && 'Bezig met analyseren...'}
          {status === 'classifying' && 'Bezig met classificeren via Copilot...'}
          {status === 'booking' && 'Bezig met boeken...'}
        </div>
      )}

      {/* Main content: sidebar + blocks */}
      {blocks.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          {/* Day sidebar */}
          <div className="w-40 flex-none overflow-y-auto p-3 border-r" style={{ borderColor: '#2d2d44' }}>
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: '#555' }}>Dagen</div>
            {days.map(day => {
              const indices = dayMap.get(day) ?? []
              const dayBlks = indices.map(i => blocks[i]!)
              const allBooked = dayBlks.every((_, idx) => bookingResults[indices[idx]!] === 'success')
              const hasUnready = dayBlks.some(b => !b.projectId || !b.serviceId)
              const dotColor = allBooked ? '#43b89c' : hasUnready ? '#ff6584' : '#6c63ff'
              const isActive = day === activeDay
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className="w-full text-left rounded-lg px-3 py-2 mb-1 text-xs transition-colors"
                  style={{
                    background: isActive ? '#6c63ff' : '#1a1a2e',
                    color: isActive ? '#fff' : '#888',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: dotColor }} />
                    <span className="font-medium">{day.slice(5)}</span>
                  </div>
                  <div className="mt-0.5 pl-3" style={{ color: isActive ? '#ccc' : '#555' }}>
                    {indices.length} {indices.length === 1 ? 'blok' : 'blokken'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Blocks for selected day */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeDay && (
              <>
                <div className="text-xs uppercase tracking-wider mb-4" style={{ color: '#555' }}>
                  {activeDay} — {dayBlocks.length} {dayBlocks.length === 1 ? 'blok' : 'blokken'}
                </div>
                <div className="flex flex-col gap-3">
                  {dayBlocks.map(({ i, block }) => {
                    const statusColor = blockStatusColor(block)
                    const result = bookingResults[i]
                    const isMeeting = block.origin === 'calendar'
                    return (
                      <button
                        key={i}
                        onClick={() => openBlock(i)}
                        className="text-left rounded-lg p-4 w-full"
                        style={{ background: '#1e1e32', borderLeft: `3px solid ${statusColor}` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-white text-sm truncate">{block.blockName}</div>
                              {isMeeting && (
                                <span className="text-xs px-1.5 py-0.5 rounded flex-none" style={{ background: '#252550', color: '#a78bfa', fontSize: '10px' }}>
                                  📅 Vergadering
                                </span>
                              )}
                            </div>
                            {block.summary && (
                              <div className="text-xs mt-0.5 truncate" style={{ color: '#888' }}>{block.summary}</div>
                            )}
                          </div>
                          <div className="flex-none text-right">
                            <div className="text-xs font-mono" style={{ color: '#6c63ff' }}>{block.hours}u</div>
                            <div className="text-xs" style={{ color: '#555' }}>{block.startTime}–{block.endTime}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {block.projectId
                            ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#252540', color: '#6c63ff' }}>
                                {projects.find(p => p.id === block.projectId)?.name ?? block.projectId}
                              </span>
                            : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2a1a1e', color: '#ff6584' }}>Geen project</span>
                          }
                          {result === 'success' && (
                            <span className="text-xs" style={{ color: '#43b89c' }}>✓ Geboekt</span>
                          )}
                          {result && result !== 'success' && (
                            <span className="text-xs" style={{ color: '#ff6584' }}>✗ Fout</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {blocks.length === 0 && status === 'ready' && (
        <div className="p-6 text-sm" style={{ color: '#555' }}>
          Geen bruikbare blokken gevonden. Probeer een lagere minimum bezoeken drempel.
        </div>
      )}

      {selectedBlock !== null && selectedBlockIndex !== null && (
        <ImportBlockModal
          key={selectedBlockIndex}
          block={selectedBlock}
          projects={projects}
          fetchServices={fetchServices}
          {...(bookingResults[selectedBlockIndex] !== undefined ? { bookingResult: bookingResults[selectedBlockIndex] } : {})}
          onSave={updates => updateBlock(selectedBlockIndex, updates)}
          onBook={() => void bookAll()}
          onRemove={() => { removeBlock(selectedBlockIndex); closeBlock() }}
          onClose={closeBlock}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck and tests**

```bash
npm run typecheck && npm run test
```

Expected: No errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/ImportPage.tsx
git commit -m "feat: add calendar scope banner and meeting badge to ImportPage"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 4: Final commit if any lint fixes were needed**

```bash
git add -A
git commit -m "fix: lint fixes for Google Calendar integration"
```
