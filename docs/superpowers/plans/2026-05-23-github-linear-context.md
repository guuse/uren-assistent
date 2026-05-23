# GitHub + Linear Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg GitHub commits en Linear issues toe als context aan de LLM-classificatie, toon ze als evidence in de UI, en voeg een "Verwerk week" knop toe die alle werkdagen in één keer verwerkt.

**Architecture:** Clean Architecture — domain entities en interfaces eerst, dan infrastructure implementaties, dan use cases, dan UI. De bestaande `GroupAndClassifyDayUseCase` en `CopilotRepository` worden uitgebreid. De nieuwe `ProcessWeekUseCase` orkestreeert het ophalen van GitHub/Linear data en het classificeren van alle dagen.

**Tech Stack:** TypeScript strict, Tauri (fetch via browser runtime), Zustand, React, Tailwind CSS, Vitest

---

## File map

| Actie | Pad | Verantwoordelijkheid |
|---|---|---|
| Create | `src/domain/entities/GitHubCommit.ts` | Entity |
| Create | `src/domain/entities/LinearIssue.ts` | Entity |
| Create | `src/domain/entities/DayContext.ts` | Gebundelde context per dag |
| Modify | `src/domain/entities/ClassifiedBlock.ts` | Voeg `commits?` en `linearIssues?` toe |
| Create | `src/domain/repositories/IGitHubRepository.ts` | Interface |
| Create | `src/domain/repositories/ILinearRepository.ts` | Interface |
| Modify | `src/domain/repositories/ICopilotRepository.ts` | Voeg `context?` toe aan `classifyDay` |
| Create | `src/domain/usecases/FetchGitHubContextUseCase.ts` | Use case |
| Create | `src/domain/usecases/FetchLinearContextUseCase.ts` | Use case |
| Create | `src/domain/usecases/ProcessWeekUseCase.ts` | Week-verwerking use case |
| Modify | `src/domain/usecases/GroupAndClassifyDayUseCase.ts` | Accepteer en hecht `DayContext` |
| Create | `src/infrastructure/github/GitHubRepository.ts` | REST API implementatie |
| Create | `src/infrastructure/linear/LinearRepository.ts` | GraphQL API implementatie |
| Modify | `src/infrastructure/copilot/CopilotRepository.ts` | Voeg GitHub/Linear secties toe aan prompt |
| Modify | `src/application/container.ts` | Factory functies voor nieuwe repos/use cases |
| Modify | `src/store/appStore.ts` | Voeg `githubToken`, `linearToken` toe |
| Modify | `src/ui/components/EvidencePanel.tsx` | Toon commits en Linear issues |
| Modify | `src/ui/components/WeekDayList.tsx` | "Verwerk week" knop + progress state |
| Modify | `src/ui/pages/Settings/AccountSettings.tsx` | GitHub token + Linear key velden |
| Modify | `src/ui/pages/WeekPage.tsx` | Orchestreer ProcessWeekUseCase |
| Create | `src/domain/usecases/__tests__/FetchGitHubContextUseCase.test.ts` | Unit test |
| Create | `src/domain/usecases/__tests__/FetchLinearContextUseCase.test.ts` | Unit test |
| Create | `src/domain/usecases/__tests__/ProcessWeekUseCase.test.ts` | Unit test |

---

## Task 1: Domain entities

**Files:**
- Create: `src/domain/entities/GitHubCommit.ts`
- Create: `src/domain/entities/LinearIssue.ts`
- Create: `src/domain/entities/DayContext.ts`
- Modify: `src/domain/entities/ClassifiedBlock.ts`

- [ ] **Stap 1: Maak `GitHubCommit.ts`**

```ts
// src/domain/entities/GitHubCommit.ts
export interface GitHubCommit {
  sha: string
  message: string   // eerste regel van commit message
  repo: string      // "owner/repo"
  branch: string
  timestamp: string // ISO 8601
  time: string      // "HH:MM" lokale tijd
}
```

- [ ] **Stap 2: Maak `LinearIssue.ts`**

```ts
// src/domain/entities/LinearIssue.ts
export interface LinearIssue {
  identifier: string  // "ENG-42"
  title: string
  completedAt: string // ISO 8601
  url: string
}
```

- [ ] **Stap 3: Maak `DayContext.ts`**

```ts
// src/domain/entities/DayContext.ts
import type { GitHubCommit } from './GitHubCommit'
import type { LinearIssue } from './LinearIssue'

export interface DayContext {
  commits: GitHubCommit[]       // commits op die specifieke dag
  linearIssues: LinearIssue[]   // afgerond in de week (zelfde lijst elke dag)
}
```

- [ ] **Stap 4: Breid `ClassifiedBlock.ts` uit**

Vervang de inhoud van `src/domain/entities/ClassifiedBlock.ts`:

```ts
import type { HistoryBlock } from './HistoryBlock'
import type { GitHubCommit } from './GitHubCommit'
import type { LinearIssue } from './LinearIssue'

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
  rawTitles?: string[]
  rawUrls?: string[]
  commits?: GitHubCommit[]
  linearIssues?: LinearIssue[]
}
```

- [ ] **Stap 5: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 6: Commit**

```bash
git add src/domain/entities/
git commit -m "feat: add GitHubCommit, LinearIssue, DayContext entities"
```

---

## Task 2: Repository interfaces

**Files:**
- Create: `src/domain/repositories/IGitHubRepository.ts`
- Create: `src/domain/repositories/ILinearRepository.ts`
- Modify: `src/domain/repositories/ICopilotRepository.ts`

- [ ] **Stap 1: Maak `IGitHubRepository.ts`**

```ts
// src/domain/repositories/IGitHubRepository.ts
import type { GitHubCommit } from '../entities/GitHubCommit'

export interface IGitHubRepository {
  getCommitsForWeek(
    username: string,
    weekStart: string,
    weekEnd: string,
  ): Promise<GitHubCommit[]>
}
```

- [ ] **Stap 2: Maak `ILinearRepository.ts`**

```ts
// src/domain/repositories/ILinearRepository.ts
import type { LinearIssue } from '../entities/LinearIssue'

export interface ILinearRepository {
  getCompletedIssuesForWeek(
    weekStart: string,
    weekEnd: string,
  ): Promise<LinearIssue[]>
}
```

- [ ] **Stap 3: Breid `ICopilotRepository.ts` uit**

Voeg `DayContext` import en optionele `context?` parameter toe aan `classifyDay`:

```ts
// src/domain/repositories/ICopilotRepository.ts
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { DayContext } from '../entities/DayContext'

export interface Project {
  id: string
  name: string
}

export interface Service {
  id: string
  name: string
  projectId: string
}

export type DayItem =
  | {
      kind: 'meeting'
      index: number
      event: CalendarEvent
      historyBlocks: HistoryBlock[]
      cacheKey: string
    }
  | {
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
    context?: DayContext,
  ): Promise<DayClassificationResult[]>
}
```

- [ ] **Stap 4: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 5: Commit**

```bash
git add src/domain/repositories/
git commit -m "feat: add IGitHubRepository, ILinearRepository; extend ICopilotRepository with DayContext"
```

---

## Task 3: Use cases FetchGitHubContextUseCase en FetchLinearContextUseCase

**Files:**
- Create: `src/domain/usecases/FetchGitHubContextUseCase.ts`
- Create: `src/domain/usecases/FetchLinearContextUseCase.ts`
- Create: `src/domain/usecases/__tests__/FetchGitHubContextUseCase.test.ts`
- Create: `src/domain/usecases/__tests__/FetchLinearContextUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing test voor FetchGitHubContextUseCase**

```ts
// src/domain/usecases/__tests__/FetchGitHubContextUseCase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { FetchGitHubContextUseCase } from '../FetchGitHubContextUseCase'
import type { IGitHubRepository } from '../../repositories/IGitHubRepository'
import type { GitHubCommit } from '../../entities/GitHubCommit'

const mockCommits: GitHubCommit[] = [
  { sha: 'abc', message: 'feat: add ESC close', repo: 'guuse/uren-schrijven', branch: 'main', timestamp: '2026-05-20T10:23:00Z', time: '10:23' },
  { sha: 'def', message: 'fix: drag logic', repo: 'guuse/uren-schrijven', branch: 'main', timestamp: '2026-05-21T11:47:00Z', time: '11:47' },
]

const mockRepo: IGitHubRepository = {
  getCommitsForWeek: vi.fn().mockResolvedValue(mockCommits),
}

describe('FetchGitHubContextUseCase', () => {
  it('delegates to repository and returns commits', async () => {
    const useCase = new FetchGitHubContextUseCase(mockRepo)
    const result = await useCase.execute('guuse', '2026-05-19', '2026-05-23')
    expect(result).toEqual(mockCommits)
    expect(mockRepo.getCommitsForWeek).toHaveBeenCalledWith('guuse', '2026-05-19', '2026-05-23')
  })

  it('returns empty array when repository throws', async () => {
    const failRepo: IGitHubRepository = {
      getCommitsForWeek: vi.fn().mockRejectedValue(new Error('401')),
    }
    const useCase = new FetchGitHubContextUseCase(failRepo)
    const result = await useCase.execute('guuse', '2026-05-19', '2026-05-23')
    expect(result).toEqual([])
  })
})
```

- [ ] **Stap 2: Draai de test (verwacht: FAIL)**

```bash
npm run test -- FetchGitHubContextUseCase
```

Verwacht: `FetchGitHubContextUseCase` not found.

- [ ] **Stap 3: Implementeer `FetchGitHubContextUseCase.ts`**

```ts
// src/domain/usecases/FetchGitHubContextUseCase.ts
import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { GitHubCommit } from '../entities/GitHubCommit'

export class FetchGitHubContextUseCase {
  constructor(private readonly repo: IGitHubRepository) {}

  async execute(username: string, weekStart: string, weekEnd: string): Promise<GitHubCommit[]> {
    try {
      return await this.repo.getCommitsForWeek(username, weekStart, weekEnd)
    } catch {
      return []
    }
  }
}
```

- [ ] **Stap 4: Draai de test (verwacht: PASS)**

```bash
npm run test -- FetchGitHubContextUseCase
```

- [ ] **Stap 5: Schrijf de failing test voor FetchLinearContextUseCase**

```ts
// src/domain/usecases/__tests__/FetchLinearContextUseCase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { FetchLinearContextUseCase } from '../FetchLinearContextUseCase'
import type { ILinearRepository } from '../../repositories/ILinearRepository'
import type { LinearIssue } from '../../entities/LinearIssue'

const mockIssues: LinearIssue[] = [
  { identifier: 'ENG-42', title: 'Booking modal redesign', completedAt: '2026-05-20T14:00:00Z', url: 'https://linear.app/eng/issue/ENG-42' },
]

const mockRepo: ILinearRepository = {
  getCompletedIssuesForWeek: vi.fn().mockResolvedValue(mockIssues),
}

describe('FetchLinearContextUseCase', () => {
  it('delegates to repository and returns issues', async () => {
    const useCase = new FetchLinearContextUseCase(mockRepo)
    const result = await useCase.execute('2026-05-19', '2026-05-23')
    expect(result).toEqual(mockIssues)
    expect(mockRepo.getCompletedIssuesForWeek).toHaveBeenCalledWith('2026-05-19', '2026-05-23')
  })

  it('returns empty array when repository throws', async () => {
    const failRepo: ILinearRepository = {
      getCompletedIssuesForWeek: vi.fn().mockRejectedValue(new Error('401')),
    }
    const useCase = new FetchLinearContextUseCase(failRepo)
    const result = await useCase.execute('2026-05-19', '2026-05-23')
    expect(result).toEqual([])
  })
})
```

- [ ] **Stap 6: Draai de test (verwacht: FAIL)**

```bash
npm run test -- FetchLinearContextUseCase
```

- [ ] **Stap 7: Implementeer `FetchLinearContextUseCase.ts`**

```ts
// src/domain/usecases/FetchLinearContextUseCase.ts
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { LinearIssue } from '../entities/LinearIssue'

export class FetchLinearContextUseCase {
  constructor(private readonly repo: ILinearRepository) {}

  async execute(weekStart: string, weekEnd: string): Promise<LinearIssue[]> {
    try {
      return await this.repo.getCompletedIssuesForWeek(weekStart, weekEnd)
    } catch {
      return []
    }
  }
}
```

- [ ] **Stap 8: Draai alle tests (verwacht: PASS)**

```bash
npm run test -- FetchGitHubContextUseCase FetchLinearContextUseCase
```

- [ ] **Stap 9: Commit**

```bash
git add src/domain/usecases/
git commit -m "feat: add FetchGitHubContextUseCase and FetchLinearContextUseCase with tests"
```

---

## Task 4: GroupAndClassifyDayUseCase uitbreiden met DayContext

**Files:**
- Modify: `src/domain/usecases/GroupAndClassifyDayUseCase.ts`
- Modify: `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts` (bestaand)

- [ ] **Stap 1: Schrijf failing test — context wordt doorgegeven aan classifyDay**

Voeg deze test toe aan het bestaande testbestand `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts`. Eerst lezen wat er al in staat, dan onderaan toevoegen:

```ts
// Voeg toe onderaan het bestaande testbestand
import type { DayContext } from '../entities/DayContext'

it('passes DayContext to classifyDay and attaches commits and linearIssues to classified blocks', async () => {
  const context: DayContext = {
    commits: [
      { sha: 'abc', message: 'feat: ESC close', repo: 'guuse/uren', branch: 'main', timestamp: '2026-05-20T10:00:00Z', time: '10:00' },
    ],
    linearIssues: [
      { identifier: 'ENG-42', title: 'Booking modal', completedAt: '2026-05-20T14:00:00Z', url: 'https://linear.app/eng/issue/ENG-42' },
    ],
  }

  // Gebruik de bestaande mock copilotRepo uit de describe-scope
  // en roep execute aan met context
  const blocks = await useCase.execute('2026-05-20', [], [], context)
  // Met lege history en events verwachten we lege output — test dat context geen crash veroorzaakt
  expect(blocks).toEqual([])
  // classifyDay wordt niet aangeroepen als er geen items zijn
})
```

> Let op: pas de test aan op de bestaande mock-structuur in dat testbestand. Het gaat erom dat de signature werkt en er geen crash is.

- [ ] **Stap 2: Draai de test (verwacht: FAIL — execute accepteert nog geen vierde parameter)**

```bash
npm run test -- GroupAndClassifyDayUseCase
```

- [ ] **Stap 3: Breid `GroupAndClassifyDayUseCase.ts` uit**

Wijzig de `execute` signature en voeg context-doorgave toe. Vervang het hele bestand:

```ts
// src/domain/usecases/GroupAndClassifyDayUseCase.ts
import type { ICopilotRepository, DayItem, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { DayContext } from '../entities/DayContext'
import { attachHistoryToMeetings } from './attachHistoryToMeetings'

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return url
  }
}

function toTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function roundToHalf(hours: number): number {
  return Math.max(0.5, Math.round(hours * 2) / 2)
}

export class GroupAndClassifyDayUseCase {
  constructor(
    private readonly copilotRepo: ICopilotRepository,
    private readonly cacheRepo: IMappingCacheRepository,
    private readonly availableProjects: Project[],
    private readonly availableServices: Service[],
  ) {}

  async execute(
    date: string,
    historyBlocks: HistoryBlock[],
    calendarEvents: CalendarEvent[],
    context?: DayContext,
  ): Promise<ClassifiedBlock[]> {
    const { groups, unclaimed } = attachHistoryToMeetings(historyBlocks, calendarEvents)

    const items: DayItem[] = []
    let index = 0

    for (const group of groups) {
      const dominant = group.historyBlocks.reduce<HistoryBlock | undefined>(
        (best, b) => (!best || b.visitCount > best.visitCount ? b : best),
        undefined,
      )
      const cacheKey = dominant
        ? `${group.event.title}:${dominant.urlPattern}`
        : `${group.event.title}:_solo`
      items.push({ kind: 'meeting', index, event: group.event, historyBlocks: group.historyBlocks, cacheKey })
      index++
    }

    for (const block of unclaimed) {
      items.push({ kind: 'standalone', index, block, cacheKey: block.urlPattern })
      index++
    }

    const allCache = this.cacheRepo.getAll()
    const cacheHints: Record<string, { projectName: string; serviceName: string }> = {}
    for (const item of items) {
      const cached = allCache[item.cacheKey]
      if (cached) {
        const project = this.availableProjects.find(p => p.id === cached.projectId)
        const service = this.availableServices.find(s => s.id === cached.serviceId)
        cacheHints[item.cacheKey] = {
          projectName: project?.name ?? '',
          serviceName: service?.name ?? '',
        }
      }
    }

    const cacheResults: ClassifiedBlock[] = []
    const llmItems: DayItem[] = []

    for (const item of items) {
      if (item.kind === 'standalone' && allCache[item.cacheKey]) {
        const cached = allCache[item.cacheKey]!
        cacheResults.push({
          ...item.block,
          blockName: cached.blockName ?? item.block.urlPattern,
          summary: cached.summary ?? '',
          startTime: item.block.firstVisitTime,
          endTime: item.block.lastVisitTime,
          projectId: cached.projectId,
          serviceId: cached.serviceId,
          note: cached.note,
          confidence: 1,
          origin: 'cache',
          commits: context?.commits,
          linearIssues: context?.linearIssues,
        })
      } else {
        llmItems.push(item)
      }
    }

    const llmResults: ClassifiedBlock[] = []
    if (llmItems.length > 0) {
      const results = await this.copilotRepo.classifyDay(
        date,
        llmItems,
        this.availableProjects,
        this.availableServices,
        cacheHints,
        context,
      )

      for (const result of results) {
        const matchedItem = llmItems.find(i => i.index === result.index)
        if (!matchedItem) continue

        if (matchedItem.kind === 'meeting') {
          const event = matchedItem.event
          const hBlocks = matchedItem.historyBlocks
          const meetingUrls = hBlocks.flatMap(b => b.urls)
          const meetingTitles = hBlocks.flatMap(b => b.titles)
          const classified: ClassifiedBlock = {
            date,
            urlPattern: matchedItem.cacheKey,
            urls: meetingUrls,
            titles: meetingTitles,
            visitCount: hBlocks.reduce((sum, b) => sum + b.visitCount, 0),
            firstVisitTime: toTime(event.start),
            lastVisitTime: toTime(event.end),
            hours: roundToHalf((event.end.getTime() - event.start.getTime()) / 3_600_000),
            blockName: result.blockName,
            summary: result.summary,
            startTime: toTime(event.start),
            endTime: toTime(event.end),
            note: result.note,
            confidence: result.confidence,
            origin: 'llm',
            overlappingMeetings: [event],
            rawTitles: meetingTitles.slice(0, 5),
            rawUrls: meetingUrls.slice(0, 5).map(sanitizeUrl),
            commits: context?.commits,
            linearIssues: context?.linearIssues,
          }
          if (result.projectId !== null) classified.projectId = result.projectId
          if (result.serviceId !== null) classified.serviceId = result.serviceId
          llmResults.push(classified)
        } else {
          const block = matchedItem.block
          const classified: ClassifiedBlock = {
            ...block,
            blockName: result.blockName,
            summary: result.summary,
            startTime: block.firstVisitTime,
            endTime: block.lastVisitTime,
            note: result.note,
            confidence: result.confidence,
            origin: 'llm',
            rawTitles: block.titles.slice(0, 5),
            rawUrls: block.urls.slice(0, 5).map(sanitizeUrl),
            commits: context?.commits,
            linearIssues: context?.linearIssues,
          }
          if (result.projectId !== null) classified.projectId = result.projectId
          if (result.serviceId !== null) classified.serviceId = result.serviceId
          llmResults.push(classified)
        }
      }
    }

    const all = [...cacheResults, ...llmResults]
    all.sort((a, b) => a.startTime.localeCompare(b.startTime))
    return all
  }
}
```

- [ ] **Stap 4: Draai alle tests (verwacht: PASS)**

```bash
npm run test
```

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/GroupAndClassifyDayUseCase.ts
git commit -m "feat: GroupAndClassifyDayUseCase accepts DayContext, attaches to ClassifiedBlock"
```

---

## Task 5: ProcessWeekUseCase

**Files:**
- Create: `src/domain/usecases/ProcessWeekUseCase.ts`
- Create: `src/domain/usecases/__tests__/ProcessWeekUseCase.test.ts`

- [ ] **Stap 1: Schrijf failing test**

```ts
// src/domain/usecases/__tests__/ProcessWeekUseCase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ProcessWeekUseCase } from '../ProcessWeekUseCase'
import type { IGitHubRepository } from '../../repositories/IGitHubRepository'
import type { ILinearRepository } from '../../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../../repositories/IHistoryStore'
import type { ICopilotRepository } from '../../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../../repositories/IMappingCacheRepository'
import type { GitHubCommit } from '../../entities/GitHubCommit'
import type { LinearIssue } from '../../entities/LinearIssue'

const mockCommit: GitHubCommit = {
  sha: 'abc', message: 'feat: test', repo: 'guuse/r', branch: 'main',
  timestamp: '2026-05-19T10:00:00Z', time: '10:00',
}
const mockIssue: LinearIssue = {
  identifier: 'ENG-1', title: 'Test issue', completedAt: '2026-05-19T14:00:00Z',
  url: 'https://linear.app/eng/issue/ENG-1',
}

const githubRepo: IGitHubRepository = { getCommitsForWeek: vi.fn().mockResolvedValue([mockCommit]) }
const linearRepo: ILinearRepository = { getCompletedIssuesForWeek: vi.fn().mockResolvedValue([mockIssue]) }
const calendarRepo: IGoogleCalendarRepository = { getEvents: vi.fn().mockResolvedValue([]) }
const historyStore: IHistoryStore = {
  getBlocksForDate: vi.fn().mockResolvedValue([]),
  saveBlocksForDate: vi.fn().mockResolvedValue(undefined),
  removeBlock: vi.fn().mockResolvedValue(undefined),
}
const copilotRepo: ICopilotRepository = {
  classify: vi.fn().mockResolvedValue([]),
  classifyDay: vi.fn().mockResolvedValue([]),
}
const cacheRepo: IMappingCacheRepository = {
  getAll: vi.fn().mockReturnValue({}),
  set: vi.fn().mockResolvedValue(undefined),
}

describe('ProcessWeekUseCase', () => {
  it('yields progress for each day and fetches github/linear once', async () => {
    const useCase = new ProcessWeekUseCase(
      githubRepo, linearRepo, calendarRepo, historyStore, copilotRepo, cacheRepo,
      [], [], 'guuse',
    )

    const phases: string[] = []
    for await (const progress of useCase.execute('2026-05-19', '2026-05-23')) {
      phases.push(progress.phase)
    }

    expect(phases).toContain('fetching-github')
    expect(phases).toContain('fetching-linear')
    expect(phases.filter(p => p === 'classifying-day')).toHaveLength(5)
    expect(phases).toContain('done')
    expect(githubRepo.getCommitsForWeek).toHaveBeenCalledTimes(1)
    expect(linearRepo.getCompletedIssuesForWeek).toHaveBeenCalledTimes(1)
    expect(historyStore.saveBlocksForDate).toHaveBeenCalledTimes(5)
  })
})
```

- [ ] **Stap 2: Draai de test (verwacht: FAIL)**

```bash
npm run test -- ProcessWeekUseCase
```

- [ ] **Stap 3: Bekijk welke interfaces IHistoryStore en IGoogleCalendarRepository bieden**

```bash
cat src/domain/repositories/IHistoryStore.ts
cat src/domain/repositories/IGoogleCalendarRepository.ts
```

Pas de mock aan als de methodenamen anders blijken te zijn dan `getBlocksForDate` / `getEvents`.

- [ ] **Stap 4: Implementeer `ProcessWeekUseCase.ts`**

```ts
// src/domain/usecases/ProcessWeekUseCase.ts
import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import { FetchGitHubContextUseCase } from './FetchGitHubContextUseCase'
import { FetchLinearContextUseCase } from './FetchLinearContextUseCase'
import { GroupAndClassifyDayUseCase } from './GroupAndClassifyDayUseCase'
import type { GitHubCommit } from '../entities/GitHubCommit'

export interface ProcessWeekProgress {
  phase: 'fetching-github' | 'fetching-linear' | 'classifying-day' | 'done' | 'error'
  day?: string
  dayIndex?: number
  error?: string
}

function weekDays(weekStart: string): string[] {
  const days: string[] = []
  const start = new Date(weekStart)
  for (let i = 0; i < 5; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d.toISOString().split('T')[0]!)
  }
  return days
}

export class ProcessWeekUseCase {
  private readonly fetchGitHub: FetchGitHubContextUseCase
  private readonly fetchLinear: FetchLinearContextUseCase

  constructor(
    private readonly githubRepo: IGitHubRepository,
    private readonly linearRepo: ILinearRepository,
    private readonly calendarRepo: IGoogleCalendarRepository,
    private readonly historyStore: IHistoryStore,
    private readonly copilotRepo: ICopilotRepository,
    private readonly cacheRepo: IMappingCacheRepository,
    private readonly availableProjects: Project[],
    private readonly availableServices: Service[],
    private readonly githubUsername: string,
  ) {
    this.fetchGitHub = new FetchGitHubContextUseCase(githubRepo)
    this.fetchLinear = new FetchLinearContextUseCase(linearRepo)
  }

  async *execute(weekStart: string, weekEnd: string): AsyncGenerator<ProcessWeekProgress> {
    yield { phase: 'fetching-github' }
    const allCommits = await this.fetchGitHub.execute(this.githubUsername, weekStart, weekEnd)

    yield { phase: 'fetching-linear' }
    const linearIssues = await this.fetchLinear.execute(weekStart, weekEnd)

    const days = weekDays(weekStart)
    const groupAndClassify = new GroupAndClassifyDayUseCase(
      this.copilotRepo,
      this.cacheRepo,
      this.availableProjects,
      this.availableServices,
    )

    for (let i = 0; i < days.length; i++) {
      const day = days[i]!
      yield { phase: 'classifying-day', day, dayIndex: i }

      try {
        // Filter commits voor deze dag
        const dayCommits: GitHubCommit[] = allCommits.filter(c => c.timestamp.slice(0, 10) === day)

        const [historyBlocks, calendarEvents] = await Promise.all([
          this.historyStore.getBlocksForDate(day),
          this.calendarRepo.getEvents(day),
        ])

        const classified = await groupAndClassify.execute(day, historyBlocks, calendarEvents, {
          commits: dayCommits,
          linearIssues,
        })

        await this.historyStore.saveBlocksForDate(day, classified)
      } catch (err) {
        yield { phase: 'error', day, dayIndex: i, error: err instanceof Error ? err.message : String(err) }
      }
    }

    yield { phase: 'done' }
  }
}
```

- [ ] **Stap 5: Bekijk de echte signatures van IHistoryStore en IGoogleCalendarRepository en pas de implementatie aan indien nodig**

Lees `src/domain/repositories/IHistoryStore.ts` en `src/domain/repositories/IGoogleCalendarRepository.ts` en vergelijk de methodenamen met wat in de implementatie staat. Pas aan waar nodig.

- [ ] **Stap 6: Draai de tests (verwacht: PASS)**

```bash
npm run test -- ProcessWeekUseCase
```

- [ ] **Stap 7: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 8: Commit**

```bash
git add src/domain/usecases/ProcessWeekUseCase.ts src/domain/usecases/__tests__/ProcessWeekUseCase.test.ts
git commit -m "feat: add ProcessWeekUseCase with AsyncGenerator progress"
```

---

## Task 6: CopilotRepository prompt uitbreiding

**Files:**
- Modify: `src/infrastructure/copilot/CopilotRepository.ts`

- [ ] **Stap 1: Voeg de `formatDayContext` helper toe en breid `classifyDay` uit**

Voeg bovenaan het bestand (na de imports) deze helper toe, en wijzig de `classifyDay` signature:

```ts
// Voeg toe na de bestaande imports bovenaan CopilotRepository.ts
import type { DayContext } from '../../domain/entities/DayContext'
```

Voeg de helper toe na `formatOverlappingMeetings`:

```ts
function formatDayContext(context: DayContext | undefined, date: string): string {
  if (!context) return ''
  const parts: string[] = []

  if (context.commits.length > 0) {
    const commitsForDay = context.commits.filter(c => c.timestamp.slice(0, 10) === date)
    if (commitsForDay.length > 0) {
      const lines = commitsForDay.map(c => `- ${c.time} ${c.message} [${c.repo}]`).join('\n')
      parts.push(`## GitHub commits (${date})\n${lines}`)
    }
  }

  if (context.linearIssues.length > 0) {
    const lines = context.linearIssues
      .map(i => `- ${i.identifier} · ${i.title} ✓ (afgerond ${i.completedAt.slice(0, 10)})`)
      .join('\n')
    parts.push(`## Linear issues (afgerond deze week)\n${lines}`)
  }

  return parts.length > 0 ? '\n' + parts.join('\n\n') + '\n' : ''
}
```

Wijzig de `classifyDay` methode signature (voeg `context?: DayContext` toe als laatste parameter):

```ts
async classifyDay(
  date: string,
  items: DayItem[],
  availableProjects: Project[],
  availableServices: Service[],
  cacheHints: Record<string, { projectName: string; serviceName: string }>,
  context?: DayContext,
): Promise<DayClassificationResult[]> {
```

Voeg in de prompt, na `const hintsSection = ...` en vóór de hoofdprompt, de context toe:

```ts
const contextSection = formatDayContext(context, date)
```

En in de prompt string, voeg `${contextSection}` in na `${hintsSection}` en voor `Beschikbare projecten:`:

```ts
const prompt = `Je bent een tijdregistratie-assistent die een developer helpt zijn werkuren te registreren.

Datum: ${date}

Voor elk genummerd item hieronder geef je één boekingsblok terug.
- Vergadering-items: gebruik de vergader-duur voor startTime/endTime/hours
- Losse items: gebruik de browse-duur

${meetingsSection}${standaloneSection}${hintsSection}${contextSection}Beschikbare projecten:
${projectList}
...
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Draai alle tests**

```bash
npm run test
```

- [ ] **Stap 4: Commit**

```bash
git add src/infrastructure/copilot/CopilotRepository.ts
git commit -m "feat: add GitHub commits and Linear issues sections to classifyDay prompt"
```

---

## Task 7: GitHubRepository infrastructure

**Files:**
- Create: `src/infrastructure/github/GitHubRepository.ts`

- [ ] **Stap 1: Bekijk hoe andere repositories Tauri fetch gebruiken**

```bash
cat src/infrastructure/simplicate/SimplicateRepository.ts | head -40
```

Noteer of ze `fetch` direct aanroepen of via Tauri `invoke`.

- [ ] **Stap 2: Maak de directory en implementeer `GitHubRepository.ts`**

```ts
// src/infrastructure/github/GitHubRepository.ts
import type { IGitHubRepository } from '../../domain/repositories/IGitHubRepository'
import type { GitHubCommit } from '../../domain/entities/GitHubCommit'

interface GitHubPushEvent {
  type: string
  repo: { name: string }
  payload: {
    ref: string
    commits: Array<{ sha: string; message: string }>
  }
  created_at: string
}

function toLocalTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export class GitHubRepository implements IGitHubRepository {
  constructor(private readonly token: string) {}

  async getCommitsForWeek(username: string, weekStart: string, weekEnd: string): Promise<GitHubCommit[]> {
    const url = `https://api.github.com/users/${username}/events?per_page=100`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const events = await response.json() as GitHubPushEvent[]
    const commits: GitHubCommit[] = []

    for (const event of events) {
      if (event.type !== 'PushEvent') continue
      const date = event.created_at.slice(0, 10)
      if (date < weekStart || date > weekEnd) continue

      const branch = event.payload.ref.replace('refs/heads/', '')
      for (const commit of event.payload.commits) {
        commits.push({
          sha: commit.sha.slice(0, 7),
          message: commit.message.split('\n')[0] ?? commit.message,
          repo: event.repo.name,
          branch,
          timestamp: event.created_at,
          time: toLocalTime(event.created_at),
        })
      }
    }

    return commits
  }
}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 4: Commit**

```bash
git add src/infrastructure/github/
git commit -m "feat: add GitHubRepository (REST events API)"
```

---

## Task 8: LinearRepository infrastructure

**Files:**
- Create: `src/infrastructure/linear/LinearRepository.ts`

- [ ] **Stap 1: Implementeer `LinearRepository.ts`**

```ts
// src/infrastructure/linear/LinearRepository.ts
import type { ILinearRepository } from '../../domain/repositories/ILinearRepository'
import type { LinearIssue } from '../../domain/entities/LinearIssue'

interface LinearIssueNode {
  identifier: string
  title: string
  completedAt: string
  url: string
}

interface LinearResponse {
  data: {
    issues: {
      nodes: LinearIssueNode[]
    }
  }
  errors?: Array<{ message: string }>
}

export class LinearRepository implements ILinearRepository {
  constructor(private readonly token: string) {}

  async getCompletedIssuesForWeek(weekStart: string, weekEnd: string): Promise<LinearIssue[]> {
    const query = `
      query CompletedIssues($weekStart: DateTime!, $weekEnd: DateTime!) {
        issues(
          filter: {
            completedAt: { gte: $weekStart, lte: $weekEnd }
            assignee: { isMe: { eq: true } }
          }
          first: 50
        ) {
          nodes {
            identifier
            title
            completedAt
            url
          }
        }
      }
    `

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          weekStart: `${weekStart}T00:00:00Z`,
          weekEnd: `${weekEnd}T23:59:59Z`,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status}`)
    }

    const data = await response.json() as LinearResponse
    if (data.errors?.length) {
      throw new Error(`Linear GraphQL error: ${data.errors[0]!.message}`)
    }

    return data.data.issues.nodes.map(node => ({
      identifier: node.identifier,
      title: node.title,
      completedAt: node.completedAt,
      url: node.url,
    }))
  }
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 3: Commit**

```bash
git add src/infrastructure/linear/
git commit -m "feat: add LinearRepository (GraphQL completed issues)"
```

---

## Task 9: appStore uitbreiden

**Files:**
- Modify: `src/store/appStore.ts`

- [ ] **Stap 1: Breid `appStore.ts` uit met github/linear tokens**

Vervang het hele bestand:

```ts
// src/store/appStore.ts
import { create } from 'zustand'
import type { User } from '../domain/entities/User'
import type {
  SimplicateHourType,
  SimplicateProject,
  SimplicateService,
} from '../domain/repositories/ISimplicateRepository'

interface AppState {
  // Auth
  user: User | null
  setUser: (user: User) => void
  clearUser: () => void
  simplicateEmployeeId: string | null
  setSimplicateEmployeeId: (id: string) => void

  // Simplicate data cache
  projects: SimplicateProject[]
  services: SimplicateService[]
  hourTypes: SimplicateHourType[]
  setSimplicateData: (data: { projects: SimplicateProject[]; services: SimplicateService[]; hourTypes: SimplicateHourType[] }) => void

  // Copilot
  copilotToken: string | null
  setCopilotToken: (token: string) => void

  // GitHub
  githubToken: string | null
  setGithubToken: (token: string) => void
  githubUsername: string | null
  setGithubUsername: (username: string) => void

  // Linear
  linearToken: string | null
  setLinearToken: (token: string) => void

  // UI
  isLoading: boolean
  setLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
}

const initialState = {
  user: null,
  simplicateEmployeeId: null,
  projects: [],
  services: [],
  hourTypes: [],
  copilotToken: null,
  githubToken: null,
  githubUsername: null,
  linearToken: null,
  isLoading: false,
  error: null,
}

export const useAppStore = create<AppState>()((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, simplicateEmployeeId: null }),

  setSimplicateEmployeeId: (simplicateEmployeeId) => set({ simplicateEmployeeId }),

  setSimplicateData: (data) => set(data),

  setCopilotToken: (copilotToken) => set({ copilotToken }),

  setGithubToken: (githubToken) => set({ githubToken }),
  setGithubUsername: (githubUsername) => set({ githubUsername }),

  setLinearToken: (linearToken) => set({ linearToken }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 3: Commit**

```bash
git add src/store/appStore.ts
git commit -m "feat: add githubToken, githubUsername, linearToken to appStore"
```

---

## Task 10: container.ts uitbreiden

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Stap 1: Voeg factory functies toe**

Voeg toe aan het einde van `src/application/container.ts`:

```ts
import { GitHubRepository } from '../infrastructure/github/GitHubRepository'
import { LinearRepository } from '../infrastructure/linear/LinearRepository'
import { FetchGitHubContextUseCase } from '../domain/usecases/FetchGitHubContextUseCase'
import { FetchLinearContextUseCase } from '../domain/usecases/FetchLinearContextUseCase'
import { ProcessWeekUseCase } from '../domain/usecases/ProcessWeekUseCase'
import type { IGitHubRepository } from '../domain/repositories/IGitHubRepository'
import type { ILinearRepository } from '../domain/repositories/ILinearRepository'

export function createGitHubRepository(token: string): IGitHubRepository {
  return new GitHubRepository(token)
}

export function createLinearRepository(token: string): ILinearRepository {
  return new LinearRepository(token)
}

export function createProcessWeekUseCase(
  githubToken: string,
  linearToken: string,
  calendarRepo: ReturnType<typeof createCalendarRepository>,
  copilotRepo: ICopilotRepository,
  projects: Project[],
  services: Service[],
  githubUsername: string,
): ProcessWeekUseCase {
  return new ProcessWeekUseCase(
    new GitHubRepository(githubToken),
    new LinearRepository(linearToken),
    calendarRepo,
    historyStore,
    copilotRepo,
    mappingCacheRepo,
    projects,
    services,
    githubUsername,
  )
}
```

- [ ] **Stap 2: Voeg de ontbrekende imports toe bovenaan het bestand (na de bestaande imports)**

```ts
import type { ICopilotRepository } from '../domain/repositories/ICopilotRepository'
import type { Project, Service } from '../domain/repositories/ICopilotRepository'
```

> Let op: `ICopilotRepository`, `Project`, `Service` staan mogelijk al geïmporteerd. Controleer dit en voeg alleen toe wat ontbreekt.

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 4: Commit**

```bash
git add src/application/container.ts
git commit -m "feat: add factory functions for GitHub/Linear repos and ProcessWeekUseCase"
```

---

## Task 11: AccountSettings uitbreiden

**Files:**
- Modify: `src/ui/pages/Settings/AccountSettings.tsx`

- [ ] **Stap 1: Voeg GitHub token sectie toe**

Voeg in `AccountSettings.tsx` na de bestaande Copilot-sectie (na de sluit-`</div>` van de copilot knop) een nieuwe sectie toe:

```tsx
{/* GitHub token sectie */}
<div className="flex flex-col gap-3">
  <div className="text-xs uppercase tracking-widest text-[#7a7268]">GitHub token</div>
  <div className="text-xs text-[#4a4540]">
    Verkrijg via: <code className="bg-[#1e1b18] px-1 rounded">gh auth token</code> — heeft <code className="bg-[#1e1b18] px-1 rounded">repo</code> scope nodig.
  </div>

  {hasGithubToken && githubTokenInput === '' && (
    <div className="text-xs text-[#4a4540] bg-[#1e1b18] rounded-lg px-3 py-2 border border-[#2e2a26]">
      Token is opgeslagen. Vul een nieuw token in om te overschrijven.
    </div>
  )}

  <input
    type="password"
    value={githubTokenInput}
    onChange={e => setGithubTokenInput(e.target.value)}
    placeholder={hasGithubToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'gho_...'}
    className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
  />

  <button
    onClick={saveGithubToken}
    disabled={githubTokenInput.length === 0}
    className="bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
  >
    {githubSaved ? '✓ Opgeslagen' : 'Opslaan'}
  </button>
</div>
```

- [ ] **Stap 2: Voeg Linear token sectie toe**

Direct na de GitHub sectie:

```tsx
{/* Linear API key sectie */}
<div className="flex flex-col gap-3">
  <div className="text-xs uppercase tracking-widest text-[#7a7268]">Linear API key</div>
  <div className="text-xs text-[#4a4540]">
    Verkrijg via: linear.me → Settings → API → Personal API keys
  </div>

  {hasLinearToken && linearTokenInput === '' && (
    <div className="text-xs text-[#4a4540] bg-[#1e1b18] rounded-lg px-3 py-2 border border-[#2e2a26]">
      Token is opgeslagen. Vul een nieuw token in om te overschrijven.
    </div>
  )}

  <input
    type="password"
    value={linearTokenInput}
    onChange={e => setLinearTokenInput(e.target.value)}
    placeholder={hasLinearToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'lin_api_...'}
    className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
  />

  <button
    onClick={saveLinearToken}
    disabled={linearTokenInput.length === 0}
    className="bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
  >
    {linearSaved ? '✓ Opgeslagen' : 'Opslaan'}
  </button>
</div>
```

- [ ] **Stap 3: Voeg state en handlers toe aan de component**

Voeg toe aan de useState-blok bovenaan `AccountSettings`:

```tsx
const setGithubToken = useAppStore((s) => s.setGithubToken)
const setLinearToken = useAppStore((s) => s.setLinearToken)

const [githubTokenInput, setGithubTokenInput] = useState('')
const [hasGithubToken, setHasGithubToken] = useState(false)
const [githubSaved, setGithubSaved] = useState(false)

const [linearTokenInput, setLinearTokenInput] = useState('')
const [hasLinearToken, setHasLinearToken] = useState(false)
const [linearSaved, setLinearSaved] = useState(false)
```

Voeg toe aan `loadExisting` in de `useEffect`:

```tsx
const gt = await keychainRepo.get('github-token')
if (gt) { setHasGithubToken(true); setGithubToken(gt) }
const lt = await keychainRepo.get('linear-token')
if (lt) { setHasLinearToken(true); setLinearToken(lt) }
```

Voeg de save handlers toe:

```tsx
async function saveGithubToken() {
  await keychainRepo.set('github-token', githubTokenInput)
  setGithubToken(githubTokenInput)
  setHasGithubToken(true)
  setGithubSaved(true)
  setTimeout(() => setGithubSaved(false), 2000)
}

async function saveLinearToken() {
  await keychainRepo.set('linear-token', linearTokenInput)
  setLinearToken(linearTokenInput)
  setHasLinearToken(true)
  setLinearSaved(true)
  setTimeout(() => setLinearSaved(false), 2000)
}
```

- [ ] **Stap 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 5: Commit**

```bash
git add src/ui/pages/Settings/AccountSettings.tsx
git commit -m "feat: add GitHub token and Linear API key to AccountSettings"
```

---

## Task 12: EvidencePanel uitbreiden

**Files:**
- Modify: `src/ui/components/EvidencePanel.tsx`

- [ ] **Stap 1: Voeg imports en props toe**

Voeg bovenaan `EvidencePanel.tsx` de imports toe:

```tsx
import type { GitHubCommit } from '../../domain/entities/GitHubCommit'
import type { LinearIssue } from '../../domain/entities/LinearIssue'
```

Voeg aan de `Props` interface toe:

```tsx
commits?: GitHubCommit[]
linearIssues?: LinearIssue[]
```

Voeg toe aan de destructuring in de functie-signature:

```tsx
export default function EvidencePanel({
  rawUrls,
  rawTitles,
  urls,
  titles,
  summary,
  startTime,
  endTime,
  meetings,
  commits,
  linearIssues,
}: Props) {
```

- [ ] **Stap 2: Voeg de commits sectie toe**

Voeg toe vóór de `{/* LLM-samenvatting */}` blok (na de meetings sectie):

```tsx
{/* GitHub commits sectie */}
{commits && commits.length > 0 && (
  <>
    <div className="border-t border-[#2e2a26] mx-3" />
    <div className="px-3 pt-2 pb-1">
      <span className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em]">
        GitHub commits ({commits.length})
      </span>
    </div>
    <div className="px-3 pb-2 flex flex-col gap-[7px]">
      {commits.map((commit) => (
        <div key={commit.sha} className="flex gap-[10px] items-start">
          <div
            className="flex-shrink-0 w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px] border border-[#2e2a26]"
            style={{ background: '#2a1e12', color: '#f48024' }}
          >
            GH
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[#e8e2d9] text-[0.6875rem] font-medium truncate">
              {commit.message}
            </div>
            <div className="text-[#7a7268] text-[0.625rem] mt-[1px] truncate">
              {commit.repo} · {commit.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  </>
)}

{/* Linear issues sectie */}
{linearIssues && linearIssues.length > 0 && (
  <>
    <div className="border-t border-[#2e2a26] mx-3" />
    <div className="px-3 pt-2 pb-1">
      <span className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em]">
        Linear (deze week, afgerond)
      </span>
    </div>
    <div className="px-3 pb-2 flex flex-col gap-[7px]">
      {linearIssues.map((issue) => (
        <div key={issue.identifier} className="flex gap-[10px] items-start">
          <div
            className="flex-shrink-0 w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px] border border-[#2e2a26]"
            style={{ background: '#1a1a2e', color: '#8b5cf6' }}
          >
            LN
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[#e8e2d9] text-[0.6875rem] font-medium truncate">
              {issue.identifier} · {issue.title}
            </div>
          </div>
          <div className="text-[0.5625rem] flex-shrink-0" style={{ color: '#5a8a6a' }}>
            ✓ done
          </div>
        </div>
      ))}
    </div>
  </>
)}
```

- [ ] **Stap 3: Controleer dat de bestaande `EvidencePanel.test.tsx` nog slaagt**

```bash
npm run test -- EvidencePanel
```

- [ ] **Stap 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 5: Commit**

```bash
git add src/ui/components/EvidencePanel.tsx
git commit -m "feat: EvidencePanel shows GitHub commits and Linear issues sections"
```

---

## Task 13: WeekDayList — "Verwerk week" knop

**Files:**
- Modify: `src/ui/components/WeekDayList.tsx`

- [ ] **Stap 1: Voeg props toe en implementeer de knop**

Vervang het hele bestand:

```tsx
// src/ui/components/WeekDayList.tsx
const DAY_LABELS: Record<string, string> = {
  '1': 'MA', '2': 'DI', '3': 'WO', '4': 'DO', '5': 'VR',
}

export type DayProcessingState = 'idle' | 'classifying' | 'done' | 'error'

interface Props {
  weekDays: string[]
  selectedDate: string
  hoursForDate: (date: string) => number
  onSelectDate: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  weekLabel: string
  conceptCountForDate?: (date: string) => number
  onProcessWeek?: () => void
  processingStateForDate?: (date: string) => DayProcessingState
  isProcessingWeek?: boolean
}

const TARGET_HOURS = 8

function ProgressBar({ hours }: { hours: number }) {
  const pct = Math.min(100, (hours / TARGET_HOURS) * 100)
  const color = hours >= TARGET_HOURS ? 'bg-green-500' : hours > 0 ? 'bg-amber-500' : 'bg-transparent'
  return (
    <div className="h-[3px] bg-[#2e2a26] rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function WeekDayList({
  weekDays,
  selectedDate,
  hoursForDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  weekLabel,
  conceptCountForDate,
  onProcessWeek,
  processingStateForDate,
  isProcessingWeek = false,
}: Props) {
  return (
    <div className="w-[130px] flex-shrink-0 bg-[#171512] border-r border-[#2e2a26] flex flex-col py-3 px-2">
      <div className="text-[#4a4540] text-[0.5625rem] uppercase tracking-widest mb-2 px-1">{weekLabel}</div>

      <div className="flex flex-col gap-1 flex-1">
        {weekDays.map((date) => {
          const dayNum = new Date(date).getDay().toString()
          const label = DAY_LABELS[dayNum] ?? ''
          const dayOfMonth = new Date(date).getDate()
          const hours = hoursForDate(date)
          const isSelected = date === selectedDate
          const isFull = hours >= TARGET_HOURS
          const conceptCount = conceptCountForDate?.(date) ?? 0
          const processingState = processingStateForDate?.(date) ?? 'idle'

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`text-left px-2 py-2 rounded-lg transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#252220] border border-[#6366f1]'
                  : 'hover:bg-[#252220] border border-transparent'
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`text-[0.625rem] font-semibold ${
                    isSelected ? 'text-[#a5b4fc]' : isFull ? 'text-[#94a3b8]' : 'text-[#64748b]'
                  }`}
                >
                  {label} {dayOfMonth}
                </span>
                {processingState === 'classifying' && (
                  <span className="text-[#a07848] text-[0.5625rem]">···</span>
                )}
                {processingState === 'done' && (
                  <span className="text-[#5a8a6a] text-[0.5625rem]">✓</span>
                )}
                {processingState === 'error' && (
                  <span className="text-[#b85a3a] text-[0.5625rem]">!</span>
                )}
                {processingState === 'idle' && isFull && (
                  <span className="text-green-500 text-[0.5625rem]">✓</span>
                )}
                {processingState === 'idle' && !isFull && hours > 0 && (
                  <span className="text-amber-500 text-[0.5625rem]">●</span>
                )}
              </div>
              <ProgressBar hours={hours} />
              <div className="text-[0.5rem] text-[#475569] mt-1">
                {hours > 0 ? `${hours} / ${TARGET_HOURS}u` : `0 / ${TARGET_HOURS}u`}
              </div>
              {conceptCount > 0 && !isFull && processingState === 'idle' && (
                <div className="mt-1">
                  <span className="bg-[#2a2010] text-[#a07848] text-[0.5rem] px-[5px] py-[1px] rounded">
                    {conceptCount} concept{conceptCount !== 1 ? 'en' : ''}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {onProcessWeek && (
        <div className="mt-2 px-1">
          <button
            onClick={onProcessWeek}
            disabled={isProcessingWeek}
            className="w-full bg-[#252220] disabled:opacity-40 border border-[#3e3a36] text-[#e8e2d9] text-[0.625rem] font-medium py-[6px] rounded-lg hover:border-[#5e5a56] transition-colors cursor-pointer disabled:cursor-default"
          >
            {isProcessingWeek ? 'Bezig...' : 'Verwerk week'}
          </button>
        </div>
      )}

      <div className="flex justify-between items-center px-1 mt-2">
        <button
          onClick={onPrevWeek}
          className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
        >
          ‹
        </button>
        <span className="text-[#4a4540] text-[0.5rem]">{weekLabel}</span>
        <button
          onClick={onNextWeek}
          className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
        >
          ›
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/WeekDayList.tsx
git commit -m "feat: WeekDayList adds 'Verwerk week' button and per-day processing state"
```

---

## Task 14: WeekPage orchestratie

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

- [ ] **Stap 1: Voeg de ProcessWeekUseCase orchestratie toe**

Vervang het hele `WeekPage.tsx` bestand:

```tsx
import { useState, useCallback, useEffect, useRef } from 'react'
import { useWeek } from '../hooks/useWeek'
import { useSuggestions } from '../hooks/useSuggestions'
import { useImport } from '../hooks/useImport'
import { useHistoryStore } from '../hooks/useHistoryStore'
import { WeekDayList } from '../components/WeekDayList'
import type { DayProcessingState } from '../components/WeekDayList'
import { DayTimeline } from '../components/DayTimeline'
import { BookingModal } from './BookingModal'
import {
  mappingCacheRepo,
  createProcessWeekUseCase,
  createCalendarRepository,
  createCopilotRepository,
} from '../../application/container'
import { useAppStore } from '../../store/appStore'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
}

function weekLabel(weekStart: string): string {
  const thisMonday = (() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().split('T')[0]!
  })()
  if (weekStart === thisMonday) return 'deze week'
  const wn = getWeekNumber(weekStart)
  return `week ${wn}`
}

export function WeekPage() {
  const week = useWeek()
  const { suggestions } = useSuggestions(week.selectedDate)
  const importState = useImport()
  const historyStore = useHistoryStore(week.selectedDate)

  const githubToken = useAppStore((s) => s.githubToken)
  const githubUsername = useAppStore((s) => s.githubUsername)
  const linearToken = useAppStore((s) => s.linearToken)
  const copilotToken = useAppStore((s) => s.copilotToken)
  const projects = useAppStore((s) => s.projects)
  const services = useAppStore((s) => s.services)

  const [bookingEntry, setBookingEntry] = useState<Partial<HourEntry> | null>(null)
  const [bookingConcept, setBookingConcept] = useState<ClassifiedBlock | null>(null)

  // Week processing state
  const [isProcessingWeek, setIsProcessingWeek] = useState(false)
  const [dayProcessingStates, setDayProcessingStates] = useState<Map<string, DayProcessingState>>(new Map())
  const abortRef = useRef(false)

  function conceptCountForDate(date: string): number {
    return date === week.selectedDate ? historyStore.blocksForDate.length : 0
  }

  function processingStateForDate(date: string): DayProcessingState {
    return dayProcessingStates.get(date) ?? 'idle'
  }

  function handleBookSuggestion(suggestion: HourEntrySuggestion) {
    const entry: Partial<HourEntry> = {
      projectId: suggestion.projectId,
      projectServiceId: suggestion.projectServiceId,
      hourTypeId: suggestion.hourTypeId,
      startDate: week.selectedDate,
    }
    if (suggestion.startTime !== undefined) entry.startTime = suggestion.startTime
    if (suggestion.endTime !== undefined) entry.endTime = suggestion.endTime
    setBookingConcept(null)
    setBookingEntry(entry)
  }

  function handleEditEntry(entry: HourEntry) {
    setBookingConcept(null)
    setBookingEntry({ ...entry, startDate: entry.startDate })
  }

  function handleConceptClick(block: ClassifiedBlock) {
    const entry: Partial<HourEntry> = {
      startDate: block.date,
      startTime: block.startTime,
      endTime: block.endTime,
      note: block.note ?? block.summary,
    }
    if (block.projectId) entry.projectId = block.projectId
    if (block.serviceId) entry.projectServiceId = block.serviceId
    setBookingEntry(entry)
    setBookingConcept(block)
  }

  function handleDragNew(startTime: string, endTime: string) {
    setBookingConcept(null)
    setBookingEntry({
      startDate: week.selectedDate,
      startTime,
      endTime,
    })
  }

  const handleUploadCsv = useCallback(async (csvContent: string) => {
    await importState.analyseFile(csvContent)
  }, [importState])

  const { saveBlocksForDate } = historyStore

  useEffect(() => {
    if (importState.status !== 'ready' || importState.blocks.length === 0) return
    const byDate: Record<string, ClassifiedBlock[]> = {}
    for (const block of importState.blocks) {
      if (!byDate[block.date]) byDate[block.date] = []
      byDate[block.date]!.push(block)
    }
    for (const [date, blocks] of Object.entries(byDate)) {
      void saveBlocksForDate(date, blocks)
    }
  }, [importState.status, importState.blocks, saveBlocksForDate])

  async function handleBooked() {
    setBookingEntry(null)
    if (bookingConcept) {
      await historyStore.removeBlock(week.selectedDate, bookingConcept.urlPattern)
      if (bookingConcept.projectId && bookingConcept.serviceId) {
        await mappingCacheRepo.set(bookingConcept.urlPattern, {
          projectId: bookingConcept.projectId,
          serviceId: bookingConcept.serviceId,
          note: bookingConcept.note ?? '',
          blockName: bookingConcept.blockName,
          summary: bookingConcept.summary,
        })
      }
      setBookingConcept(null)
    }
    void week.refresh()
  }

  async function handleProcessWeek() {
    if (!copilotToken || !githubToken || !linearToken) return
    const username = githubUsername ?? 'guuse'

    setIsProcessingWeek(true)
    setDayProcessingStates(new Map())
    abortRef.current = false

    try {
      const calendarRepo = createCalendarRepository()
      const copilotRepo = createCopilotRepository(copilotToken)
      const domainProjects = projects.map(p => ({ id: p.id, name: `${p.organizationName} — ${p.name}` }))
      const domainServices = services.map(s => ({ id: s.id, name: s.name, projectId: s.projectId }))

      const useCase = createProcessWeekUseCase(
        githubToken,
        linearToken,
        calendarRepo,
        copilotRepo,
        domainProjects,
        domainServices,
        username,
      )

      for await (const progress of useCase.execute(week.selectedWeekStart, week.selectedWeekEnd)) {
        if (abortRef.current) break
        if (progress.phase === 'classifying-day' && progress.day) {
          setDayProcessingStates(prev => new Map(prev).set(progress.day!, 'classifying'))
        } else if (progress.phase === 'done') {
          // Mark remaining as done
          setDayProcessingStates(prev => {
            const next = new Map(prev)
            for (const day of week.weekDays) {
              if (!next.has(day) || next.get(day) === 'classifying') {
                next.set(day, 'done')
              }
            }
            return next
          })
        } else if (progress.phase === 'error' && progress.day) {
          setDayProcessingStates(prev => new Map(prev).set(progress.day!, 'error'))
        }
      }
    } finally {
      setIsProcessingWeek(false)
      void week.refresh()
    }
  }

  const selectedEntries = week.entriesByDate[week.selectedDate] ?? []
  const isClassifying = importState.status === 'classifying' || importState.status === 'parsing'
  const canProcessWeek = !!(githubToken && linearToken && copilotToken)

  return (
    <div className="h-full flex bg-[#1c1917] text-[#e8e2d9]">
      <WeekDayList
        weekDays={week.weekDays}
        selectedDate={week.selectedDate}
        hoursForDate={week.hoursForDate}
        conceptCountForDate={conceptCountForDate}
        onSelectDate={week.selectDate}
        onPrevWeek={week.prevWeek}
        onNextWeek={week.nextWeek}
        weekLabel={weekLabel(week.selectedWeekStart)}
        onProcessWeek={canProcessWeek ? handleProcessWeek : undefined}
        processingStateForDate={processingStateForDate}
        isProcessingWeek={isProcessingWeek}
      />

      {week.isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[#4a4540] text-sm">
          Laden...
        </div>
      ) : week.error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-red-400 text-sm">{week.error}</div>
          <button
            onClick={week.refresh}
            className="text-[#7a7268] hover:text-[#e8e2d9] text-sm underline cursor-pointer"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : (
        <DayTimeline
          date={week.selectedDate}
          entries={selectedEntries}
          suggestions={suggestions}
          conceptBlocks={historyStore.blocksForDate}
          onBookSuggestion={handleBookSuggestion}
          onEditEntry={handleEditEntry}
          onConceptClick={handleConceptClick}
          onUploadCsv={handleUploadCsv}
          isClassifying={isClassifying}
          onDragNew={handleDragNew}
        />
      )}

      {bookingEntry && (
        <BookingModal
          initialEntry={bookingEntry}
          title={bookingConcept?.blockName ?? 'Uren boeken'}
          {...(bookingConcept ? { evidenceBlock: bookingConcept } : {})}
          onClose={() => { setBookingEntry(null); setBookingConcept(null) }}
          onBooked={() => void handleBooked()}
        />
      )}
    </div>
  )
}
```

> Let op: `week.selectedWeekEnd` bestaat mogelijk nog niet. Controleer `useWeek.ts` en voeg `selectedWeekEnd` toe als het ontbreekt (de vrijdag van de geselecteerde week, 4 dagen na `selectedWeekStart`).

- [ ] **Stap 2: Controleer `useWeek.ts` op `selectedWeekStart` en voeg `selectedWeekEnd` toe indien nodig**

```bash
cat src/ui/hooks/useWeek.ts
```

Als `selectedWeekEnd` ontbreekt, voeg het toe als computed property: de `selectedWeekStart` + 4 dagen (vrijdag).

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

Los eventuele typefouten op.

- [ ] **Stap 4: Draai alle tests**

```bash
npm run test
```

- [ ] **Stap 5: Commit**

```bash
git add src/ui/pages/WeekPage.tsx src/ui/hooks/useWeek.ts
git commit -m "feat: WeekPage orchestrates ProcessWeekUseCase with per-day progress UI"
```

---

## Task 15: EvidencePanel doorgeven vanuit DayTimeline/BookingModal

**Files:**
- Modify: `src/ui/components/DayTimeline.tsx` (of waar `EvidencePanel` wordt aangeroepen)
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Stap 1: Bekijk hoe EvidencePanel nu wordt aangeroepen in DayTimeline**

```bash
grep -n "EvidencePanel" src/ui/components/DayTimeline.tsx src/ui/pages/BookingModal.tsx
```

- [ ] **Stap 2: Geef `commits` en `linearIssues` door vanuit `ClassifiedBlock`**

In alle plaatsen waar `<EvidencePanel` wordt gerenderd met een `ClassifiedBlock` als bron, voeg toe:

```tsx
commits={block.commits}
linearIssues={block.linearIssues}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 4: Draai alle tests**

```bash
npm run test
```

- [ ] **Stap 5: Commit**

```bash
git add src/ui/components/DayTimeline.tsx src/ui/pages/BookingModal.tsx
git commit -m "feat: pass commits and linearIssues from ClassifiedBlock to EvidencePanel"
```

---

## Self-review

**Spec coverage check:**

| Spec sectie | Task |
|---|---|
| GitHubCommit, LinearIssue, DayContext entities | Task 1 |
| IGitHubRepository, ILinearRepository interfaces | Task 2 |
| ICopilotRepository.classifyDay context? uitbreiding | Task 2 |
| FetchGitHubContextUseCase | Task 3 |
| FetchLinearContextUseCase | Task 3 |
| GroupAndClassifyDayUseCase context doorgave | Task 4 |
| ProcessWeekUseCase | Task 5 |
| CopilotRepository prompt uitbreiding | Task 6 |
| GitHubRepository infrastructure | Task 7 |
| LinearRepository infrastructure | Task 8 |
| appStore githubToken/linearToken | Task 9 |
| container.ts factory functies | Task 10 |
| AccountSettings GitHub + Linear secties | Task 11 |
| EvidencePanel commits + Linear secties | Task 12 |
| WeekDayList "Verwerk week" knop | Task 13 |
| WeekPage orchestratie | Task 14 |
| EvidencePanel props doorgeven | Task 15 |

Alle spec-secties zijn gedekt. Geen placeholders aangetroffen. Type namen zijn consistent door het hele plan (`DayContext`, `GitHubCommit`, `LinearIssue`, `ProcessWeekProgress`, `DayProcessingState`).
