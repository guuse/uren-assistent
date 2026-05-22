# Week/Day View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de template-gebaseerde homepage door een dag-gerichte weekview die bestaande Simplicate-boekingen toont op een tijdlijn met slimme suggesties gebaseerd op boekingshistorie.

**Architecture:** Clean Architecture blijft intact. Nieuwe domain entities en use cases worden toegevoegd in `src/domain/`. De `SimplicateRepository` wordt uitgebreid. Nieuwe UI-componenten in `src/ui/` vervangen de bestaande `HomePage` en template-gerelateerde code volledig.

**Tech Stack:** TypeScript strict, React, Zustand, Vitest (unit tests), Tailwind CSS, Tauri IPC voor Simplicate API calls.

---

## Bestandsoverzicht

### Nieuw
- `src/domain/entities/HourEntrySuggestion.ts` — suggestion type
- `src/domain/usecases/GetWeekEntriesUseCase.ts` — haalt entries op per week, groepeert per datum
- `src/domain/usecases/GetWeekEntriesUseCase.test.ts`
- `src/domain/usecases/GenerateSuggestionsUseCase.ts` — patroon + last-week suggesties
- `src/domain/usecases/GenerateSuggestionsUseCase.test.ts`
- `src/domain/usecases/BookHoursUseCase.ts` — vervangt BookTemplateUseCase
- `src/domain/usecases/BookHoursUseCase.test.ts`
- `src/ui/hooks/useWeek.ts` — week state + entries laden
- `src/ui/hooks/useSuggestions.ts` — suggesties per dag
- `src/ui/pages/WeekPage.tsx` — hoofdpagina
- `src/ui/components/WeekDayList.tsx` — daglijst sidebar
- `src/ui/components/DayTimeline.tsx` — tijdlijn met blokken
- `src/ui/components/DayTimeline.helpers.ts` — pure gat-berekening (testbaar)
- `src/ui/components/DayTimeline.helpers.test.ts`

### Gewijzigd
- `src/domain/entities/HourEntry.ts` — voeg `id?: string` toe
- `src/domain/repositories/ISimplicateRepository.ts` — voeg `getHourEntries` toe
- `src/infrastructure/simplicate/simplicate.types.ts` — voeg `SimplicateHourEntryResponse` toe
- `src/infrastructure/simplicate/SimplicateRepository.ts` — implementeer `getHourEntries`
- `src/application/container.ts` — registreer nieuwe use cases, verwijder template use cases
- `src/ui/pages/BookingModal.tsx` — accept `initialEntry: Partial<HourEntry>` i.p.v. `Template`
- `src/ui/hooks/useBooking.ts` — accept `Partial<HourEntry>` i.p.v. `Template`
- `src/ui/pages/Settings/SettingsPage.tsx` — verwijder Templates tab
- `src/App.tsx` — vervang `HomePage` door `WeekPage`

### Verwijderd
- `src/domain/entities/Template.ts`
- `src/domain/repositories/ITemplateRepository.ts`
- `src/domain/usecases/BookTemplateUseCase.ts`
- `src/domain/usecases/SaveTemplateUseCase.ts`
- `src/domain/usecases/DeleteTemplateUseCase.ts`
- `src/infrastructure/storage/TemplateStorageRepository.ts`
- `src/ui/pages/Home.tsx`
- `src/ui/components/TemplateCard.tsx`
- `src/ui/pages/Settings/TemplateForm.tsx`
- `src/ui/hooks/useTemplates.ts`

---

## Task 1: HourEntry uitbreiden + HourEntrySuggestion entity

**Files:**
- Modify: `src/domain/entities/HourEntry.ts`
- Create: `src/domain/entities/HourEntrySuggestion.ts`

- [ ] **Stap 1: Voeg `id` toe aan HourEntry**

Open `src/domain/entities/HourEntry.ts` en pas aan:

```ts
export interface HourEntry {
  id?: string          // Simplicate hours id, aanwezig na ophalen, afwezig bij boeken
  employeeId: string
  projectId: string
  projectServiceId: string
  hourTypeId: string
  hours: number
  startDate: string    // YYYY-MM-DD
  startTime: string    // HH:mm
  endTime: string      // HH:mm
  note: string
}
```

- [ ] **Stap 2: Maak HourEntrySuggestion aan**

Maak `src/domain/entities/HourEntrySuggestion.ts`:

```ts
export interface HourEntrySuggestion {
  projectId: string
  projectServiceId: string
  hourTypeId: string
  startTime?: string       // meest recente tijden uit historie (HH:mm)
  endTime?: string         // meest recente tijden uit historie (HH:mm)
  reason: 'pattern' | 'last-week'
  occurrences: number      // hoe vaak in de laatste 4 weken op deze weekdag
}
```

- [ ] **Stap 3: Commit**

```bash
git add src/domain/entities/HourEntry.ts src/domain/entities/HourEntrySuggestion.ts
git commit -m "feat(domain): add id to HourEntry, add HourEntrySuggestion entity"
```

---

## Task 2: ISimplicateRepository uitbreiden met getHourEntries

**Files:**
- Modify: `src/domain/repositories/ISimplicateRepository.ts`

- [ ] **Stap 1: Voeg `getHourEntries` toe aan de interface**

Open `src/domain/repositories/ISimplicateRepository.ts` en voeg toe aan de interface:

```ts
import type { HourEntry } from '../entities/HourEntry'

export interface ISimplicateRepository {
  getProjects(): Promise<SimplicateProject[]>
  getServices(projectId: string): Promise<SimplicateService[]>
  getHourTypes(): Promise<SimplicateHourType[]>
  getEmployee(email: string): Promise<SimplicateEmployee>
  bookHours(entries: HourEntry[]): Promise<void>
  getHourEntries(employeeId: string, from: string, to: string): Promise<HourEntry[]>
  // from en to zijn YYYY-MM-DD datumstrings (inclusief)
}
```

- [ ] **Stap 2: Voeg response type toe aan simplicate.types.ts**

Open `src/infrastructure/simplicate/simplicate.types.ts` en voeg toe:

```ts
export interface SimplicateHourEntryResponse {
  id: string
  employee: { id: string }
  project: { id: string }
  projectservice: { id: string }
  type: { id: string }
  hours: number
  start_date: string   // "YYYY-MM-DD HH:mm:ss"
  end_date: string     // "YYYY-MM-DD HH:mm:ss"
  note: string
}
```

- [ ] **Stap 3: Implementeer getHourEntries in SimplicateRepository**

Open `src/infrastructure/simplicate/SimplicateRepository.ts`. Importeer het nieuwe type bovenaan:

```ts
import type {
  SimplicateApiListResponse,
  SimplicateEmployeeResponse,
  SimplicateHourEntryResponse,
  SimplicateHourTypeResponse,
  SimplicateProjectResponse,
  SimplicateServiceResponse,
} from './simplicate.types'
```

Voeg de methode toe na `bookHours`:

```ts
async getHourEntries(employeeId: string, from: string, to: string): Promise<HourEntry[]> {
  const data = await this.getPaginated<SimplicateHourEntryResponse>(
    `/hours/hours?q%5Bemployee.id%5D=${encodeURIComponent(employeeId)}&q%5Bstart_date%5D%5Bge%5D=${from}&q%5Bstart_date%5D%5Ble%5D=${to}`,
  )
  return data.map((h) => ({
    id: h.id,
    employeeId: h.employee.id,
    projectId: h.project.id,
    projectServiceId: h.projectservice.id,
    hourTypeId: h.type.id,
    hours: h.hours,
    startDate: h.start_date.slice(0, 10),
    startTime: h.start_date.slice(11, 16),
    endTime: h.end_date.slice(11, 16),
    note: h.note,
  }))
}
```

- [ ] **Stap 4: Controleer typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 5: Commit**

```bash
git add src/domain/repositories/ISimplicateRepository.ts \
        src/infrastructure/simplicate/simplicate.types.ts \
        src/infrastructure/simplicate/SimplicateRepository.ts
git commit -m "feat(infra): implement getHourEntries on SimplicateRepository"
```

---

## Task 3: GetWeekEntriesUseCase

**Files:**
- Create: `src/domain/usecases/GetWeekEntriesUseCase.ts`
- Create: `src/domain/usecases/GetWeekEntriesUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing tests**

Maak `src/domain/usecases/GetWeekEntriesUseCase.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { GetWeekEntriesUseCase } from './GetWeekEntriesUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function makeEntry(overrides: Partial<HourEntry> = {}): HourEntry {
  return {
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-19',
    startTime: '09:00',
    endTime: '11:00',
    note: '',
    ...overrides,
  }
}

function makeRepo(entries: HourEntry[]): ISimplicateRepository {
  return {
    getHourEntries: vi.fn().mockResolvedValue(entries),
    getProjects: vi.fn(),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
    bookHours: vi.fn(),
  } as unknown as ISimplicateRepository
}

describe('GetWeekEntriesUseCase', () => {
  it('groepeert entries per datum', async () => {
    const entries = [
      makeEntry({ startDate: '2026-05-19' }),
      makeEntry({ startDate: '2026-05-19', startTime: '13:00', endTime: '15:00' }),
      makeEntry({ startDate: '2026-05-20' }),
    ]
    const repo = makeRepo(entries)
    const useCase = new GetWeekEntriesUseCase(repo)
    const result = await useCase.execute('emp1', '2026-05-18')

    expect(result['2026-05-19']).toHaveLength(2)
    expect(result['2026-05-20']).toHaveLength(1)
  })

  it('roept repo aan met maandag tot vrijdag van de gegeven week', async () => {
    const repo = makeRepo([])
    const useCase = new GetWeekEntriesUseCase(repo)
    await useCase.execute('emp1', '2026-05-18')

    expect(repo.getHourEntries).toHaveBeenCalledWith('emp1', '2026-05-18', '2026-05-22')
  })

  it('geeft lege records terug als er geen entries zijn', async () => {
    const repo = makeRepo([])
    const useCase = new GetWeekEntriesUseCase(repo)
    const result = await useCase.execute('emp1', '2026-05-18')

    expect(result).toEqual({})
  })
})
```

- [ ] **Stap 2: Draai tests — verwacht FAIL**

```bash
npm run test -- GetWeekEntriesUseCase
```

Verwacht: `Cannot find module './GetWeekEntriesUseCase'`

- [ ] **Stap 3: Implementeer GetWeekEntriesUseCase**

Maak `src/domain/usecases/GetWeekEntriesUseCase.ts`:

```ts
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

export class GetWeekEntriesUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  // weekStart: ISO datum van de maandag van de gewenste week (YYYY-MM-DD)
  async execute(employeeId: string, weekStart: string): Promise<Record<string, HourEntry[]>> {
    const weekEnd = addDays(weekStart, 4) // vrijdag
    const entries = await this.simplicateRepo.getHourEntries(employeeId, weekStart, weekEnd)
    const grouped: Record<string, HourEntry[]> = {}
    for (const entry of entries) {
      const date = entry.startDate
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(entry)
    }
    return grouped
  }
}
```

- [ ] **Stap 4: Draai tests — verwacht PASS**

```bash
npm run test -- GetWeekEntriesUseCase
```

Verwacht: 3 tests PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/GetWeekEntriesUseCase.ts \
        src/domain/usecases/GetWeekEntriesUseCase.test.ts
git commit -m "feat(domain): add GetWeekEntriesUseCase"
```

---

## Task 4: GenerateSuggestionsUseCase

**Files:**
- Create: `src/domain/usecases/GenerateSuggestionsUseCase.ts`
- Create: `src/domain/usecases/GenerateSuggestionsUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing tests**

Maak `src/domain/usecases/GenerateSuggestionsUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { GenerateSuggestionsUseCase } from './GenerateSuggestionsUseCase'
import type { HourEntry } from '../entities/HourEntry'

function makeEntry(overrides: Partial<HourEntry> = {}): HourEntry {
  return {
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-19',
    startTime: '09:00',
    endTime: '11:00',
    note: '',
    ...overrides,
  }
}

describe('GenerateSuggestionsUseCase', () => {
  const useCase = new GenerateSuggestionsUseCase()

  it('geeft last-week suggestie terug voor entries van exact vorige week', () => {
    // targetDate = dinsdag 2026-05-19, vorige week dinsdag = 2026-05-12
    const entries = [makeEntry({ startDate: '2026-05-12', projectId: 'p1' })]
    const result = useCase.execute('2026-05-19', entries)

    expect(result).toHaveLength(1)
    expect(result[0]!.reason).toBe('last-week')
    expect(result[0]!.projectId).toBe('p1')
  })

  it('geeft pattern suggestie als combinatie op ≥2 van de 4 vorige gelijke weekdagen voorkomt', () => {
    // targetDate = dinsdag 2026-05-19
    // Vorige dinsdagen: 2026-05-12, 2026-05-05, 2026-04-28, 2026-04-21
    const entries = [
      makeEntry({ startDate: '2026-05-05', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    expect(result.some((s) => s.projectId === 'p2' && s.reason === 'pattern')).toBe(true)
  })

  it('geeft geen pattern suggestie als combinatie op slechts 1 vorige weekdag voorkomt', () => {
    const entries = [
      makeEntry({ startDate: '2026-05-05', projectId: 'p3', projectServiceId: 's3', hourTypeId: 'ht3' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    expect(result.some((s) => s.projectId === 'p3')).toBe(false)
  })

  it('samenvoegt last-week en pattern voor dezelfde combinatie, last-week wint', () => {
    // p1/s1/ht1 staat op vorige week EN op 3 weken daarvoor (dus ook pattern)
    const entries = [
      makeEntry({ startDate: '2026-05-12', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
      makeEntry({ startDate: '2026-05-05', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    const matches = result.filter((s) => s.projectId === 'p1')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.reason).toBe('last-week')
  })

  it('neemt startTime/endTime over van de meest recente boeking', () => {
    const entries = [
      makeEntry({ startDate: '2026-05-12', startTime: '10:00', endTime: '12:00' }),
      makeEntry({ startDate: '2026-05-05', startTime: '09:00', endTime: '11:00' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    expect(result[0]!.startTime).toBe('10:00')
    expect(result[0]!.endTime).toBe('12:00')
  })

  it('geeft lege array terug bij geen historische entries', () => {
    const result = useCase.execute('2026-05-19', [])
    expect(result).toEqual([])
  })

  it('sorteert op occurrences desc', () => {
    const entries = [
      makeEntry({ startDate: '2026-05-05', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-04-21', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-05-12', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
      makeEntry({ startDate: '2026-05-05', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    // p2 heeft 3 occurrences, p1 heeft 2 (last-week + pattern)
    // last-week (p1) staat boven pattern (p2) bij gelijke occurrences
    expect(result[0]!.projectId).toBe('p1') // last-week
    expect(result[1]!.projectId).toBe('p2') // pattern, 3 occurrences
  })
})
```

- [ ] **Stap 2: Draai tests — verwacht FAIL**

```bash
npm run test -- GenerateSuggestionsUseCase
```

Verwacht: `Cannot find module './GenerateSuggestionsUseCase'`

- [ ] **Stap 3: Implementeer GenerateSuggestionsUseCase**

Maak `src/domain/usecases/GenerateSuggestionsUseCase.ts`:

```ts
import type { HourEntry } from '../entities/HourEntry'
import type { HourEntrySuggestion } from '../entities/HourEntrySuggestion'

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]!
}

function combinationKey(e: HourEntry): string {
  return `${e.projectId}|${e.projectServiceId}|${e.hourTypeId}`
}

export class GenerateSuggestionsUseCase {
  // targetDate: de dag waarvoor suggesties gegenereerd worden (YYYY-MM-DD)
  // historicalEntries: alle entries van de afgelopen 4+ weken (al gefilterd op medewerker)
  execute(targetDate: string, historicalEntries: HourEntry[]): HourEntrySuggestion[] {
    const dayOfWeek = new Date(targetDate).getDay() // 0=zon, 1=ma, ..., 5=vr

    // Bereken de 4 vorige gelijke weekdagen
    const previousSameDays = [7, 14, 21, 28].map((daysBack) =>
      subtractDays(targetDate, daysBack),
    )
    const lastWeekDate = previousSameDays[0]!

    // Filter entries die op een van de 4 vorige gelijke weekdagen vallen
    const relevantEntries = historicalEntries.filter((e) =>
      previousSameDays.includes(e.startDate),
    )

    // Groepeer per combinatie
    type CombinationData = {
      dates: Set<string>
      mostRecentDate: string
      mostRecentEntry: HourEntry
    }
    const byKey = new Map<string, CombinationData>()

    for (const entry of relevantEntries) {
      const key = combinationKey(entry)
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, {
          dates: new Set([entry.startDate]),
          mostRecentDate: entry.startDate,
          mostRecentEntry: entry,
        })
      } else {
        existing.dates.add(entry.startDate)
        if (entry.startDate > existing.mostRecentDate) {
          existing.mostRecentDate = entry.startDate
          existing.mostRecentEntry = entry
        }
      }
    }

    const suggestions: HourEntrySuggestion[] = []

    for (const [key, data] of byKey.entries()) {
      const isLastWeek = data.dates.has(lastWeekDate)
      const isPattern = data.dates.size >= 2

      if (!isLastWeek && !isPattern) continue

      const [projectId, projectServiceId, hourTypeId] = key.split('|') as [string, string, string]
      suggestions.push({
        projectId,
        projectServiceId,
        hourTypeId,
        startTime: data.mostRecentEntry.startTime,
        endTime: data.mostRecentEntry.endTime,
        reason: isLastWeek ? 'last-week' : 'pattern',
        occurrences: data.dates.size,
      })
    }

    // Sorteer: last-week eerst, dan op occurrences desc
    suggestions.sort((a, b) => {
      if (a.reason === 'last-week' && b.reason !== 'last-week') return -1
      if (b.reason === 'last-week' && a.reason !== 'last-week') return 1
      return b.occurrences - a.occurrences
    })

    return suggestions
  }
}
```

- [ ] **Stap 4: Draai tests — verwacht PASS**

```bash
npm run test -- GenerateSuggestionsUseCase
```

Verwacht: 7 tests PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/GenerateSuggestionsUseCase.ts \
        src/domain/usecases/GenerateSuggestionsUseCase.test.ts \
        src/domain/entities/HourEntrySuggestion.ts
git commit -m "feat(domain): add GenerateSuggestionsUseCase"
```

---

## Task 5: BookHoursUseCase

**Files:**
- Create: `src/domain/usecases/BookHoursUseCase.ts`
- Create: `src/domain/usecases/BookHoursUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing tests**

Maak `src/domain/usecases/BookHoursUseCase.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { BookHoursUseCase } from './BookHoursUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function makeRepo(): ISimplicateRepository {
  return {
    bookHours: vi.fn().mockResolvedValue(undefined),
    getHourEntries: vi.fn(),
    getProjects: vi.fn(),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
  } as unknown as ISimplicateRepository
}

function validEntry(): HourEntry {
  return {
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-19',
    startTime: '09:00',
    endTime: '11:00',
    note: '',
  }
}

describe('BookHoursUseCase', () => {
  it('boekt een geldige entry via de repository', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    await useCase.execute(validEntry())
    expect(repo.bookHours).toHaveBeenCalledWith([validEntry()])
  })

  it('gooit een fout als projectId ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    const entry = { ...validEntry(), projectId: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('projectId')
  })

  it('gooit een fout als projectServiceId ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    const entry = { ...validEntry(), projectServiceId: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('projectServiceId')
  })

  it('gooit een fout als hourTypeId ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    const entry = { ...validEntry(), hourTypeId: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('hourTypeId')
  })

  it('gooit een fout als startDate ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    const entry = { ...validEntry(), startDate: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('startDate')
  })
})
```

- [ ] **Stap 2: Draai tests — verwacht FAIL**

```bash
npm run test -- BookHoursUseCase
```

Verwacht: `Cannot find module './BookHoursUseCase'`

- [ ] **Stap 3: Implementeer BookHoursUseCase**

Maak `src/domain/usecases/BookHoursUseCase.ts`:

```ts
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

export class BookHoursUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(entry: HourEntry): Promise<void> {
    const required: (keyof HourEntry)[] = [
      'employeeId',
      'projectId',
      'projectServiceId',
      'hourTypeId',
      'startDate',
      'startTime',
      'endTime',
    ]
    for (const field of required) {
      if (!entry[field]) {
        throw new Error(`Verplicht veld ontbreekt: ${field}`)
      }
    }
    await this.simplicateRepo.bookHours([entry])
  }
}
```

- [ ] **Stap 4: Draai tests — verwacht PASS**

```bash
npm run test -- BookHoursUseCase
```

Verwacht: 5 tests PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/BookHoursUseCase.ts \
        src/domain/usecases/BookHoursUseCase.test.ts
git commit -m "feat(domain): add BookHoursUseCase"
```

---

## Task 6: DayTimeline helpers (gat-berekening)

**Files:**
- Create: `src/ui/components/DayTimeline.helpers.ts`
- Create: `src/ui/components/DayTimeline.helpers.test.ts`

- [ ] **Stap 1: Schrijf de failing tests**

Maak `src/ui/components/DayTimeline.helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeTimelineBlocks, type TimelineBlock } from './DayTimeline.helpers'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'

function makeEntry(startTime: string, endTime: string): HourEntry {
  return {
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-19',
    startTime,
    endTime,
    note: '',
  }
}

function makeSuggestion(startTime?: string): HourEntrySuggestion {
  return {
    projectId: 'p2',
    projectServiceId: 's2',
    hourTypeId: 'ht2',
    startTime,
    reason: 'last-week',
    occurrences: 1,
  }
}

describe('computeTimelineBlocks', () => {
  it('geeft één leeg gat terug als er geen entries zijn', () => {
    const blocks = computeTimelineBlocks([], [], '08:00', '18:00')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('gap')
    expect(blocks[0]!.startTime).toBe('08:00')
    expect(blocks[0]!.endTime).toBe('18:00')
  })

  it('toont entry en gaten eromheen', () => {
    const blocks = computeTimelineBlocks(
      [makeEntry('09:00', '11:00')],
      [],
      '08:00',
      '18:00',
    )
    expect(blocks).toHaveLength(3)
    expect(blocks[0]!.type).toBe('gap')
    expect(blocks[0]!.startTime).toBe('08:00')
    expect(blocks[0]!.endTime).toBe('09:00')
    expect(blocks[1]!.type).toBe('entry')
    expect(blocks[2]!.type).toBe('gap')
    expect(blocks[2]!.startTime).toBe('11:00')
    expect(blocks[2]!.endTime).toBe('18:00')
  })

  it('koppelt suggestie aan gat als startTime van suggestie in het gat valt', () => {
    const blocks = computeTimelineBlocks(
      [makeEntry('09:00', '11:00')],
      [makeSuggestion('14:00')],
      '08:00',
      '18:00',
    )
    const gapAfter = blocks.find((b) => b.type === 'gap' && b.startTime === '11:00')
    expect(gapAfter?.suggestion?.startTime).toBe('14:00')
  })

  it('koppelt eerste suggestie aan eerste gat als geen startTime match', () => {
    const blocks = computeTimelineBlocks(
      [],
      [makeSuggestion(undefined)],
      '08:00',
      '18:00',
    )
    expect(blocks[0]!.suggestion).toBeDefined()
  })

  it('sorteert entries op startTime voor gat-berekening', () => {
    const blocks = computeTimelineBlocks(
      [makeEntry('13:00', '15:00'), makeEntry('09:00', '11:00')],
      [],
      '08:00',
      '18:00',
    )
    expect(blocks[1]!.startTime).toBe('09:00') // eerste entry
    expect(blocks[3]!.startTime).toBe('13:00') // tweede entry
  })
})
```

- [ ] **Stap 2: Draai tests — verwacht FAIL**

```bash
npm run test -- DayTimeline.helpers
```

Verwacht: `Cannot find module './DayTimeline.helpers'`

- [ ] **Stap 3: Implementeer DayTimeline.helpers**

Maak `src/ui/components/DayTimeline.helpers.ts`:

```ts
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'

export type TimelineBlock =
  | { type: 'entry'; startTime: string; endTime: string; entry: HourEntry; suggestion?: never }
  | { type: 'gap'; startTime: string; endTime: string; entry?: never; suggestion?: HourEntrySuggestion }

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export function computeTimelineBlocks(
  entries: HourEntry[],
  suggestions: HourEntrySuggestion[],
  dayStart: string,
  dayEnd: string,
): TimelineBlock[] {
  const sorted = [...entries].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  )

  const blocks: TimelineBlock[] = []
  let cursor = timeToMinutes(dayStart)
  const end = timeToMinutes(dayEnd)

  for (const entry of sorted) {
    const entryStart = timeToMinutes(entry.startTime)
    const entryEnd = timeToMinutes(entry.endTime)

    if (entryStart > cursor) {
      // gat voor deze entry
      blocks.push({ type: 'gap', startTime: minutesToTime(cursor), endTime: minutesToTime(entryStart) })
    }
    blocks.push({ type: 'entry', startTime: entry.startTime, endTime: entry.endTime, entry })
    cursor = entryEnd
  }

  if (cursor < end) {
    blocks.push({ type: 'gap', startTime: minutesToTime(cursor), endTime: minutesToTime(end) })
  }

  // Koppel suggesties aan gaten
  const usedSuggestions = new Set<number>()
  for (const block of blocks) {
    if (block.type !== 'gap') continue

    const gapStart = timeToMinutes(block.startTime)
    const gapEnd = timeToMinutes(block.endTime)

    // Zoek suggestie waarvan startTime in dit gat valt
    const matchIdx = suggestions.findIndex((s, i) => {
      if (usedSuggestions.has(i)) return false
      if (!s.startTime) return false
      const st = timeToMinutes(s.startTime)
      return st >= gapStart && st < gapEnd
    })

    if (matchIdx !== -1) {
      block.suggestion = suggestions[matchIdx]
      usedSuggestions.add(matchIdx)
    } else {
      // Eerste ongebruikte suggestie
      const firstIdx = suggestions.findIndex((_, i) => !usedSuggestions.has(i))
      if (firstIdx !== -1) {
        block.suggestion = suggestions[firstIdx]
        usedSuggestions.add(firstIdx)
      }
    }
  }

  return blocks
}
```

- [ ] **Stap 4: Draai tests — verwacht PASS**

```bash
npm run test -- DayTimeline.helpers
```

Verwacht: 5 tests PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/ui/components/DayTimeline.helpers.ts \
        src/ui/components/DayTimeline.helpers.test.ts
git commit -m "feat(ui): add DayTimeline gap computation helpers"
```

---

## Task 7: Container updaten + template code verwijderen

**Files:**
- Modify: `src/application/container.ts`
- Delete: `src/domain/usecases/BookTemplateUseCase.ts`
- Delete: `src/domain/usecases/SaveTemplateUseCase.ts`
- Delete: `src/domain/usecases/DeleteTemplateUseCase.ts`
- Delete: `src/domain/repositories/ITemplateRepository.ts`
- Delete: `src/domain/entities/Template.ts`
- Delete: `src/infrastructure/storage/TemplateStorageRepository.ts`
- Delete: `src/ui/hooks/useTemplates.ts`
- Delete: `src/ui/components/TemplateCard.tsx`
- Delete: `src/ui/pages/Settings/TemplateForm.tsx`

- [ ] **Stap 1: Herschrijf container.ts**

Vervang de volledige inhoud van `src/application/container.ts`:

```ts
import { KeychainRepository } from '../infrastructure/keychain/KeychainRepository'
import { SimplicateRepository } from '../infrastructure/simplicate/SimplicateRepository'
import { MappingCacheRepository } from '../infrastructure/storage/MappingCacheRepository'
import { CopilotRepository } from '../infrastructure/copilot/CopilotRepository'
import { GoogleCalendarRepository } from '../infrastructure/googlecalendar/GoogleCalendarRepository'
import { FetchSimplicateDataUseCase } from '../domain/usecases/FetchSimplicateDataUseCase'
import { ParseBrowserHistoryUseCase } from '../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../domain/usecases/ClassifyHistoryBlocksUseCase'
import { FetchCalendarEventsUseCase } from '../domain/usecases/FetchCalendarEventsUseCase'
import { ClassifyCalendarBlocksUseCase } from '../domain/usecases/ClassifyCalendarBlocksUseCase'
import { GroupAndClassifyDayUseCase } from '../domain/usecases/GroupAndClassifyDayUseCase'
import { GetWeekEntriesUseCase } from '../domain/usecases/GetWeekEntriesUseCase'
import { GenerateSuggestionsUseCase } from '../domain/usecases/GenerateSuggestionsUseCase'
import { BookHoursUseCase } from '../domain/usecases/BookHoursUseCase'
import type { ISimplicateRepository } from '../domain/repositories/ISimplicateRepository'
import type { ICopilotRepository } from '../domain/repositories/ICopilotRepository'
import type { Project, Service } from '../domain/repositories/ICopilotRepository'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string

// Repositories
export const keychainRepo = new KeychainRepository()
export const mappingCacheRepo = new MappingCacheRepository()

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

export function createGroupAndClassifyDayUseCase(
  copilotRepo: ICopilotRepository,
  projects: Project[],
  services: Service[],
): GroupAndClassifyDayUseCase {
  return new GroupAndClassifyDayUseCase(copilotRepo, mappingCacheRepo, projects, services)
}

export function createUseCases(simplicateRepo: ISimplicateRepository) {
  return {
    fetchSimplicateData: new FetchSimplicateDataUseCase(simplicateRepo),
    parseBrowserHistory: new ParseBrowserHistoryUseCase(),
    classifyHistoryBlocks: (copilotRepo: ICopilotRepository) =>
      new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo),
    getWeekEntries: new GetWeekEntriesUseCase(simplicateRepo),
    generateSuggestions: new GenerateSuggestionsUseCase(),
    bookHours: new BookHoursUseCase(simplicateRepo),
  }
}
```

- [ ] **Stap 2: Verwijder template-gerelateerde bestanden**

```bash
rm src/domain/usecases/BookTemplateUseCase.ts
rm src/domain/usecases/SaveTemplateUseCase.ts
rm src/domain/usecases/DeleteTemplateUseCase.ts
rm src/domain/repositories/ITemplateRepository.ts
rm src/domain/entities/Template.ts
rm src/infrastructure/storage/TemplateStorageRepository.ts
rm src/ui/hooks/useTemplates.ts
rm src/ui/components/TemplateCard.tsx
rm src/ui/pages/Settings/TemplateForm.tsx
```

- [ ] **Stap 3: Controleer typecheck**

```bash
npm run typecheck
```

Verwacht: fouten in `SettingsPage.tsx`, `BookingModal.tsx`, `useBooking.ts`, `Home.tsx`, `App.tsx` — die pakken we op in latere taken. Alle andere fouten zijn een probleem.

- [ ] **Stap 4: Commit**

```bash
git add -A
git commit -m "refactor: remove template system, wire new use cases in container"
```

---

## Task 8: SettingsPage — verwijder Templates tab

**Files:**
- Modify: `src/ui/pages/Settings/SettingsPage.tsx`

- [ ] **Stap 1: Herschrijf SettingsPage zonder Templates tab**

Vervang de volledige inhoud van `src/ui/pages/Settings/SettingsPage.tsx`:

```tsx
import { AccountSettings } from './AccountSettings'

interface Props {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  return (
    <div className="h-full bg-[#1c1917] text-[#e8e2d9] flex flex-col">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-[#2e2a26]">
        <button
          onClick={onBack}
          className="text-[#7a7268] hover:text-[#e8e2d9] text-[12px] transition-colors cursor-pointer"
        >
          ← Terug
        </button>
        <div className="text-[#e8e2d9] font-bold text-[14px]">Instellingen</div>
      </div>
      <div className="px-6 py-4 flex-1 overflow-y-auto">
        <AccountSettings />
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen nieuwe fouten in SettingsPage.tsx.

- [ ] **Stap 3: Commit**

```bash
git add src/ui/pages/Settings/SettingsPage.tsx
git commit -m "refactor(ui): remove Templates tab from SettingsPage"
```

---

## Task 9: BookingModal + useBooking aanpassen

**Files:**
- Modify: `src/ui/hooks/useBooking.ts`
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Stap 1: Herschrijf useBooking.ts**

Vervang de volledige inhoud van `src/ui/hooks/useBooking.ts`:

```ts
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { HourEntry } from '../../domain/entities/HourEntry'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error'

export function useBooking(initial: Partial<HourEntry> = {}) {
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)
  const projects = useAppStore((s) => s.projects)
  const allHourTypes = useAppStore((s) => s.hourTypes)

  const [projectId, setProjectId] = useState(initial.projectId ?? '')
  const [serviceId, setServiceId] = useState(initial.projectServiceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(initial.hourTypeId ?? '')
  const [note, setNote] = useState(initial.note ?? '')
  const [startTime, setStartTime] = useState(initial.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initial.endTime ?? '09:30')
  const [date, setDate] = useState(initial.startDate ?? new Date().toISOString().split('T')[0]!)
  const [services, setServices] = useState<{ id: string; name: string; hourTypeIds: string[] }[]>([])
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedService = services.find((s) => s.id === serviceId)
  const hourTypes = selectedService
    ? allHourTypes.filter((ht) => selectedService.hourTypeIds.includes(ht.id))
    : allHourTypes

  const missingFields = [
    !projectId && 'project',
    !serviceId && 'dienst',
    !hourTypeId && 'urensoort',
  ].filter(Boolean)

  async function loadServices(pid: string) {
    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    if (!apiKey || !apiSecret) return
    const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    const svc = await repo.getServices(pid)
    setServices(svc)
  }

  async function handleProjectChange(pid: string) {
    setProjectId(pid)
    setServiceId('')
    setHourTypeId('')
    await loadServices(pid)
  }

  function handleServiceChange(id: string) {
    setServiceId(id)
    const svc = services.find((s) => s.id === id)
    if (svc && hourTypeId && !svc.hourTypeIds.includes(hourTypeId)) {
      setHourTypeId('')
    }
  }

  async function book() {
    if (!simplicateEmployeeId) return
    setStatus('loading')
    setErrorMessage(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { bookHours } = createUseCases(simplicateRepo)

      const [hStart, mStart] = startTime.split(':').map(Number)
      const [hEnd, mEnd] = endTime.split(':').map(Number)
      const hours = Math.round(((hEnd! * 60 + mEnd!) - (hStart! * 60 + mStart!)) / 60 * 2) / 2

      const entry: HourEntry = {
        employeeId: simplicateEmployeeId,
        projectId,
        projectServiceId: serviceId,
        hourTypeId,
        hours,
        startDate: date,
        startTime,
        endTime,
        note,
      }

      await bookHours.execute(entry)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Boeken mislukt')
    }
  }

  return {
    projectId, setProjectId: handleProjectChange,
    serviceId, setServiceId: handleServiceChange,
    hourTypeId, setHourTypeId,
    note, setNote,
    startTime, setStartTime,
    endTime, setEndTime,
    date, setDate,
    services,
    status,
    errorMessage,
    missingFields,
    canBook: missingFields.length === 0,
    projects,
    hourTypes,
    book,
  }
}
```

- [ ] **Stap 2: Herschrijf BookingModal.tsx**

Vervang de volledige inhoud van `src/ui/pages/BookingModal.tsx`:

```tsx
import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { TimeSelect } from '../components/TimeSelect'
import type { HourEntry } from '../../domain/entities/HourEntry'

interface Props {
  initialEntry?: Partial<HourEntry>
  title?: string
  onClose: () => void
  onBooked?: () => void
}

export function BookingModal({ initialEntry = {}, title = 'Uren boeken', onClose, onBooked }: Props) {
  const booking = useBooking(initialEntry)

  if (booking.status === 'success') {
    onBooked?.()
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#252220] rounded-xl p-6 w-80 text-center flex flex-col gap-4">
          <div className="text-[#5a8a6a] text-4xl">✓</div>
          <div className="text-[#e8e2d9] font-semibold">Uren geboekt!</div>
          <button
            onClick={onClose}
            className="bg-[#e8e2d9] text-[#1c1917] py-2 rounded-lg text-sm font-medium hover:bg-[#d5cfc6] transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#252220] rounded-xl p-6 w-96 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="text-[#e8e2d9] font-bold">{title}</div>
          <button onClick={onClose} className="text-[#4a4540] hover:text-[#e8e2d9] text-lg">✕</button>
        </div>

        {/* Datum */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Datum</label>
          <input
            type="date"
            value={booking.date}
            onChange={(e) => booking.setDate(e.target.value)}
            className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          />
        </div>

        {/* Tijden */}
        <div className="flex gap-3">
          <TimeSelect label="Van" value={booking.startTime} onChange={(time) => {
            booking.setStartTime(time)
            if (booking.endTime <= time) {
              const [h, m] = time.split(':').map(Number)
              const next = h! * 60 + m! + 30
              booking.setEndTime(
                `${Math.floor(next / 60).toString().padStart(2, '0')}:${(next % 60).toString().padStart(2, '0')}`
              )
            }
          }} />
          <TimeSelect label="Tot" value={booking.endTime} onChange={booking.setEndTime} />
        </div>

        {/* Project / dienst / urensoort */}
        <FieldSelector
          label="Project"
          value={booking.projectId}
          options={booking.projects.map((p) => ({ id: p.id, label: `${p.organizationName} — ${p.name}` }))}
          onChange={booking.setProjectId}
        />
        {booking.projectId && (
          <FieldSelector
            label="Dienst"
            value={booking.serviceId}
            options={booking.services.map((s) => ({ id: s.id, label: s.name }))}
            onChange={booking.setServiceId}
          />
        )}
        {booking.serviceId && (
          <FieldSelector
            label="Urensoort"
            value={booking.hourTypeId}
            options={booking.hourTypes.map((ht) => ({ id: ht.id, label: ht.label }))}
            onChange={booking.setHourTypeId}
          />
        )}

        {/* Notitie */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Toelichting</label>
          <input
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value)}
            placeholder="Optioneel"
            className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          />
        </div>

        {booking.status === 'error' && (
          <div className="text-red-400 text-sm">{booking.errorMessage}</div>
        )}

        <button
          onClick={booking.book}
          disabled={!booking.canBook || booking.status === 'loading'}
          className="bg-[#e8e2d9] text-[#1c1917] py-2 rounded-lg text-sm font-medium hover:bg-[#d5cfc6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {booking.status === 'loading' ? 'Bezig...' : 'Boeken →'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten in useBooking.ts en BookingModal.tsx. Nog wel fouten in Home.tsx en App.tsx.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/hooks/useBooking.ts src/ui/pages/BookingModal.tsx
git commit -m "refactor(ui): rewrite BookingModal + useBooking to use Partial<HourEntry>"
```

---

## Task 10: useWeek + useSuggestions hooks

**Files:**
- Create: `src/ui/hooks/useWeek.ts`
- Create: `src/ui/hooks/useSuggestions.ts`

- [ ] **Stap 1: Maak useWeek.ts**

Maak `src/ui/hooks/useWeek.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { HourEntry } from '../../domain/entities/HourEntry'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]!
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

export function useWeek() {
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)

  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() =>
    getMondayOf(new Date()),
  )
  const [selectedDate, setSelectedDate] = useState<string>(todayString)
  const [entriesByDate, setEntriesByDate] = useState<Record<string, HourEntry[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    if (!simplicateEmployeeId) return
    setIsLoading(true)
    setError(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')
      const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { getWeekEntries } = createUseCases(repo)
      const result = await getWeekEntries.execute(simplicateEmployeeId, selectedWeekStart)
      setEntriesByDate(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden mislukt')
    } finally {
      setIsLoading(false)
    }
  }, [simplicateEmployeeId, selectedWeekStart])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  function prevWeek() {
    setSelectedWeekStart((w) => addDays(w, -7))
  }

  function nextWeek() {
    setSelectedWeekStart((w) => addDays(w, 7))
  }

  // Weekdagen ma t/m vr als array van datumstrings
  const weekDays = [0, 1, 2, 3, 4].map((i) => addDays(selectedWeekStart, i))

  // Totaal geboekte uren per dag
  function hoursForDate(date: string): number {
    return (entriesByDate[date] ?? []).reduce((sum, e) => sum + e.hours, 0)
  }

  return {
    selectedWeekStart,
    selectedDate,
    selectDate: setSelectedDate,
    entriesByDate,
    weekDays,
    hoursForDate,
    isLoading,
    error,
    prevWeek,
    nextWeek,
    refresh: loadEntries,
  }
}
```

- [ ] **Stap 2: Maak useSuggestions.ts**

Maak `src/ui/hooks/useSuggestions.ts`:

```ts
import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { HourEntry } from '../../domain/entities/HourEntry'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

export function useSuggestions(selectedDate: string) {
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)
  const [suggestions, setSuggestions] = useState<HourEntrySuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!simplicateEmployeeId || !selectedDate) return

    async function load() {
      setIsLoading(true)
      try {
        const apiKey = await keychainRepo.get('simplicate-api-key')
        const apiSecret = await keychainRepo.get('simplicate-api-secret')
        if (!apiKey || !apiSecret) return
        const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
        const { getWeekEntries, generateSuggestions } = createUseCases(repo)

        // Haal de afgelopen 4 weken op
        const from = addDays(selectedDate, -28)
        const to = addDays(selectedDate, -1)

        // Haal per week op (4 weken)
        const allEntries: HourEntry[] = []
        for (let i = 0; i < 4; i++) {
          const weekStart = addDays(selectedDate, -(28 - i * 7))
          const entries = await getWeekEntries.execute(simplicateEmployeeId!, weekStart)
          allEntries.push(...Object.values(entries).flat())
        }

        const result = generateSuggestions.execute(selectedDate, allEntries)
        setSuggestions(result)
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [selectedDate, simplicateEmployeeId])

  return { suggestions, isLoading }
}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten in de nieuwe hooks.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/hooks/useWeek.ts src/ui/hooks/useSuggestions.ts
git commit -m "feat(ui): add useWeek and useSuggestions hooks"
```

---

## Task 11: WeekDayList component

**Files:**
- Create: `src/ui/components/WeekDayList.tsx`

- [ ] **Stap 1: Maak WeekDayList.tsx**

Maak `src/ui/components/WeekDayList.tsx`:

```tsx
const DAY_LABELS: Record<string, string> = {
  '1': 'MA', '2': 'DI', '3': 'WO', '4': 'DO', '5': 'VR',
}

interface Props {
  weekDays: string[]           // YYYY-MM-DD strings ma t/m vr
  selectedDate: string
  hoursForDate: (date: string) => number
  onSelectDate: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  weekLabel: string            // bijv. "week 21" of "vorige week"
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
}: Props) {
  return (
    <div className="w-[130px] flex-shrink-0 bg-[#171512] border-r border-[#2e2a26] flex flex-col py-3 px-2">
      <div className="text-[#4a4540] text-[9px] uppercase tracking-widest mb-2 px-1">{weekLabel}</div>

      <div className="flex flex-col gap-1 flex-1">
        {weekDays.map((date) => {
          const dayNum = new Date(date).getDay().toString()
          const label = DAY_LABELS[dayNum] ?? ''
          const dayOfMonth = new Date(date).getDate()
          const hours = hoursForDate(date)
          const isSelected = date === selectedDate
          const isFull = hours >= TARGET_HOURS

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
                  className={`text-[10px] font-semibold ${
                    isSelected ? 'text-[#a5b4fc]' : isFull ? 'text-[#94a3b8]' : 'text-[#64748b]'
                  }`}
                >
                  {label} {dayOfMonth}
                </span>
                {isFull && <span className="text-green-500 text-[9px]">✓</span>}
                {!isFull && hours > 0 && <span className="text-amber-500 text-[9px]">●</span>}
              </div>
              <ProgressBar hours={hours} />
              <div className="text-[8px] text-[#475569] mt-1">
                {hours > 0 ? `${hours} / ${TARGET_HOURS}u` : `0 / ${TARGET_HOURS}u`}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex justify-between items-center px-1 mt-2">
        <button
          onClick={onPrevWeek}
          className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
        >
          ‹
        </button>
        <span className="text-[#4a4540] text-[8px]">{weekLabel}</span>
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

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/WeekDayList.tsx
git commit -m "feat(ui): add WeekDayList component"
```

---

## Task 12: DayTimeline component

**Files:**
- Create: `src/ui/components/DayTimeline.tsx`

- [ ] **Stap 1: Maak DayTimeline.tsx**

Maak `src/ui/components/DayTimeline.tsx`:

```tsx
import { computeTimelineBlocks } from './DayTimeline.helpers'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import { useAppStore } from '../../store/appStore'

const DAY_START = '08:00'
const DAY_END = '18:00'
const HOUR_HEIGHT_PX = 48

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function blockHeight(startTime: string, endTime: string): number {
  const mins = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max(24, (mins / 60) * HOUR_HEIGHT_PX)
}

interface Props {
  date: string
  entries: HourEntry[]
  suggestions: HourEntrySuggestion[]
  onBookSuggestion: (suggestion: HourEntrySuggestion) => void
  onEditEntry: (entry: HourEntry) => void
}

export function DayTimeline({ date, entries, suggestions, onBookSuggestion, onEditEntry }: Props) {
  const projects = useAppStore((s) => s.projects)
  const blocks = computeTimelineBlocks(entries, suggestions, DAY_START, DAY_END)

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const pct = Math.min(100, (totalHours / 8) * 100)
  const progressColor = totalHours >= 8 ? 'bg-green-500' : totalHours > 0 ? 'bg-amber-500' : 'bg-[#374151]'

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  function projectName(projectId: string): string {
    return projects.find((p) => p.id === projectId)?.name ?? projectId
  }

  function suggestionLabel(s: HourEntrySuggestion): string {
    const name = projectName(s.projectId)
    const reason = s.reason === 'last-week' ? 'vorige week' : 'patroon'
    const time = s.startTime ? ` · ${s.startTime}–${s.endTime}` : ''
    return `${name}${time} (${reason})`
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2e2a26] flex items-center gap-4 flex-shrink-0">
        <div>
          <div className="text-[#e8e2d9] font-bold capitalize">{dateLabel}</div>
          <div className={`text-[11px] mt-0.5 ${totalHours >= 8 ? 'text-green-400' : 'text-amber-400'}`}>
            {totalHours}u geboekt · {Math.max(0, 8 - totalHours)}u te gaan
          </div>
        </div>
        <div className="flex-1 h-[5px] bg-[#2e2a26] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Tijdlijn */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex gap-3">
          {/* Uurlabels */}
          <div className="flex flex-col flex-shrink-0 w-8">
            {Array.from({ length: 10 }, (_, i) => i + 8).map((hour) => (
              <div
                key={hour}
                className="text-[#475569] text-[9px] flex items-start"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                {hour.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Blokken */}
          <div className="flex-1 flex flex-col gap-[1px]">
            {blocks.map((block, i) => {
              const height = blockHeight(block.startTime, block.endTime)

              if (block.type === 'entry') {
                return (
                  <button
                    key={i}
                    onClick={() => onEditEntry(block.entry)}
                    style={{ height }}
                    className="w-full text-left bg-indigo-950 border-l-[3px] border-indigo-500 rounded-r px-3 py-1 hover:bg-indigo-900 transition-colors cursor-pointer flex flex-col justify-center"
                  >
                    <div className="text-[#e8e2d9] text-[11px] font-semibold truncate">
                      {projectName(block.entry.projectId)}
                    </div>
                    <div className="text-indigo-300 text-[9px]">
                      {block.entry.startTime}–{block.entry.endTime} · {block.entry.hours}u
                    </div>
                    {block.entry.note && (
                      <div className="text-[#64748b] text-[9px] truncate">{block.entry.note}</div>
                    )}
                  </button>
                )
              }

              // gap
              if (block.suggestion) {
                return (
                  <div
                    key={i}
                    style={{ height }}
                    className="w-full bg-[#1a2332] border border-dashed border-indigo-800 rounded px-3 py-1 flex items-center justify-between"
                  >
                    <div className="text-indigo-400 text-[10px] truncate flex-1 mr-2">
                      → {suggestionLabel(block.suggestion)}
                    </div>
                    <button
                      onClick={() => onBookSuggestion(block.suggestion!)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] px-2 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
                    >
                      + Boek
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={i}
                  style={{ height }}
                  className="w-full bg-[#16213e] rounded border border-[#1e293b]"
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/DayTimeline.tsx
git commit -m "feat(ui): add DayTimeline component"
```

---

## Task 13: WeekPage + App.tsx aansluiten

**Files:**
- Create: `src/ui/pages/WeekPage.tsx`
- Modify: `src/App.tsx`
- Delete: `src/ui/pages/Home.tsx`

- [ ] **Stap 1: Maak WeekPage.tsx**

Maak `src/ui/pages/WeekPage.tsx`:

```tsx
import { useState } from 'react'
import { useWeek } from '../hooks/useWeek'
import { useSuggestions } from '../hooks/useSuggestions'
import { WeekDayList } from '../components/WeekDayList'
import { DayTimeline } from '../components/DayTimeline'
import { BookingModal } from './BookingModal'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
}

function weekLabel(weekStart: string): string {
  const today = new Date().toISOString().split('T')[0]!
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
  const [bookingEntry, setBookingEntry] = useState<Partial<HourEntry> | null>(null)

  function handleBookSuggestion(suggestion: HourEntrySuggestion) {
    setBookingEntry({
      projectId: suggestion.projectId,
      projectServiceId: suggestion.projectServiceId,
      hourTypeId: suggestion.hourTypeId,
      startTime: suggestion.startTime,
      endTime: suggestion.endTime,
      startDate: week.selectedDate,
    })
  }

  function handleEditEntry(entry: HourEntry) {
    setBookingEntry({
      ...entry,
      startDate: entry.startDate,
    })
  }

  const selectedEntries = week.entriesByDate[week.selectedDate] ?? []

  return (
    <div className="h-full flex bg-[#1c1917] text-[#e8e2d9]">
      <WeekDayList
        weekDays={week.weekDays}
        selectedDate={week.selectedDate}
        hoursForDate={week.hoursForDate}
        onSelectDate={week.selectDate}
        onPrevWeek={week.prevWeek}
        onNextWeek={week.nextWeek}
        weekLabel={weekLabel(week.selectedWeekStart)}
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
          onBookSuggestion={handleBookSuggestion}
          onEditEntry={handleEditEntry}
        />
      )}

      {bookingEntry && (
        <BookingModal
          initialEntry={bookingEntry}
          onClose={() => setBookingEntry(null)}
          onBooked={() => {
            setBookingEntry(null)
            void week.refresh()
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Stap 2: Verwijder Home.tsx**

```bash
rm src/ui/pages/Home.tsx
```

- [ ] **Stap 3: Pas App.tsx aan**

Vervang de volledige inhoud van `src/App.tsx`:

```tsx
import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { useAppInit } from './ui/hooks/useAppInit'
import { LoginPage } from './ui/pages/LoginPage'
import { WeekPage } from './ui/pages/WeekPage'
import ImportPage from './ui/pages/ImportPage'
import { Sidebar } from './ui/components/Sidebar'
import { SettingsPage } from './ui/pages/Settings/SettingsPage'

type Page = 'home' | 'import'

function App() {
  useAppInit()
  const user = useAppStore((s) => s.user)
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [showSettings, setShowSettings] = useState(false)

  if (!user) return <LoginPage />

  if (showSettings) {
    return (
      <div className="h-screen flex overflow-hidden bg-[#1c1917]">
        <Sidebar current={currentPage} onNavigate={setCurrentPage} onSettings={() => setShowSettings(true)} />
        <div className="flex-1 overflow-hidden">
          <SettingsPage onBack={() => setShowSettings(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#1c1917]">
      <Sidebar current={currentPage} onNavigate={setCurrentPage} onSettings={() => setShowSettings(true)} />
      <div className="flex-1 overflow-hidden">
        {currentPage === 'home' && <WeekPage />}
        {currentPage === 'import' && <ImportPage />}
      </div>
    </div>
  )
}

export default App
```

- [ ] **Stap 4: Volledige typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Verwacht: geen fouten.

- [ ] **Stap 5: Draai alle unit tests**

```bash
npm run test
```

Verwacht: alle tests PASS (inclusief bestaande import-flow tests).

- [ ] **Stap 6: Commit**

```bash
git add -A
git commit -m "feat(ui): add WeekPage, wire up to App, remove HomePage"
```

---

## Task 14: Verificatie in de app

- [ ] **Stap 1: Start de dev server**

```bash
npm run tauri dev
```

- [ ] **Stap 2: Controleer de volgende scenario's**

1. App opent op WeekPage met de huidige week. Vandaag is geselecteerd.
2. Dagen met bestaande boekingen tonen voortgangsbalken.
3. Klikken op een andere dag laadt de tijdlijn voor die dag.
4. Gaten in de tijdlijn tonen suggesties met "+ Boek" knoppen.
5. Klikken op "+ Boek" opent BookingModal met pre-filled velden.
6. Na boeken herlaadt de tijdlijn en toont de nieuwe boeking.
7. Vorige/volgende week navigatie werkt.
8. Import-pagina is nog steeds bereikbaar en werkt.
9. Instellingen toont alleen Account tab.

- [ ] **Stap 3: Final commit**

```bash
git add -A
git commit -m "chore: verify week/day view feature complete"
```
