# Week vullen CTA redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verschuif de primaire UX van "upload CSV" naar "verwerk week/dag" — lege staat toont agenda, "Verwerk week/dag" zijn de hoofd-CTAs, CSV-upload is een beheer-actie, en een warning popup waarschuwt als er geen browser history beschikbaar is.

**Architecture:** `ProcessDayUseCase` wordt geëxtraheerd uit `ProcessWeekUseCase`. `IHistoryStore` krijgt `hasHistoryForWeek`. UI krijgt een dag-CTA in de DayTimeline-header, een prominentere week-CTA, een CSV-knop in WeekDayList, en een `NoHistoryWarningModal`.

**Tech Stack:** TypeScript strict, React 18, Tailwind CSS, Vitest, Tauri v2

---

## File map

| Bestand | Actie |
|---|---|
| `src/domain/repositories/IHistoryStore.ts` | Wijzig — voeg `hasHistoryForWeek` toe |
| `src/infrastructure/storage/HistoryStore.ts` | Wijzig — implementeer `hasHistoryForWeek` |
| `src/domain/usecases/ProcessDayUseCase.ts` | Nieuw — extraheer dag-pipeline |
| `src/domain/usecases/ProcessWeekUseCase.ts` | Wijzig — delegeer naar `ProcessDayUseCase` |
| `src/application/container.ts` | Wijzig — exporteer `createProcessDayUseCase` |
| `src/ui/components/NoHistoryWarningModal.tsx` | Nieuw — warning popup |
| `src/ui/components/WeekDayList.tsx` | Wijzig — prominente CTA + CSV-knop |
| `src/ui/components/DayTimeline.tsx` | Wijzig — dag-CTA in header, lege staat aanpassen |
| `src/ui/pages/WeekPage.tsx` | Wijzig — dag-verwerking, warning modal, CSV-handler |
| `src/domain/usecases/ProcessDayUseCase.test.ts` | Nieuw — unit tests |

---

## Task 1: `hasHistoryForWeek` in IHistoryStore en HistoryStore

**Files:**
- Modify: `src/domain/repositories/IHistoryStore.ts`
- Modify: `src/infrastructure/storage/HistoryStore.ts`

- [ ] **Stap 1: Schrijf de failing test**

Maak `src/infrastructure/storage/HistoryStore.test.ts` aan (of voeg toe als die al bestaat):

```typescript
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
      date: '2026-05-11',
      confidence: 0.9,
      origin: 'llm',
    }])
    const result = await store.hasHistoryForWeek('2026-05-18')
    expect(result).toBe(false)
  })
})
```

- [ ] **Stap 2: Run de test — verwacht FAIL**

```bash
npm run test -- src/infrastructure/storage/HistoryStore.test.ts
```

Verwacht: `TypeError: store.hasHistoryForWeek is not a function`

- [ ] **Stap 3: Voeg `hasHistoryForWeek` toe aan `IHistoryStore`**

In `src/domain/repositories/IHistoryStore.ts`, voeg toe na `hasDataForDate`:

```typescript
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'

export interface IHistoryStore {
  load(): Promise<void>
  getBlocksForDate(date: string): Promise<ClassifiedBlock[]>
  setBlocksForDate(date: string, blocks: ClassifiedBlock[]): Promise<void>
  removeBlock(date: string, urlPattern: string): Promise<void>
  hasDataForDate(date: string): Promise<boolean>
  hasHistoryForWeek(weekStart: string): Promise<boolean>
}
```

- [ ] **Stap 4: Implementeer `hasHistoryForWeek` in `HistoryStore`**

In `src/infrastructure/storage/HistoryStore.ts`, voeg toe na de `hasDataForDate` methode (rond regel 80):

```typescript
async hasHistoryForWeek(weekStart: string): Promise<boolean> {
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y!, m! - 1, d!)
  for (let i = 0; i < 5; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    if ((this.data[dateStr]?.length ?? 0) > 0) return true
  }
  return false
}
```

- [ ] **Stap 5: Run de test — verwacht PASS**

```bash
npm run test -- src/infrastructure/storage/HistoryStore.test.ts
```

Verwacht: 3 tests PASS

- [ ] **Stap 6: Commit**

```bash
git add src/domain/repositories/IHistoryStore.ts src/infrastructure/storage/HistoryStore.ts src/infrastructure/storage/HistoryStore.test.ts
git commit -m "feat: add hasHistoryForWeek to IHistoryStore and HistoryStore"
```

---

## Task 2: `ProcessDayUseCase` — extraheer uit ProcessWeekUseCase

**Files:**
- Create: `src/domain/usecases/ProcessDayUseCase.ts`
- Create: `src/domain/usecases/ProcessDayUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing test**

```typescript
// src/domain/usecases/ProcessDayUseCase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ProcessDayUseCase } from './ProcessDayUseCase'
import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'

function makeGitHub(): IGitHubRepository {
  return { fetchCommits: vi.fn().mockResolvedValue([]) } as unknown as IGitHubRepository
}
function makeLinear(): ILinearRepository {
  return { fetchIssues: vi.fn().mockResolvedValue([]) } as unknown as ILinearRepository
}
function makeCalendar(): IGoogleCalendarRepository {
  return { fetchEvents: vi.fn().mockResolvedValue([]) } as unknown as IGoogleCalendarRepository
}
function makeHistoryStore(): IHistoryStore {
  return {
    load: vi.fn(),
    getBlocksForDate: vi.fn().mockResolvedValue([]),
    setBlocksForDate: vi.fn().mockResolvedValue(undefined),
    removeBlock: vi.fn(),
    hasDataForDate: vi.fn().mockResolvedValue(false),
    hasHistoryForWeek: vi.fn().mockResolvedValue(false),
  }
}
function makeCopilot(): ICopilotRepository {
  return {
    classify: vi.fn().mockResolvedValue([]),
    complete: vi.fn().mockResolvedValue('[]'),
  } as unknown as ICopilotRepository
}
function makeCache(): IMappingCacheRepository {
  return { get: vi.fn().mockResolvedValue(null), set: vi.fn() } as unknown as IMappingCacheRepository
}

describe('ProcessDayUseCase', () => {
  it('yields classifying-day and done for a single date', async () => {
    const useCase = new ProcessDayUseCase(
      makeGitHub(),
      makeLinear(),
      makeCalendar(),
      makeHistoryStore(),
      makeCopilot(),
      makeCache(),
      [] as Project[],
      [] as Service[],
      'testuser',
    )

    const phases: string[] = []
    for await (const progress of useCase.execute('2026-05-19')) {
      phases.push(progress.phase)
    }

    expect(phases).toContain('classifying-day')
    expect(phases[phases.length - 1]).toBe('done')
  })

  it('yields error phase when calendar throws', async () => {
    const calendar = makeCalendar()
    ;(calendar.fetchEvents as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('calendar down'))

    const useCase = new ProcessDayUseCase(
      makeGitHub(),
      makeLinear(),
      calendar,
      makeHistoryStore(),
      makeCopilot(),
      makeCache(),
      [] as Project[],
      [] as Service[],
      'testuser',
    )

    const phases: string[] = []
    for await (const progress of useCase.execute('2026-05-19')) {
      phases.push(progress.phase)
    }

    expect(phases).toContain('error')
  })
})
```

- [ ] **Stap 2: Run de test — verwacht FAIL**

```bash
npm run test -- src/domain/usecases/ProcessDayUseCase.test.ts
```

Verwacht: `Cannot find module './ProcessDayUseCase'`

- [ ] **Stap 3: Maak `ProcessDayUseCase.ts` aan**

```typescript
// src/domain/usecases/ProcessDayUseCase.ts
import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import { FetchGitHubContextUseCase } from './FetchGitHubContextUseCase'
import { FetchLinearContextUseCase } from './FetchLinearContextUseCase'
import { GroupAndClassifyDayUseCase } from './GroupAndClassifyDayUseCase'
import { groupCommitsIntoBlocks } from './GroupCommitsIntoBlocks'

export interface ProcessDayProgress {
  phase: 'fetching-context' | 'classifying-day' | 'done' | 'error'
  date?: string
  error?: string
}

export class ProcessDayUseCase {
  private readonly fetchGitHub: FetchGitHubContextUseCase
  private readonly fetchLinear: FetchLinearContextUseCase

  constructor(
    githubRepo: IGitHubRepository,
    linearRepo: ILinearRepository,
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

  async *execute(date: string): AsyncGenerator<ProcessDayProgress> {
    yield { phase: 'fetching-context', date }

    try {
      const dayStart = new Date(date + 'T00:00:00')
      const dayEnd = new Date(date + 'T23:59:59')

      const [allCommits, linearIssues, calendarEvents, historyBlocks] = await Promise.all([
        this.fetchGitHub.execute(this.githubUsername, date, date),
        this.fetchLinear.execute(date, date),
        this.calendarRepo.fetchEvents(dayStart, dayEnd),
        this.historyStore.getBlocksForDate(date),
      ])

      yield { phase: 'classifying-day', date }

      const commitBlocks = groupCommitsIntoBlocks(allCommits, date)
      const allBlocks = [...historyBlocks, ...commitBlocks]

      const groupAndClassify = new GroupAndClassifyDayUseCase(
        this.copilotRepo,
        this.cacheRepo,
        this.availableProjects,
        this.availableServices,
      )

      const classified = await groupAndClassify.execute(date, allBlocks, calendarEvents, {
        commits: allCommits,
        linearIssues,
      })

      await this.historyStore.setBlocksForDate(date, classified)
    } catch (err) {
      yield {
        phase: 'error',
        date,
        error: err instanceof Error ? err.message : String(err),
      }
      return
    }

    yield { phase: 'done', date }
  }
}
```

- [ ] **Stap 4: Run de test — verwacht PASS**

```bash
npm run test -- src/domain/usecases/ProcessDayUseCase.test.ts
```

Verwacht: 2 tests PASS

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/ProcessDayUseCase.ts src/domain/usecases/ProcessDayUseCase.test.ts
git commit -m "feat: extract ProcessDayUseCase from ProcessWeekUseCase"
```

---

## Task 3: Refactor `ProcessWeekUseCase` om `ProcessDayUseCase` te gebruiken

**Files:**
- Modify: `src/domain/usecases/ProcessWeekUseCase.ts`

- [ ] **Stap 1: Vervang de volledige inhoud van `ProcessWeekUseCase.ts`**

```typescript
// src/domain/usecases/ProcessWeekUseCase.ts
import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import { FetchGitHubContextUseCase } from './FetchGitHubContextUseCase'
import { FetchLinearContextUseCase } from './FetchLinearContextUseCase'
import { ProcessDayUseCase } from './ProcessDayUseCase'
import type { GitHubCommit } from '../entities/GitHubCommit'
import type { LinearIssue } from '../entities/LinearIssue'

export interface ProcessWeekProgress {
  phase: 'fetching-github' | 'fetching-linear' | 'context-ready' | 'classifying-day' | 'done' | 'error'
  day?: string
  dayIndex?: number
  error?: string
  // only on context-ready:
  commitsByDay?: Record<string, GitHubCommit[]>
  linearIssues?: LinearIssue[]
}

function weekDays(weekStart: string): string[] {
  const days: string[] = []
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y!, m! - 1, d!)
  for (let i = 0; i < 5; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`)
  }
  return days
}

export class ProcessWeekUseCase {
  private readonly fetchGitHub: FetchGitHubContextUseCase
  private readonly fetchLinear: FetchLinearContextUseCase
  private readonly processDayUseCase: ProcessDayUseCase

  constructor(
    githubRepo: IGitHubRepository,
    linearRepo: ILinearRepository,
    calendarRepo: IGoogleCalendarRepository,
    historyStore: IHistoryStore,
    copilotRepo: ICopilotRepository,
    cacheRepo: IMappingCacheRepository,
    availableProjects: Project[],
    availableServices: Service[],
    githubUsername: string,
  ) {
    this.fetchGitHub = new FetchGitHubContextUseCase(githubRepo)
    this.fetchLinear = new FetchLinearContextUseCase(linearRepo)
    this.processDayUseCase = new ProcessDayUseCase(
      githubRepo,
      linearRepo,
      calendarRepo,
      historyStore,
      copilotRepo,
      cacheRepo,
      availableProjects,
      availableServices,
      githubUsername,
    )
  }

  async *execute(weekStart: string, weekEnd: string): AsyncGenerator<ProcessWeekProgress> {
    yield { phase: 'fetching-github' }
    const allCommits = await this.fetchGitHub.execute(
      // githubUsername is available via processDayUseCase but we need it here too — re-fetch via same repo
      // We pass it through the constructor; store it for context-ready emit
      this.processDayUseCase['githubUsername'] as string,
      weekStart,
      weekEnd,
    )

    yield { phase: 'fetching-linear' }
    const linearIssues = await this.fetchLinear.execute(weekStart, weekEnd)

    const days = weekDays(weekStart)
    const commitsByDay: Record<string, GitHubCommit[]> = {}
    for (const day of days) {
      commitsByDay[day] = allCommits.filter(c => c.date === day)
    }
    yield { phase: 'context-ready', commitsByDay, linearIssues }

    for (let i = 0; i < days.length; i++) {
      const day = days[i]!
      yield { phase: 'classifying-day', day, dayIndex: i }

      for await (const progress of this.processDayUseCase.execute(day)) {
        if (progress.phase === 'error') {
          yield { phase: 'error', day, dayIndex: i, error: progress.error }
        }
        // fetching-context, classifying-day, done — geen forward nodig naar WeekPage
      }
    }

    yield { phase: 'done' }
  }
}
```

- [ ] **Stap 2: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten. Als er een fout is over `githubUsername` private access, los dat op door de property `protected` te maken in `ProcessDayUseCase` of door `githubUsername` als constructor-parameter op te slaan in `ProcessWeekUseCase` zelf (zie stap 3).

- [ ] **Stap 3: Fix indien nodig — sla `githubUsername` op in ProcessWeekUseCase**

Als typecheck klaagt over private access, vervang de constructor en `execute` in `ProcessWeekUseCase`:

In de constructor, voeg toe:
```typescript
private readonly githubUsername: string,
```
als laatste parameter, en pas `execute` aan:
```typescript
const allCommits = await this.fetchGitHub.execute(this.githubUsername, weekStart, weekEnd)
```

Pas ook de constructor-aanroep aan om `githubUsername` niet via private te lezen:
```typescript
constructor(
  githubRepo: IGitHubRepository,
  linearRepo: ILinearRepository,
  calendarRepo: IGoogleCalendarRepository,
  historyStore: IHistoryStore,
  copilotRepo: ICopilotRepository,
  cacheRepo: IMappingCacheRepository,
  availableProjects: Project[],
  availableServices: Service[],
  private readonly githubUsername: string,  // ← voeg dit toe
) {
  this.fetchGitHub = new FetchGitHubContextUseCase(githubRepo)
  this.fetchLinear = new FetchLinearContextUseCase(linearRepo)
  this.processDayUseCase = new ProcessDayUseCase(
    githubRepo, linearRepo, calendarRepo, historyStore,
    copilotRepo, cacheRepo, availableProjects, availableServices, githubUsername,
  )
}
```

En in `execute`:
```typescript
const allCommits = await this.fetchGitHub.execute(this.githubUsername, weekStart, weekEnd)
```

- [ ] **Stap 4: Run alle tests**

```bash
npm run test
```

Verwacht: alle bestaande tests PASS, nieuwe tests PASS

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/ProcessWeekUseCase.ts
git commit -m "refactor: ProcessWeekUseCase delegates to ProcessDayUseCase"
```

---

## Task 4: `createProcessDayUseCase` in container.ts

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Stap 1: Voeg import en factory toe**

Voeg bovenaan de imports toe:
```typescript
import { ProcessDayUseCase } from '../domain/usecases/ProcessDayUseCase'
```

Voeg na `createProcessWeekUseCase` toe:
```typescript
export function createProcessDayUseCase(
  githubToken: string,
  linearToken: string,
  calendarRepo: ReturnType<typeof createCalendarRepository>,
  copilotRepo: ICopilotRepository,
  projects: Project[],
  services: Service[],
  githubUsername: string,
): ProcessDayUseCase {
  return new ProcessDayUseCase(
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

- [ ] **Stap 2: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten

- [ ] **Stap 3: Commit**

```bash
git add src/application/container.ts
git commit -m "feat: export createProcessDayUseCase from container"
```

---

## Task 5: `NoHistoryWarningModal` component

**Files:**
- Create: `src/ui/components/NoHistoryWarningModal.tsx`

- [ ] **Stap 1: Maak het component aan**

```typescript
// src/ui/components/NoHistoryWarningModal.tsx

interface Props {
  scope: 'week' | 'day'
  label: string  // bijv. "week 21" of "maandag 19 mei"
  onConfirm: () => void
  onUpload: () => void
  onCancel: () => void
}

export function NoHistoryWarningModal({ scope: _scope, label, onConfirm, onUpload, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1e1b18] border border-[#3e3a36] rounded-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
        <div className="text-xl">⚠️</div>
        <div>
          <div className="text-[#e8e2d9] font-bold text-[0.875rem] mb-1">
            Geen browsergeschiedenis beschikbaar
          </div>
          <p className="text-[#7a7268] text-[0.75rem] leading-relaxed">
            Er is geen browsergeschiedenis voor <strong className="text-[#a8a29e]">{label}</strong>.
            Voorstellen worden gegenereerd op basis van GitHub, Linear en je agenda — maar zijn mogelijk minder nauwkeurig.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full bg-[#6366f1] hover:bg-[#5558dd] text-white text-[0.75rem] font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Toch verwerken
          </button>
          <button
            onClick={onUpload}
            className="w-full bg-[#252220] hover:bg-[#2e2a26] border border-[#3e3a36] text-[#a8a29e] text-[0.75rem] py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            📂 Upload geschiedenis eerst
          </button>
          <button
            onClick={onCancel}
            className="w-full text-[#4a4540] hover:text-[#7a7268] text-[0.6875rem] py-1.5 transition-colors cursor-pointer bg-transparent border-none"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/NoHistoryWarningModal.tsx
git commit -m "feat: add NoHistoryWarningModal component"
```

---

## Task 6: `WeekDayList` — prominente CTA + CSV-knop

**Files:**
- Modify: `src/ui/components/WeekDayList.tsx`

- [ ] **Stap 1: Voeg `onUploadCsv` prop toe aan de interface**

Vervang de huidige `Props` interface (regels 7–19):

```typescript
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
  onUploadCsv?: () => void
  processingStateForDate?: (date: string) => DayProcessingState
  isProcessingWeek?: boolean
}
```

- [ ] **Stap 2: Voeg `onUploadCsv` toe aan destructuring**

Vervang de destructuring in de functie-definitie (huidige regel 33–45):

```typescript
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
  onUploadCsv,
  processingStateForDate,
  isProcessingWeek = false,
}: Props) {
```

- [ ] **Stap 3: Vervang de knop-sectie (huidige regels 114–124)**

Vervang:
```tsx
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
```

Met:
```tsx
      <div className="mt-2 px-1 flex flex-col gap-1.5">
        {onProcessWeek && (
          <button
            onClick={onProcessWeek}
            disabled={isProcessingWeek}
            className="w-full bg-[#6366f1] hover:bg-[#5558dd] disabled:opacity-40 text-white text-[0.6875rem] font-bold py-[8px] rounded-lg transition-colors cursor-pointer disabled:cursor-default"
          >
            {isProcessingWeek ? 'Bezig...' : '▶ Verwerk week'}
          </button>
        )}
        {onUploadCsv && (
          <button
            onClick={onUploadCsv}
            className="w-full bg-transparent border border-[#2e2a26] hover:border-[#3e3a36] text-[#4a4540] hover:text-[#7a7268] text-[0.5625rem] py-[5px] rounded-lg transition-colors cursor-pointer"
          >
            📂 Upload geschiedenis
          </button>
        )}
      </div>
```

- [ ] **Stap 4: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten (WeekPage geeft `onUploadCsv` nog niet door — dat is OK, prop is optional)

- [ ] **Stap 5: Commit**

```bash
git add src/ui/components/WeekDayList.tsx
git commit -m "feat: WeekDayList — prominent Verwerk week CTA + Upload geschiedenis knop"
```

---

## Task 7: `DayTimeline` — dag-CTA in header, lege staat aanpassen

**Files:**
- Modify: `src/ui/components/DayTimeline.tsx`

- [ ] **Stap 1: Voeg `onProcessDay` prop toe aan de interface**

Vervang de huidige `Props` interface (regels 35–48):

```typescript
interface Props {
  date: string
  entries: HourEntry[]
  suggestions: HourEntrySuggestion[]
  conceptBlocks?: ClassifiedBlock[]
  commits?: GitHubCommit[]
  linearIssues?: LinearIssue[]
  onBookSuggestion: (suggestion: HourEntrySuggestion) => void
  onEditEntry: (entry: HourEntry) => void
  onConceptClick?: (block: ClassifiedBlock) => void
  onUploadCsv?: (csvContent: string) => void
  onProcessDay?: () => void
  isClassifying?: boolean
  onDragNew?: (startTime: string, endTime: string) => void
}
```

- [ ] **Stap 2: Voeg `onProcessDay` toe aan destructuring (huidige regels 50–63)**

```typescript
export function DayTimeline({
  date,
  entries,
  suggestions,
  conceptBlocks = [],
  commits = [],
  linearIssues = [],
  onBookSuggestion,
  onEditEntry,
  onConceptClick,
  onUploadCsv,
  onProcessDay,
  isClassifying = false,
  onDragNew,
}: Props) {
```

- [ ] **Stap 3: Vervang `showCta` logica (huidige regel 131)**

Vervang:
```typescript
  const showCta = !hasConcepts && !hasEntries && !isClassifying
```

Met:
```typescript
  const showEmptyHint = !hasConcepts && !hasEntries && !isClassifying
```

- [ ] **Stap 4: Voeg "Verwerk dag" knop toe in de header**

Vervang het header-blok (huidige regels 277–301) — voeg de knop toe rechts van de progress bar:

```tsx
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2e2a26] flex items-center gap-4 flex-shrink-0">
        <div>
          <div className="text-[#e8e2d9] font-bold capitalize">{dateLabel}</div>
          {hasConcepts ? (
            <div className="text-[#a07848] text-[0.6875rem] mt-0.5">
              {totalHours}u geboekt · {pendingCount > 0 ? `${pendingCount} concept${pendingCount !== 1 ? 'en' : ''} te bevestigen` : 'alle concepten compleet'}
            </div>
          ) : (
            <div className={`text-[0.6875rem] mt-0.5 ${totalHours >= 8 ? 'text-green-400' : 'text-amber-400'}`}>
              {totalHours}u geboekt · {Math.max(0, 8 - totalHours)}u te gaan
            </div>
          )}
        </div>
        <div className="flex-1 h-[5px] bg-[#2e2a26] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${pct}%` }} />
        </div>
        {onProcessDay && (
          <button
            onClick={onProcessDay}
            className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[0.625rem] font-semibold px-3 py-[5px] rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            ▶ Verwerk dag
          </button>
        )}
        {(hasConcepts || hasEntries) && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#252220] border border-[#2e2a26] text-[#7a7268] rounded px-[10px] py-[4px] text-[0.625rem] hover:border-[#3e3a36] transition-colors cursor-pointer flex-shrink-0"
          >
            ↑ Nieuwe CSV
          </button>
        )}
      </div>
```

- [ ] **Stap 5: Vervang de CTA-sectie door lege-staat-hint (huidige regels 310–336)**

Vervang het blok `{/* CTA — geen history */}`:

```tsx
      {/* Lege staat hint */}
      {showEmptyHint && (
        <div
          className="flex-1 relative"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) void handleFileDrop(file)
          }}
        >
          {/* Tijdlijn raster ook in lege staat */}
          <div className="overflow-y-auto px-4 py-3 h-full">
            <div className="flex gap-3">
              <div className="flex flex-col flex-shrink-0 w-8">
                {Array.from({ length: 10 }, (_, i) => i + 8).map((hour) => (
                  <div
                    key={hour}
                    className="relative flex-shrink-0"
                    style={{ height: HOUR_HEIGHT_PX }}
                  >
                    <span className="absolute top-0 text-[#475569] text-[0.5625rem]">
                      {hour.toString().padStart(2, '0')}
                    </span>
                    <span
                      className="absolute text-[#2e3a4a] text-[0.5rem]"
                      style={{ top: HOUR_HEIGHT_PX / 2 }}
                    >
                      :30
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex-1 relative" style={{ minHeight: HOUR_HEIGHT_PX * 10 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className="border-t border-[#1e1b18]"
                    style={{ height: HOUR_HEIGHT_PX }}
                  />
                ))}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-[#2e2a26] text-[0.75rem]">
                    Klik op{' '}
                    <strong className="text-[#3e3a36]">Verwerk dag</strong>
                    {' '}om voorstellen te genereren
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Stap 6: Update de `!showCta` conditie voor de tijdlijn (huidige regel 339)**

Vervang:
```tsx
      {/* Tijdlijn */}
      {!showCta && !isClassifying && (
```
Met:
```tsx
      {/* Tijdlijn */}
      {!showEmptyHint && !isClassifying && (
```

- [ ] **Stap 7: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten

- [ ] **Stap 8: Commit**

```bash
git add src/ui/components/DayTimeline.tsx
git commit -m "feat: DayTimeline — Verwerk dag CTA in header, lege staat met raster en hint"
```

---

## Task 8: `WeekPage` — alles samenvoegen

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

- [ ] **Stap 1: Voeg imports toe**

Voeg toe aan de bestaande imports:

```typescript
import { NoHistoryWarningModal } from '../components/NoHistoryWarningModal'
import {
  mappingCacheRepo,
  createProcessWeekUseCase,
  createProcessDayUseCase,
  createCalendarRepository,
  createCopilotRepository,
} from '../../application/container'
```

*(vervang de bestaande container-import met bovenstaande)*

- [ ] **Stap 2: Voeg state voor warning modal en dag-verwerking toe**

Na de bestaande state declarations (na regel 68), voeg toe:

```typescript
  // Dag-verwerking state
  const [isProcessingDay, setIsProcessingDay] = useState(false)

  // Warning modal state
  type WarningScope = { kind: 'week' } | { kind: 'day'; date: string } | null
  const [warningScope, setWarningScope] = useState<WarningScope>(null)

  // File input ref voor WeekDayList CSV-upload
  const csvInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Stap 3: Voeg `handleProcessDay` toe**

Voeg na `handleProcessWeek` (na regel 224) toe:

```typescript
  async function handleProcessDay(date: string) {
    if (!copilotToken || !githubToken || !linearToken) return
    const username = githubUsername ?? 'guuse'

    // Check of er history is voor deze dag
    const { historyStore: domainHistoryStore } = await import('../../application/container')
    const hasHistory = await domainHistoryStore.hasDataForDate(date)
    if (!hasHistory) {
      setWarningScope({ kind: 'day', date })
      return
    }
    await runProcessDay(date)
  }

  async function runProcessDay(date: string) {
    if (!copilotToken || !githubToken || !linearToken) return
    const username = githubUsername ?? 'guuse'

    setIsProcessingDay(true)
    setDayProcessingStates(prev => new Map(prev).set(date, 'classifying'))

    try {
      const calendarRepo = createCalendarRepository()
      const copilotRepo = createCopilotRepository(copilotToken)
      const domainProjects = projects.map(p => ({ id: p.id, name: `${p.organizationName} — ${p.name}` }))
      const domainServices = services.map(s => ({ id: s.id, name: s.name, projectId: s.projectId }))

      const useCase = createProcessDayUseCase(
        githubToken,
        linearToken,
        calendarRepo,
        copilotRepo,
        domainProjects,
        domainServices,
        username,
      )

      for await (const progress of useCase.execute(date)) {
        if (progress.phase === 'error') {
          setDayProcessingStates(prev => new Map(prev).set(date, 'error'))
          setProcessWeekError(`Fout op ${date}: ${progress.error ?? 'onbekend'}`)
        }
      }

      setDayProcessingStates(prev => new Map(prev).set(date, 'done'))
      void reloadForDate(week.selectedDate)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setProcessWeekError(`Fout bij verwerken dag: ${msg}`)
      setDayProcessingStates(prev => new Map(prev).set(date, 'error'))
    } finally {
      setIsProcessingDay(false)
      void week.refresh()
    }
  }
```

- [ ] **Stap 4: Voeg `handleProcessWeekWithCheck` toe**

Voeg toe vóór `handleProcessWeek`:

```typescript
  async function handleProcessWeekWithCheck() {
    if (!copilotToken || !githubToken || !linearToken) return
    const { historyStore: domainHistoryStore } = await import('../../application/container')
    const hasHistory = await domainHistoryStore.hasHistoryForWeek(week.selectedWeekStart)
    if (!hasHistory) {
      setWarningScope({ kind: 'week' })
      return
    }
    await handleProcessWeek()
  }
```

- [ ] **Stap 5: Voeg `warningLabel` helper toe**

```typescript
  function warningLabel(): string {
    if (!warningScope) return ''
    if (warningScope.kind === 'week') return weekLabel(week.selectedWeekStart)
    const d = new Date(warningScope.date + 'T12:00:00')
    return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function handleWarningConfirm() {
    const scope = warningScope
    setWarningScope(null)
    if (!scope) return
    if (scope.kind === 'week') void handleProcessWeek()
    else void runProcessDay(scope.date)
  }

  function handleWarningUpload() {
    setWarningScope(null)
    csvInputRef.current?.click()
  }
```

- [ ] **Stap 6: Pas de WeekDayList-aanroep aan**

Vervang de huidige `WeekDayList` JSX (regels 235–247):

```tsx
      <WeekDayList
        weekDays={week.weekDays}
        selectedDate={week.selectedDate}
        hoursForDate={week.hoursForDate}
        conceptCountForDate={conceptCountForDate}
        onSelectDate={week.selectDate}
        onPrevWeek={week.prevWeek}
        onNextWeek={week.nextWeek}
        weekLabel={weekLabel(week.selectedWeekStart)}
        {...(canProcessWeek ? { onProcessWeek: handleProcessWeekWithCheck } : {})}
        {...(canProcessWeek ? { onUploadCsv: () => csvInputRef.current?.click() } : {})}
        processingStateForDate={processingStateForDate}
        isProcessingWeek={isProcessingWeek}
      />
```

- [ ] **Stap 7: Pas de DayTimeline-aanroep aan**

Vervang de huidige `DayTimeline` JSX (regels 271–284):

```tsx
          <DayTimeline
            date={week.selectedDate}
            entries={selectedEntries}
            suggestions={suggestions}
            conceptBlocks={historyStore.blocksForDate}
            commits={dayCommits}
            linearIssues={dayLinearIssues}
            onBookSuggestion={handleBookSuggestion}
            onEditEntry={handleEditEntry}
            onConceptClick={handleConceptClick}
            onUploadCsv={handleUploadCsv}
            {...(canProcessWeek ? { onProcessDay: () => void handleProcessDay(week.selectedDate) } : {})}
            isClassifying={isClassifying || isProcessingDay}
            onDragNew={handleDragNew}
          />
```

- [ ] **Stap 8: Voeg hidden file input en NoHistoryWarningModal toe aan de JSX**

Voeg toe vóór de sluitende `</div>` van het root element (vóór regel 298):

```tsx
      {/* Hidden CSV input voor WeekDayList upload-knop */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) {
            void f.text().then(text => handleUploadCsv(text))
          }
          e.target.value = ''
        }}
      />

      {/* Warning modal: geen browsergeschiedenis */}
      {warningScope && (
        <NoHistoryWarningModal
          scope={warningScope.kind}
          label={warningLabel()}
          onConfirm={handleWarningConfirm}
          onUpload={handleWarningUpload}
          onCancel={() => setWarningScope(null)}
        />
      )}
```

- [ ] **Stap 9: Voeg `reloadForDate` destructuring toe (als niet al aanwezig)**

Controleer regel 122 — deze moet zijn:
```typescript
  const { saveBlocksForDate, reloadForDate } = historyStore
```
Dit is al aanwezig. Geen wijziging nodig.

- [ ] **Stap 10: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten. Als de dynamische import van `historyStore` problemen geeft, vervang:
```typescript
const { historyStore: domainHistoryStore } = await import('../../application/container')
```
Met een directe static import bovenaan het bestand:
```typescript
import { historyStore as domainHistoryStore } from '../../application/container'
```
en verwijder de dynamic imports.

- [ ] **Stap 11: Run alle tests**

```bash
npm run test
```

Verwacht: alle tests PASS

- [ ] **Stap 12: Commit**

```bash
git add src/ui/pages/WeekPage.tsx
git commit -m "feat: WeekPage — dag-verwerking, warning modal, CSV-upload via WeekDayList"
```

---

## Task 9: Lint en typecheck

- [ ] **Stap 1: Run lint**

```bash
npm run lint
```

Fix eventuele warnings.

- [ ] **Stap 2: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten

- [ ] **Stap 3: Run alle tests**

```bash
npm run test
```

Verwacht: alle tests PASS

- [ ] **Stap 4: Commit indien lint fixes**

```bash
git add -A
git commit -m "chore: lint fixes"
```

---

## Task 10: Smoke test in de app

- [ ] **Stap 1: Start de dev app**

```bash
make run
```

- [ ] **Stap 2: Controleer de lege staat**

- Open de app, navigeer naar een dag zonder concepts en zonder geboekte uren
- Verwacht: tijdlijn raster zichtbaar, subtiele hint "Klik op Verwerk dag om voorstellen te genereren"
- Verwacht: géén grote CSV-upload CTA card meer

- [ ] **Stap 3: Controleer WeekDayList**

- Verwacht: "▶ Verwerk week" is een prominente paarse knop
- Verwacht: "📂 Upload geschiedenis" staat eronder als secundaire knop

- [ ] **Stap 4: Controleer DayTimeline header**

- Verwacht: "▶ Verwerk dag" knop in de header-balk rechts

- [ ] **Stap 5: Controleer warning modal**

- Zorg dat er geen CSV/history is voor de huidige week
- Klik "▶ Verwerk week"
- Verwacht: warning modal verschijnt met correcte weeklabel
- Klik "Annuleren" — modal sluit
- Klik "▶ Verwerk dag" in de DayTimeline
- Verwacht: warning modal verschijnt met correcte daglabel

- [ ] **Stap 6: Commit indien ok**

```bash
git add -A
git commit -m "chore: post smoke-test cleanup" --allow-empty
```
