# Meeting-Centric Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate history+calendar LLM pipelines with a single meeting-centric pipeline where browser activity is summarised in the context of the meeting it surrounded.

**Architecture:** A new `GroupAndClassifyDayUseCase` claims history blocks by proximity to calendar events, then sends one coherent day prompt to the LLM. Meeting-anchored blocks use the calendar event's duration. Standalone blocks (no nearby meeting) are unchanged.

**Tech Stack:** TypeScript strict, Vitest, existing `ICopilotRepository` / `IMappingCacheRepository` interfaces, Tauri IPC via `invoke('copilot_request')`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/domain/usecases/attachHistoryToMeetings.ts` | **Create** | Pure grouping logic — no I/O, easy to unit test |
| `src/domain/usecases/attachHistoryToMeetings.test.ts` | **Create** | Unit tests for grouping edge cases |
| `src/domain/usecases/GroupAndClassifyDayUseCase.ts` | **Create** | Orchestrates cache lookup + LLM call per day |
| `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts` | **Create** | Unit tests — cache path, LLM path, mixed day |
| `src/domain/repositories/ICopilotRepository.ts` | **Modify** | Add `classifyDay()` method |
| `src/infrastructure/copilot/CopilotRepository.ts` | **Modify** | Implement `classifyDay()` with new prompt format + cache hints |
| `src/ui/hooks/useImport.ts` | **Modify** | Replace dual classify calls with `GroupAndClassifyDayUseCase` |

---

## Task 1: Pure grouping function `attachHistoryToMeetings`

**Files:**
- Create: `src/domain/usecases/attachHistoryToMeetings.ts`
- Create: `src/domain/usecases/attachHistoryToMeetings.test.ts`

### Types used in this task

```typescript
// MeetingGroup — internal intermediate type
export interface MeetingGroup {
  event: CalendarEvent        // the calendar event as anchor
  historyBlocks: HistoryBlock[] // claimed history blocks (may be empty)
}
```

### Grouping algorithm

A history block's time window is `[firstVisitTime, lastVisitTime]` in HH:mm on the same `date`.  
A calendar event's window is `[event.start, event.end]` (Date objects — use `.getHours()/.getMinutes()`).  
`ATTACH_MINUTES = 15`.

A block is **attachable** to an event if:
```
blockStartMinutes < eventEndMinutes + ATTACH_MINUTES
AND
blockEndMinutes > eventStartMinutes - ATTACH_MINUTES
```
where all values are minutes-since-midnight on the same day.

If a block is attachable to multiple events, assign it to the one whose midpoint is **nearest** to the block's midpoint. On a tie, assign to the earlier event.

Each block is claimed by at most one event.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/usecases/attachHistoryToMeetings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { attachHistoryToMeetings } from './attachHistoryToMeetings'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'

function makeBlock(firstVisitTime: string, lastVisitTime: string, urlPattern = 'example.com'): HistoryBlock {
  return {
    date: '2026-05-20',
    urlPattern,
    urls: [urlPattern],
    titles: ['Test'],
    visitCount: 5,
    firstVisitTime,
    lastVisitTime,
    hours: 0.5,
  }
}

function makeEvent(title: string, startHHMM: string, endHHMM: string): CalendarEvent {
  const [sh, sm] = startHHMM.split(':').map(Number) as [number, number]
  const [eh, em] = endHHMM.split(':').map(Number) as [number, number]
  const base = new Date('2026-05-20T00:00:00')
  const start = new Date(base); start.setHours(sh, sm, 0, 0)
  const end = new Date(base); end.setHours(eh, em, 0, 0)
  return { id: title, title, start, end, attendees: [], status: 'accepted' }
}

describe('attachHistoryToMeetings', () => {
  it('claims a block that overlaps a meeting', () => {
    const blocks = [makeBlock('09:00', '09:15')]
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, events)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.historyBlocks).toHaveLength(1)
    expect(unclaimed).toHaveLength(0)
  })

  it('claims a block within 15 min before a meeting', () => {
    const blocks = [makeBlock('08:50', '08:55')]
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, events)
    expect(groups[0]!.historyBlocks).toHaveLength(1)
    expect(unclaimed).toHaveLength(0)
  })

  it('leaves a block outside 15 min window as unclaimed', () => {
    const blocks = [makeBlock('08:00', '08:30')]
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, events)
    expect(groups[0]!.historyBlocks).toHaveLength(0)
    expect(unclaimed).toHaveLength(1)
  })

  it('assigns a block to the nearest of two meetings', () => {
    const blocks = [makeBlock('10:00', '10:05')]
    const events = [
      makeEvent('Morning', '09:00', '09:30'),  // midpoint 09:15, distance to block mid 10:02 = 47min
      makeEvent('Midday', '10:30', '11:00'),   // midpoint 10:45, distance = 43min
    ]
    const { groups } = attachHistoryToMeetings(blocks, events)
    // block midpoint 10:02 — closer to Midday (10:45) than Morning (09:15)
    expect(groups[0]!.historyBlocks).toHaveLength(0) // Morning gets nothing
    expect(groups[1]!.historyBlocks).toHaveLength(1) // Midday gets it
  })

  it('handles zero events — all blocks unclaimed', () => {
    const blocks = [makeBlock('10:00', '10:30')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, [])
    expect(groups).toHaveLength(0)
    expect(unclaimed).toHaveLength(1)
  })

  it('handles zero blocks — groups have empty historyBlocks', () => {
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings([], events)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.historyBlocks).toHaveLength(0)
    expect(unclaimed).toHaveLength(0)
  })

  it('each block is claimed by at most one meeting', () => {
    const blocks = [makeBlock('09:10', '09:20')]
    const events = [
      makeEvent('A', '09:00', '09:15'),
      makeEvent('B', '09:15', '09:30'),
    ]
    const { groups } = attachHistoryToMeetings(blocks, events)
    const totalClaimed = groups.reduce((sum, g) => sum + g.historyBlocks.length, 0)
    expect(totalClaimed).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test -- attachHistoryToMeetings --reporter=verbose
```

Expected: all tests fail with "Cannot find module './attachHistoryToMeetings'"

- [ ] **Step 3: Implement `attachHistoryToMeetings`**

Create `src/domain/usecases/attachHistoryToMeetings.ts`:

```typescript
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'

export interface MeetingGroup {
  event: CalendarEvent
  historyBlocks: HistoryBlock[]
}

export interface AttachResult {
  groups: MeetingGroup[]
  unclaimed: HistoryBlock[]
}

const ATTACH_MINUTES = 15

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return h * 60 + m
}

function eventToMinutes(ev: CalendarEvent): { start: number; end: number; mid: number } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = toMinutes(`${pad(ev.start.getHours())}:${pad(ev.start.getMinutes())}`)
  const end = toMinutes(`${pad(ev.end.getHours())}:${pad(ev.end.getMinutes())}`)
  return { start, end, mid: (start + end) / 2 }
}

export function attachHistoryToMeetings(
  blocks: HistoryBlock[],
  events: CalendarEvent[],
): AttachResult {
  if (events.length === 0) {
    return { groups: [], unclaimed: [...blocks] }
  }

  const eventWindows = events.map(ev => eventToMinutes(ev))
  const groups: MeetingGroup[] = events.map(event => ({ event, historyBlocks: [] }))
  const unclaimed: HistoryBlock[] = []

  for (const block of blocks) {
    const blockStart = toMinutes(block.firstVisitTime)
    const blockEnd = toMinutes(block.lastVisitTime || block.firstVisitTime)
    const blockMid = (blockStart + blockEnd) / 2

    // Find all events this block is attachable to
    const candidates: { idx: number; distance: number }[] = []
    for (let i = 0; i < eventWindows.length; i++) {
      const ev = eventWindows[i]!
      const attachable =
        blockStart < ev.end + ATTACH_MINUTES &&
        blockEnd > ev.start - ATTACH_MINUTES
      if (attachable) {
        candidates.push({ idx: i, distance: Math.abs(blockMid - ev.mid) })
      }
    }

    if (candidates.length === 0) {
      unclaimed.push(block)
      continue
    }

    // Pick nearest (tie: earlier event = lower index, already first)
    candidates.sort((a, b) => a.distance - b.distance || a.idx - b.idx)
    groups[candidates[0]!.idx]!.historyBlocks.push(block)
  }

  return { groups, unclaimed }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test -- attachHistoryToMeetings --reporter=verbose
```

Expected: 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/domain/usecases/attachHistoryToMeetings.ts src/domain/usecases/attachHistoryToMeetings.test.ts
git commit -m "feat: add attachHistoryToMeetings grouping logic with tests"
```

---

## Task 2: Add `classifyDay()` to `ICopilotRepository`

**Files:**
- Modify: `src/domain/repositories/ICopilotRepository.ts`

### New types

```typescript
export interface DayItem {
  kind: 'meeting'
  index: number           // 1-based, matches the [N] in the prompt
  event: CalendarEvent
  historyBlocks: HistoryBlock[]
  cacheKey: string        // normalised cache key for this item
} | {
  kind: 'standalone'
  index: number
  block: HistoryBlock
  cacheKey: string
}

export interface DayClassificationResult {
  index: number
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: number
}
```

- [ ] **Step 1: Update `ICopilotRepository.ts`**

Replace the entire file:

```typescript
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

export interface DayItem {
  kind: 'meeting'
  index: number
  event: CalendarEvent
  historyBlocks: HistoryBlock[]
  cacheKey: string
} | {
  kind: 'standalone'
  index: number
  block: HistoryBlock
  cacheKey: string
}

export interface DayClassificationResult {
  index: number
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: number
}

export interface ICopilotRepository {
  classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
    calendarEvents?: CalendarEvent[],
  ): Promise<ClassifiedBlock[]>

  classifyDay(
    date: string,
    items: DayItem[],
    availableProjects: Project[],
    availableServices: Service[],
    cacheHints: Record<string, { projectName: string; serviceName: string }>,
  ): Promise<DayClassificationResult[]>
}
```

- [ ] **Step 2: Run typecheck — expect errors only in `CopilotRepository.ts` (not yet implementing)**

```bash
npm run typecheck 2>&1 | grep -v node_modules
```

Expected: error in `src/infrastructure/copilot/CopilotRepository.ts` about missing `classifyDay` method. No other new errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/repositories/ICopilotRepository.ts
git commit -m "feat: add classifyDay() to ICopilotRepository"
```

---

## Task 3: Implement `classifyDay()` in `CopilotRepository`

**Files:**
- Modify: `src/infrastructure/copilot/CopilotRepository.ts`

Add the `classifyDay()` method to the existing class. Do NOT remove `classify()` — it is still used by existing tests and `ClassifyHistoryBlocksUseCase`.

- [ ] **Step 1: Add `classifyDay()` to `CopilotRepository`**

Add these imports at the top of the file (after existing imports):

```typescript
import type { DayItem, DayClassificationResult } from '../../domain/repositories/ICopilotRepository'
```

Add this method to the `CopilotRepository` class (after the existing `classify()` method):

```typescript
  async classifyDay(
    date: string,
    items: DayItem[],
    availableProjects: Project[],
    availableServices: Service[],
    cacheHints: Record<string, { projectName: string; serviceName: string }>,
  ): Promise<DayClassificationResult[]> {
    const pad = (n: number) => String(n).padStart(2, '0')
    const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

    const projectList = availableProjects
      .map(p => `- id: "${p.id}", name: "${p.name}"`)
      .join('\n')
    const serviceList = availableServices
      .map(s => `- id: "${s.id}", name: "${s.name}", projectId: "${s.projectId}"`)
      .join('\n')

    const meetingItems = items.filter(i => i.kind === 'meeting')
    const standaloneItems = items.filter(i => i.kind === 'standalone')

    let meetingsSection = ''
    if (meetingItems.length > 0) {
      meetingsSection = '## Vergaderingen met browser-context\n\n'
      for (const item of meetingItems) {
        if (item.kind !== 'meeting') continue
        meetingsSection += `### [${item.index}] ${item.event.title} (${toTime(item.event.start)}–${toTime(item.event.end)})\n`
        if (item.historyBlocks.length === 0) {
          meetingsSection += `(geen browser-activiteit rondom deze vergadering)\n\n`
        } else {
          meetingsSection += `Browser-activiteit rondom deze vergadering:\n`
          for (const b of item.historyBlocks) {
            const titles = b.titles.slice(0, 3).join('", "')
            meetingsSection += `- ${b.urlPattern} (${b.visitCount}x) — "${titles}"\n`
          }
          meetingsSection += '\n'
        }
      }
    }

    let standaloneSection = ''
    if (standaloneItems.length > 0) {
      standaloneSection = '## Losse browser-activiteit\n\n'
      for (const item of standaloneItems) {
        if (item.kind !== 'standalone') continue
        const b = item.block
        standaloneSection += `### [${item.index}] ${b.firstVisitTime}–${b.lastVisitTime} (${b.hours}u)\n`
        for (const url of b.urls.slice(0, 5)) {
          standaloneSection += `- ${url} (${b.visitCount}x)\n`
        }
        const titles = b.titles.slice(0, 3).join('", "')
        if (titles) standaloneSection += `  Titels: "${titles}"\n`
        standaloneSection += '\n'
      }
    }

    const hintLines = Object.entries(cacheHints)
      .map(([key, val]) => `- ${key} → project: "${val.projectName}", dienst: "${val.serviceName}"`)
      .join('\n')
    const hintsSection = hintLines
      ? `## Cache-hints (eerder geboekte patronen)\n${hintLines}\n`
      : ''

    const prompt = `Je bent een tijdregistratie-assistent die een developer helpt zijn werkuren te registreren.

Datum: ${date}

Voor elk genummerd item hieronder geef je één boekingsblok terug.
- Vergadering-items: gebruik de vergader-duur voor startTime/endTime/hours
- Losse items: gebruik de browse-duur

${meetingsSection}${standaloneSection}${hintsSection}
Beschikbare projecten:
${projectList}

Beschikbare diensten (gekoppeld aan projecten via projectId):
${serviceList}

Geef een JSON-array terug. Elk item heeft:
- index (number, exact overeenkomend met het [N]-nummer hierboven)
- blockName (string, leesbare naam max 60 tekens, bv. "Standup — PR review")
- summary (string, korte samenvatting wat er gedaan is, max 120 tekens, Nederlands)
- projectId (string | null, moet een van de beschikbare project-ID's zijn)
- serviceId (string | null, moet een dienst-ID zijn waarvan projectId overeenkomt)
- note (string, korte boekingsnotitie max 80 tekens)
- confidence (number 0-1, hoe zeker je bent van de projectkeuze)

Gebruik de cache-hints als leidraad maar overschrijf ze als de context duidelijk op een ander project wijst.
Geef ALLEEN een geldige JSON-array terug, geen markdown, geen uitleg.`

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

    let results: DayClassificationResult[]
    try {
      results = JSON.parse(content) as DayClassificationResult[]
    } catch {
      throw new Error('Copilot returned invalid JSON for classifyDay')
    }

    if (!Array.isArray(results)) {
      throw new Error('Copilot classifyDay returned unexpected format (not an array)')
    }

    return results
  }
```

- [ ] **Step 2: Run typecheck — expect clean**

```bash
npm run typecheck 2>&1 | grep -v node_modules
```

Expected: no errors

- [ ] **Step 3: Run all tests — expect all passing**

```bash
npm run test
```

Expected: all existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/copilot/CopilotRepository.ts
git commit -m "feat: implement classifyDay() in CopilotRepository"
```

---

## Task 4: `GroupAndClassifyDayUseCase` with tests

**Files:**
- Create: `src/domain/usecases/GroupAndClassifyDayUseCase.ts`
- Create: `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts`

### Cache key normalisation

```typescript
function normaliseCacheKey(key: string): string {
  return key.toLowerCase().trim().slice(0, 120)
}

function meetingCacheKey(eventTitle: string, dominantUrlPattern: string | null): string {
  const title = normaliseCacheKey(eventTitle)
  const url = dominantUrlPattern ? normaliseCacheKey(dominantUrlPattern) : '_solo'
  return `${title}:${url}`
}
```

- [ ] **Step 1: Write failing tests**

Create `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { GroupAndClassifyDayUseCase } from './GroupAndClassifyDayUseCase'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository, CachedMapping } from '../repositories/IMappingCacheRepository'

const projects: Project[] = [
  { id: 'p1', name: 'Harborn' },
]
const services: Service[] = [
  { id: 's1', name: 'Development', projectId: 'p1' },
]

function makeBlock(firstVisitTime: string, urlPattern = 'github.com/org/repo'): HistoryBlock {
  return {
    date: '2026-05-20',
    urlPattern,
    urls: [urlPattern],
    titles: ['PR review'],
    visitCount: 5,
    firstVisitTime,
    lastVisitTime: firstVisitTime,
    hours: 0.5,
  }
}

function makeEvent(title: string, startHHMM: string, endHHMM: string): CalendarEvent {
  const [sh, sm] = startHHMM.split(':').map(Number) as [number, number]
  const [eh, em] = endHHMM.split(':').map(Number) as [number, number]
  const base = new Date('2026-05-20T00:00:00')
  const start = new Date(base); start.setHours(sh, sm, 0, 0)
  const end = new Date(base); end.setHours(eh, em, 0, 0)
  return { id: title, title, start, end, attendees: [], status: 'accepted' }
}

function makeMockCopilot(results = [{ index: 1, blockName: 'Standup', summary: 'daily standup', projectId: 'p1', serviceId: 's1', note: '', confidence: 0.9 }]): ICopilotRepository {
  return {
    classify: vi.fn(),
    classifyDay: vi.fn().mockResolvedValue(results),
  }
}

function makeMockCache(hits: Record<string, CachedMapping> = {}): IMappingCacheRepository {
  return {
    get: vi.fn((key: string) => hits[key]),
    set: vi.fn(),
    getAll: vi.fn().mockReturnValue(hits),
  }
}

describe('GroupAndClassifyDayUseCase', () => {
  it('returns a meeting block with calendar duration when block is claimed', async () => {
    const copilot = makeMockCopilot([{
      index: 1, blockName: 'Standup — PR review', summary: 'standup met PR review',
      projectId: 'p1', serviceId: 's1', note: '', confidence: 0.9,
    }])
    const cache = makeMockCache()
    const uc = new GroupAndClassifyDayUseCase(copilot, cache)

    const blocks = [makeBlock('09:00')]
    const events = [makeEvent('Standup', '09:00', '09:15')]

    const result = await uc.execute('2026-05-20', blocks, events, projects, services)

    expect(result).toHaveLength(1)
    expect(result[0]!.origin).toBe('calendar')
    expect(result[0]!.startTime).toBe('09:00')
    expect(result[0]!.endTime).toBe('09:15')
    expect(result[0]!.blockName).toBe('Standup — PR review')
    expect(result[0]!.projectId).toBe('p1')
  })

  it('returns standalone block for unclaimed history', async () => {
    const copilot = makeMockCopilot([{
      index: 1, blockName: 'Zelfstandig werk', summary: 'stackoverflow research',
      projectId: null, serviceId: null, note: '', confidence: 0.3,
    }])
    const cache = makeMockCache()
    const uc = new GroupAndClassifyDayUseCase(copilot, cache)

    const blocks = [makeBlock('11:00', 'stackoverflow.com')]
    const result = await uc.execute('2026-05-20', blocks, [], projects, services)

    expect(result).toHaveLength(1)
    expect(result[0]!.origin).toBe('llm')
    expect(result[0]!.urlPattern).toBe('stackoverflow.com')
  })

  it('returns cache hit without calling LLM for meeting block', async () => {
    const copilot = makeMockCopilot()
    const cache = makeMockCache({
      'standup:github.com/org/repo': {
        projectId: 'p1', serviceId: 's1', note: 'dagelijks', blockName: 'Standup', summary: 'standup',
      },
    })
    const uc = new GroupAndClassifyDayUseCase(copilot, cache)

    const blocks = [makeBlock('09:00')]
    const events = [makeEvent('Standup', '09:00', '09:15')]

    const result = await uc.execute('2026-05-20', blocks, events, projects, services)

    expect(copilot.classifyDay).not.toHaveBeenCalled()
    expect(result[0]!.origin).toBe('cache')
    expect(result[0]!.projectId).toBe('p1')
  })

  it('handles solo meeting (no browser activity) with cache', async () => {
    const copilot = makeMockCopilot([{
      index: 1, blockName: 'Klantoverleg', summary: 'telefonisch overleg',
      projectId: 'p1', serviceId: 's1', note: '', confidence: 0.7,
    }])
    const cache = makeMockCache()
    const uc = new GroupAndClassifyDayUseCase(copilot, cache)

    const result = await uc.execute('2026-05-20', [], [makeEvent('Klantoverleg', '10:00', '10:30')], projects, services)

    expect(result).toHaveLength(1)
    expect(result[0]!.urlPattern).toBe('klantoverleg:_solo')
    expect(result[0]!.hours).toBe(0.5)
  })

  it('sorts output by startTime', async () => {
    const copilot = makeMockCopilot([
      { index: 1, blockName: 'Standup', summary: '', projectId: null, serviceId: null, note: '', confidence: 0.5 },
      { index: 2, blockName: 'Werk', summary: '', projectId: null, serviceId: null, note: '', confidence: 0.5 },
    ])
    const cache = makeMockCache()
    const uc = new GroupAndClassifyDayUseCase(copilot, cache)

    const blocks = [makeBlock('11:00', 'stackoverflow.com')]
    const events = [makeEvent('Standup', '09:00', '09:15')]

    const result = await uc.execute('2026-05-20', blocks, events, projects, services)

    expect(result[0]!.startTime).toBe('09:00')
    expect(result[1]!.startTime).toBe('11:00')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test -- GroupAndClassifyDayUseCase --reporter=verbose
```

Expected: all fail with "Cannot find module './GroupAndClassifyDayUseCase'"

- [ ] **Step 3: Implement `GroupAndClassifyDayUseCase`**

Create `src/domain/usecases/GroupAndClassifyDayUseCase.ts`:

```typescript
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { ICopilotRepository, Project, Service, DayItem } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import { attachHistoryToMeetings } from './attachHistoryToMeetings'

function normaliseCacheKey(key: string): string {
  return key.toLowerCase().trim().slice(0, 120)
}

function meetingCacheKey(eventTitle: string, dominantUrlPattern: string | null): string {
  const title = normaliseCacheKey(eventTitle)
  const url = dominantUrlPattern ? normaliseCacheKey(dominantUrlPattern) : '_solo'
  return `${title}:${url}`
}

function dominantUrl(historyBlocks: HistoryBlock[]): string | null {
  if (historyBlocks.length === 0) return null
  const counts = new Map<string, number>()
  for (const b of historyBlocks) {
    counts.set(b.urlPattern, (counts.get(b.urlPattern) ?? 0) + b.visitCount)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
}

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const total = h * 60 + m + Math.round(hours * 60)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function eventToHoursAndTimes(ev: CalendarEvent): { startTime: string; endTime: string; hours: number } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const startTime = `${pad(ev.start.getHours())}:${pad(ev.start.getMinutes())}`
  const endTime = `${pad(ev.end.getHours())}:${pad(ev.end.getMinutes())}`
  const hours = Math.max(0.5, Math.round(((ev.end.getTime() - ev.start.getTime()) / 3600000) * 2) / 2)
  return { startTime, endTime, hours }
}

export class GroupAndClassifyDayUseCase {
  constructor(
    private readonly copilot: ICopilotRepository,
    private readonly cache: IMappingCacheRepository,
  ) {}

  async execute(
    date: string,
    historyBlocks: HistoryBlock[],
    calendarEvents: CalendarEvent[],
    projects: Project[],
    services: Service[],
  ): Promise<ClassifiedBlock[]> {
    const { groups, unclaimed } = attachHistoryToMeetings(historyBlocks, calendarEvents)

    // Build DayItems with cache keys
    const dayItems: (DayItem & { cacheKey: string })[] = []
    let index = 1

    for (const group of groups) {
      const dom = dominantUrl(group.historyBlocks)
      const cacheKey = meetingCacheKey(group.event.title, dom)
      dayItems.push({ kind: 'meeting', index, event: group.event, historyBlocks: group.historyBlocks, cacheKey })
      index++
    }

    for (const block of unclaimed) {
      dayItems.push({ kind: 'standalone', index, block, cacheKey: block.urlPattern })
      index++
    }

    // Separate cache hits from LLM-needed items
    const cacheResults: ClassifiedBlock[] = []
    const needsLLM: typeof dayItems = []

    for (const item of dayItems) {
      const cached = this.cache.get(item.cacheKey)
      if (cached) {
        if (item.kind === 'meeting') {
          const { startTime, endTime, hours } = eventToHoursAndTimes(item.event)
          cacheResults.push({
            date,
            urlPattern: item.cacheKey,
            urls: item.historyBlocks.flatMap(b => b.urls),
            titles: [item.event.title, ...item.historyBlocks.flatMap(b => b.titles)],
            visitCount: item.historyBlocks.reduce((s, b) => s + b.visitCount, 0),
            firstVisitTime: startTime,
            lastVisitTime: endTime,
            hours,
            blockName: cached.blockName ?? item.event.title,
            summary: cached.summary ?? '',
            startTime,
            endTime,
            projectId: cached.projectId,
            serviceId: cached.serviceId,
            note: cached.note,
            confidence: 1.0,
            origin: 'cache',
          })
        } else {
          const b = item.block
          cacheResults.push({
            ...b,
            blockName: cached.blockName ?? b.urlPattern,
            summary: cached.summary ?? '',
            startTime: b.firstVisitTime,
            endTime: b.lastVisitTime || addHoursToTime(b.firstVisitTime, b.hours),
            projectId: cached.projectId,
            serviceId: cached.serviceId,
            note: cached.note,
            confidence: 1.0,
            origin: 'cache',
          })
        }
      } else {
        needsLLM.push(item)
      }
    }

    // Build cache hints for LLM prompt — all cache entries whose keys appear in this day's items
    const cacheHints: Record<string, { projectName: string; serviceName: string }> = {}
    const allCacheEntries = this.cache.getAll()
    for (const item of needsLLM) {
      // Also include hints from bare urlPattern even for meeting items
      const keysToCheck = [item.cacheKey]
      if (item.kind === 'meeting') {
        for (const b of item.historyBlocks) keysToCheck.push(b.urlPattern)
      }
      for (const key of keysToCheck) {
        const entry = allCacheEntries[key]
        if (entry) {
          const project = projects.find(p => p.id === entry.projectId)
          const service = services.find(s => s.id === entry.serviceId)
          if (project && service) {
            cacheHints[key] = { projectName: project.name, serviceName: service.name }
          }
        }
      }
    }

    // Call LLM for uncached items
    let llmResults: ClassifiedBlock[] = []
    if (needsLLM.length > 0) {
      const rawResults = await this.copilot.classifyDay(date, needsLLM, projects, services, cacheHints)

      llmResults = needsLLM.map(item => {
        const match = rawResults.find(r => r.index === item.index)
        const confidence = Math.min(1, Math.max(0, match?.confidence ?? 0))

        if (item.kind === 'meeting') {
          const { startTime, endTime, hours } = eventToHoursAndTimes(item.event)
          const block: ClassifiedBlock = {
            date,
            urlPattern: item.cacheKey,
            urls: item.historyBlocks.flatMap(b => b.urls),
            titles: [item.event.title, ...item.historyBlocks.flatMap(b => b.titles)],
            visitCount: item.historyBlocks.reduce((s, b) => s + b.visitCount, 0),
            firstVisitTime: startTime,
            lastVisitTime: endTime,
            hours,
            blockName: match?.blockName ?? item.event.title,
            summary: match?.summary ?? '',
            startTime,
            endTime,
            confidence,
            origin: 'calendar' as const,
          }
          if (match?.projectId) block.projectId = match.projectId
          if (match?.serviceId) block.serviceId = match.serviceId
          if (match?.note) block.note = match.note
          return block
        } else {
          const b = item.block
          const block: ClassifiedBlock = {
            ...b,
            blockName: match?.blockName ?? b.urlPattern,
            summary: match?.summary ?? '',
            startTime: b.firstVisitTime,
            endTime: b.lastVisitTime || addHoursToTime(b.firstVisitTime, b.hours),
            confidence,
            origin: 'llm' as const,
          }
          if (match?.projectId) block.projectId = match.projectId
          if (match?.serviceId) block.serviceId = match.serviceId
          if (match?.note) block.note = match.note
          return block
        }
      })
    }

    // Merge and sort by startTime
    return [...cacheResults, ...llmResults].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    )
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test -- GroupAndClassifyDayUseCase --reporter=verbose
```

Expected: all 5 tests pass

- [ ] **Step 5: Run all tests**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/domain/usecases/GroupAndClassifyDayUseCase.ts src/domain/usecases/GroupAndClassifyDayUseCase.test.ts
git commit -m "feat: add GroupAndClassifyDayUseCase with tests"
```

---

## Task 5: Wire `GroupAndClassifyDayUseCase` into `useImport`

**Files:**
- Modify: `src/ui/hooks/useImport.ts`

The `analyseFile` function currently:
1. Parses CSV → `historyBlocks`
2. Fetches calendar events
3. Calls `ClassifyHistoryBlocksUseCase.execute(historyBlocks, ...)`
4. Calls `ClassifyCalendarBlocksUseCase.execute(calendarEvents, ...)`
5. Merges + sorts

Replace steps 3–5 with a per-day loop using `GroupAndClassifyDayUseCase`.

Also update `bookAll`: calendar-origin blocks with the new composite `urlPattern` (e.g. `standup:github.com/org/repo`) must still skip the `mappingCacheRepo` write — the existing `origin !== 'calendar'` guard handles this already.

- [ ] **Step 1: Update imports in `useImport.ts`**

Replace the classify-related imports:

```typescript
// Remove these imports:
// import { ClassifyHistoryBlocksUseCase } from '../../domain/usecases/ClassifyHistoryBlocksUseCase'

// Add this import:
import { GroupAndClassifyDayUseCase } from '../../domain/usecases/GroupAndClassifyDayUseCase'
```

Also add to the container imports:
```typescript
// Remove from container imports:
// createClassifyCalendarBlocksUseCase,

// The container import line should be:
import {
  mappingCacheRepo,
  createCopilotRepository,
  keychainRepo,
  createSimplicateRepository,
  createCalendarRepository,
  createFetchCalendarEventsUseCase,
} from '../../application/container'
```

- [ ] **Step 2: Replace the classify section in `analyseFile`**

Find the section from `setStatus('classifying')` to `setBlocks(allBlocks)` and replace it:

```typescript
      setStatus('classifying')

      const copilotRepo = createCopilotRepository(token)

      // Group all history blocks and calendar events by day, classify day by day
      const byDay = new Map<string, { history: typeof historyBlocks; events: typeof calendarEvents }>()

      for (const block of historyBlocks) {
        if (!byDay.has(block.date)) byDay.set(block.date, { history: [], events: [] })
        byDay.get(block.date)!.history.push(block)
      }
      for (const event of calendarEvents) {
        const date = event.start.toISOString().slice(0, 10)
        if (!byDay.has(date)) byDay.set(date, { history: [], events: [] })
        byDay.get(date)!.events.push(event)
      }

      const groupAndClassify = new GroupAndClassifyDayUseCase(copilotRepo, mappingCacheRepo)
      const allBlocksNested = await Promise.all(
        [...byDay.entries()].map(([date, { history, events }]) =>
          groupAndClassify.execute(date, history, events, projects, services)
        )
      )

      const allBlocks = allBlocksNested.flat().sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return a.startTime.localeCompare(b.startTime)
      })

      setBlocks(allBlocks)
      setStatus('ready')
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck 2>&1 | grep -v node_modules
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useImport.ts
git commit -m "feat: wire GroupAndClassifyDayUseCase into useImport"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full test suite**

```bash
npm run test
```

Expected: all tests pass (no regressions)

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: same pre-existing errors as before, no new ones

- [ ] **Step 4: Remove debug logging added during development**

Check `src/ui/hooks/useImport.ts` and `src/infrastructure/googlecalendar/GoogleCalendarRepository.ts` for the `console.log('[Calendar...]')` and `console.log('[CalendarRepo...]')` lines added for debugging. Remove them.

```bash
npm run typecheck && npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useImport.ts src/infrastructure/googlecalendar/GoogleCalendarRepository.ts
git commit -m "chore: remove debug logging"
```

---

## Self-Review

**Spec coverage:**
- ✅ Meeting-centric grouping: `attachHistoryToMeetings` (Task 1)
- ✅ One LLM prompt per day with both meetings and standalone activity (Task 3)
- ✅ Cache key `meetingTitle:dominantUrlPattern` / `meetingTitle:_solo` (Task 4)
- ✅ Cache hints injected into prompt (Task 4)
- ✅ Meeting blocks use calendar event duration (Task 4)
- ✅ Standalone blocks unchanged (Task 4)
- ✅ `useImport` wired to new use case (Task 5)
- ✅ `ClassifyCalendarBlocksUseCase` kept but no longer called from `useImport` (Task 5 removes the call; the file is untouched)

**No placeholders found.**

**Type consistency:**
- `DayItem` defined in `ICopilotRepository.ts` (Task 2), used in `CopilotRepository.ts` (Task 3) and `GroupAndClassifyDayUseCase.ts` (Task 4) — consistent
- `DayClassificationResult` defined in Task 2, used in Task 3 and Task 4 — consistent
- `MeetingGroup` / `AttachResult` defined in `attachHistoryToMeetings.ts` (Task 1), imported in `GroupAndClassifyDayUseCase.ts` (Task 4) — consistent
- `meetingCacheKey()` defined and used within Task 4 only — consistent
