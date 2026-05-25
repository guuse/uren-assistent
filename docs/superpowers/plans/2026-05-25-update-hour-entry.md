# Update Hour Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak het mogelijk om een bestaande uur-entry in Simplicate bij te werken (tijd + project), zodat "Opslaan" in de modal een PUT doet in plaats van een nieuwe POST aanmaken.

**Architecture:** Nieuwe `UpdateHourEntryUseCase` in domain, `updateHourEntry` in `ISimplicateRepository`, `PUT /hours/hours/:id` via Tauri IPC in `SimplicateRepository`. In `useBooking.book()` brancht op `initial.id`: aanwezig → update, afwezig → nieuw. `BookingModal` success-flow bijgewerkt om onderscheid te maken tussen opslaan en verwijderen.

**Tech Stack:** TypeScript strict, React, Vitest, Tauri IPC, Simplicate REST API

---

## File Map

| Actie | Pad |
|---|---|
| Modify | `src/domain/repositories/ISimplicateRepository.ts` |
| Create | `src/domain/usecases/UpdateHourEntryUseCase.ts` |
| Create | `src/domain/usecases/UpdateHourEntryUseCase.test.ts` |
| Modify | `src/infrastructure/simplicate/SimplicateRepository.ts` |
| Modify | `src/application/container.ts` |
| Modify | `src/ui/hooks/useBooking.ts` |
| Modify | `src/ui/pages/BookingModal.tsx` |

---

### Task 1: Voeg `updateHourEntry` toe aan de repository interface

**Files:**
- Modify: `src/domain/repositories/ISimplicateRepository.ts`

- [ ] **Stap 1: Voeg de methode toe aan de interface**

De huidige interface (regels 27-35) wordt uitgebreid. Voeg `updateHourEntry` toe na `deleteHourEntry`:

```typescript
export interface ISimplicateRepository {
  getProjects(): Promise<SimplicateProject[]>
  getServices(projectId: string, date: string): Promise<SimplicateService[]>
  getHourTypes(): Promise<SimplicateHourType[]>
  getEmployee(email: string): Promise<SimplicateEmployee>
  bookHours(entries: HourEntry[]): Promise<void>
  getHourEntries(employeeId: string, from: string, to: string): Promise<HourEntry[]>
  deleteHourEntry(id: string): Promise<void>
  updateHourEntry(entry: HourEntry): Promise<void>
}
```

- [ ] **Stap 2: Typecheck — verwacht fout in SimplicateRepository**

```bash
npm run typecheck 2>&1 | grep updateHourEntry
```

Verwacht: foutmelding dat `SimplicateRepository` `updateHourEntry` niet implementeert.

- [ ] **Stap 3: Commit**

```bash
git add src/domain/repositories/ISimplicateRepository.ts
git commit -m "feat(domain): add updateHourEntry to ISimplicateRepository"
```

---

### Task 2: Schrijf en implementeer `UpdateHourEntryUseCase`

**Files:**
- Create: `src/domain/usecases/UpdateHourEntryUseCase.ts`
- Create: `src/domain/usecases/UpdateHourEntryUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing test**

Maak `src/domain/usecases/UpdateHourEntryUseCase.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { UpdateHourEntryUseCase } from './UpdateHourEntryUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function makeRepo(): ISimplicateRepository {
  return {
    bookHours: vi.fn(),
    getHourEntries: vi.fn(),
    getProjects: vi.fn(),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
    deleteHourEntry: vi.fn(),
    updateHourEntry: vi.fn().mockResolvedValue(undefined),
  } as unknown as ISimplicateRepository
}

function validEntry(): HourEntry {
  return {
    id: 'hours:abc123',
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-25',
    startTime: '09:00',
    endTime: '11:00',
    note: '',
  }
}

describe('UpdateHourEntryUseCase', () => {
  it('roept updateHourEntry aan op de repository met het volledige entry object', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = validEntry()
    await useCase.execute(entry)
    expect(repo.updateHourEntry).toHaveBeenCalledWith(entry)
  })

  it('gooit een fout als id ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = { ...validEntry(), id: undefined }
    await expect(useCase.execute(entry)).rejects.toThrow('id ontbreekt')
  })

  it('gooit een fout als id leeg is', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = { ...validEntry(), id: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('id ontbreekt')
  })

  it('gooit een fout als projectId ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = { ...validEntry(), projectId: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('projectId')
  })

  it('gooit een fout als startDate ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = { ...validEntry(), startDate: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('startDate')
  })
})
```

- [ ] **Stap 2: Draai de test — verwacht FAIL**

```bash
npm run test -- UpdateHourEntryUseCase --reporter=verbose 2>&1 | tail -10
```

Verwacht: `Cannot find module './UpdateHourEntryUseCase'`

- [ ] **Stap 3: Schrijf de implementatie**

Maak `src/domain/usecases/UpdateHourEntryUseCase.ts`:

```typescript
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

export class UpdateHourEntryUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(entry: HourEntry): Promise<void> {
    if (!entry.id) throw new Error('id ontbreekt')
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
    await this.simplicateRepo.updateHourEntry(entry)
  }
}
```

- [ ] **Stap 4: Draai de test — verwacht PASS**

```bash
npm run test -- UpdateHourEntryUseCase --reporter=verbose 2>&1 | tail -10
```

Verwacht: `5 passed`

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/UpdateHourEntryUseCase.ts src/domain/usecases/UpdateHourEntryUseCase.test.ts
git commit -m "feat(domain): add UpdateHourEntryUseCase"
```

---

### Task 3: Implementeer `updateHourEntry` in SimplicateRepository

**Files:**
- Modify: `src/infrastructure/simplicate/SimplicateRepository.ts`

- [ ] **Stap 1: Voeg een `put` helper toe en de methode**

De huidige `delete` helper staat op regels 48-59. Voeg de `put` helper toe direct daarna (na regel 59):

```typescript
  private async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const json = await invoke<string>('simplicate_request', {
      args: {
        method: 'PUT',
        url,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        body: JSON.stringify(body),
      },
    })
    return JSON.parse(json) as T
  }
```

En voeg `updateHourEntry` toe aan het einde van de klasse (na `deleteHourEntry`):

```typescript
  async updateHourEntry(entry: HourEntry): Promise<void> {
    await this.put(`/hours/hours/${encodeURIComponent(entry.id!)}`, {
      employee_id: entry.employeeId,
      project_id: entry.projectId,
      projectservice_id: entry.projectServiceId,
      type_id: entry.hourTypeId,
      hours: entry.hours,
      start_date: `${entry.startDate} ${entry.startTime}:00`,
      end_date: `${entry.startDate} ${entry.endTime}:00`,
      note: entry.note,
      is_time_defined: true,
      is_recurring: false,
    })
  }
```

- [ ] **Stap 2: Typecheck — verwacht geen fouten**

```bash
npm run typecheck 2>&1 | grep error
```

Verwacht: geen output.

- [ ] **Stap 3: Commit**

```bash
git add src/infrastructure/simplicate/SimplicateRepository.ts
git commit -m "feat(infra): implement updateHourEntry in SimplicateRepository"
```

---

### Task 4: Registreer `UpdateHourEntryUseCase` in de container

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Stap 1: Voeg import toe**

Voeg na de `DeleteHourEntryUseCase` import (regel 21) toe:

```typescript
import { UpdateHourEntryUseCase } from '../domain/usecases/UpdateHourEntryUseCase'
```

- [ ] **Stap 2: Voeg toe aan `createUseCases` return object**

Voeg na `deleteHourEntry: new DeleteHourEntryUseCase(simplicateRepo),` toe:

```typescript
    updateHourEntry: new UpdateHourEntryUseCase(simplicateRepo),
```

Het volledige return object wordt:

```typescript
  return {
    fetchSimplicateData: new FetchSimplicateDataUseCase(simplicateRepo),
    parseBrowserHistory: new ParseBrowserHistoryUseCase(),
    classifyHistoryBlocks: (copilotRepo: ICopilotRepository) =>
      new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo),
    getWeekEntries: new GetWeekEntriesUseCase(simplicateRepo),
    generateSuggestions: new GenerateSuggestionsUseCase(),
    bookHours: new BookHoursUseCase(simplicateRepo),
    deleteHourEntry: new DeleteHourEntryUseCase(simplicateRepo),
    updateHourEntry: new UpdateHourEntryUseCase(simplicateRepo),
  }
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep error
```

Verwacht: geen output.

- [ ] **Stap 4: Commit**

```bash
git add src/application/container.ts
git commit -m "feat(app): register UpdateHourEntryUseCase in container"
```

---

### Task 5: Branch op `initial.id` in `useBooking.book()`

**Files:**
- Modify: `src/ui/hooks/useBooking.ts`

De `book()` functie staat op regels 85-119. De `initial` parameter is de `Partial<HourEntry>` die bij aanmaak van de hook meegegeven wordt (parameter heet `initial` in de hook body na de `useBooking(initial: Partial<HourEntry> = {})` signatuur).

- [ ] **Stap 1: Pas `book()` aan**

Vervang de huidige `book()` functie (regels 85-119) volledig:

```typescript
  async function book() {
    if (!simplicateEmployeeId) return
    setStatus('loading')
    setErrorMessage(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const useCases = createUseCases(simplicateRepo)

      const [hStart, mStart] = startTime.split(':').map(Number)
      const [hEnd, mEnd] = endTime.split(':').map(Number)
      const hours = Math.round(((hEnd! * 60 + mEnd!) - (hStart! * 60 + mStart!)) / 60 * 2) / 2

      if (initial.id) {
        const entry: HourEntry = {
          id: initial.id,
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
        await useCases.updateHourEntry.execute(entry)
      } else {
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
        await useCases.bookHours.execute(entry)
      }

      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Boeken mislukt')
    }
  }
```

Let op: de parameter aan het begin van `useBooking` heet `initial` (regel 23: `export function useBooking(initial: Partial<HourEntry> = {})`). Gebruik `initial.id` om te detecteren of het een update of een nieuwe boeking is.

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep error
```

Verwacht: geen output.

- [ ] **Stap 3: Alle tests draaien**

```bash
npm run test 2>&1 | tail -5
```

Verwacht: alle tests groen.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/hooks/useBooking.ts
git commit -m "feat(ui): branch book() on initial.id to update or create"
```

---

### Task 6: Fix success-flow in BookingModal

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

**Huidig probleem (bug):** Regels 147-152 roepen `onDeleted?.()` aan als `initialEntry.id` aanwezig is — ook bij een normale "Opslaan". Dit is onjuist. De success-flow moet onderscheid maken tussen drie cases:
1. Verwijdering geslaagd → `onDeleted?.()`
2. Update geslaagd (opslaan van bestaande boeking) → `onBooked?.()` (modal sluit, week ververst)
3. Nieuwe boeking → `onBooked?..()`

De truc: `deleteState` is al beschikbaar in de component. Als `deleteState === 'confirm'` was en status `success` wordt, was het een verwijdering. Anders was het een opslaan.

- [ ] **Stap 1: Voeg `wasDelete` tracking toe**

De huidige `handleDeleteClick` staat ergens na regel 100. Voeg een extra ref toe om bij te houden of de lopende actie een delete is:

Voeg toe direct na `const deleteTimeoutRef = useRef<...>(null)`:

```typescript
  const isDeleteActionRef = useRef(false)
```

Pas `handleDeleteClick` aan zodat het de ref zet:

```typescript
  function handleDeleteClick() {
    if (deleteState === 'idle') {
      setDeleteState('confirm')
      deleteTimeoutRef.current = setTimeout(() => setDeleteState('idle'), 3000)
    } else {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
      isDeleteActionRef.current = true
      void booking.deleteEntry(initialEntry.id!)
    }
  }
```

Reset de ref ook in de cleanup useEffect:

```typescript
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
      isDeleteActionRef.current = false
    }
  }, [])
```

- [ ] **Stap 2: Pas de success-block aan**

Vervang de success-block (regels 147-170, begint bij `if (booking.status === 'success')`):

```typescript
  if (booking.status === 'success') {
    if (isDeleteActionRef.current) {
      onDeleted?.()
    } else {
      onBooked?.()
    }
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(1px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: 24, width: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: 'var(--success)', fontSize: 36 }}>✓</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {isDeleteActionRef.current
              ? 'Boeking verwijderd!'
              : initialEntry.id
                ? 'Uren bijgewerkt!'
                : 'Uren geboekt!'}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            Sluiten
          </button>
        </div>
      </div>
    )
  }
```

- [ ] **Stap 3: Typecheck + lint + tests**

```bash
npm run typecheck 2>&1 | grep error
npm run lint 2>&1 | grep -E "^src/ui/pages/BookingModal"
npm run test 2>&1 | tail -5
```

Verwacht: geen errors, alle tests groen.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "fix(ui): correctly distinguish delete vs save in BookingModal success flow"
```
