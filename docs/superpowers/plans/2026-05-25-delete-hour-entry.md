# Delete Hour Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een verwijderknop toe aan de BookingModal waarmee een bestaande uur-entry in Simplicate verwijderd kan worden, met een two-step bevestiging (idle → confirm → verwijderd).

**Architecture:** Clean Architecture — nieuwe `DeleteHourEntryUseCase` in domain, `deleteHourEntry(id)` in `ISimplicateRepository`, implementatie via `DELETE /hours/hours/:id` Tauri IPC. UI: lokale `deleteState` in `BookingModal`, `deleteEntry()` functie in `useBooking`.

**Tech Stack:** TypeScript strict, React, Vitest, Tauri IPC, Simplicate REST API

---

## File Map

| Actie | Pad |
|---|---|
| Modify | `src/domain/repositories/ISimplicateRepository.ts` |
| Create | `src/domain/usecases/DeleteHourEntryUseCase.ts` |
| Create | `src/domain/usecases/DeleteHourEntryUseCase.test.ts` |
| Modify | `src/infrastructure/simplicate/SimplicateRepository.ts` |
| Modify | `src/application/container.ts` |
| Modify | `src/ui/hooks/useBooking.ts` |
| Modify | `src/ui/pages/BookingModal.tsx` |

---

### Task 1: Voeg `deleteHourEntry` toe aan de repository interface

**Files:**
- Modify: `src/domain/repositories/ISimplicateRepository.ts`

- [ ] **Stap 1: Voeg de methode toe aan de interface**

Vervang regel 33 (na `getHourEntries`):

```typescript
export interface ISimplicateRepository {
  getProjects(): Promise<SimplicateProject[]>
  getServices(projectId: string, date: string): Promise<SimplicateService[]>
  getHourTypes(): Promise<SimplicateHourType[]>
  getEmployee(email: string): Promise<SimplicateEmployee>
  bookHours(entries: HourEntry[]): Promise<void>
  getHourEntries(employeeId: string, from: string, to: string): Promise<HourEntry[]>
  deleteHourEntry(id: string): Promise<void>
}
```

- [ ] **Stap 2: Typecheck — verwacht fout in SimplicateRepository**

```bash
npm run typecheck 2>&1 | grep deleteHourEntry
```

Verwacht: foutmelding dat `SimplicateRepository` `deleteHourEntry` niet implementeert.

- [ ] **Stap 3: Commit**

```bash
git add src/domain/repositories/ISimplicateRepository.ts
git commit -m "feat(domain): add deleteHourEntry to ISimplicateRepository"
```

---

### Task 2: Schrijf en implementeer `DeleteHourEntryUseCase`

**Files:**
- Create: `src/domain/usecases/DeleteHourEntryUseCase.ts`
- Create: `src/domain/usecases/DeleteHourEntryUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing test**

Maak `src/domain/usecases/DeleteHourEntryUseCase.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { DeleteHourEntryUseCase } from './DeleteHourEntryUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

function makeRepo(): ISimplicateRepository {
  return {
    bookHours: vi.fn(),
    getHourEntries: vi.fn(),
    getProjects: vi.fn(),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
    deleteHourEntry: vi.fn().mockResolvedValue(undefined),
  } as unknown as ISimplicateRepository
}

describe('DeleteHourEntryUseCase', () => {
  it('roept deleteHourEntry aan op de repository met het gegeven id', async () => {
    const repo = makeRepo()
    const useCase = new DeleteHourEntryUseCase(repo)
    await useCase.execute('hours:abc123')
    expect(repo.deleteHourEntry).toHaveBeenCalledWith('hours:abc123')
  })

  it('gooit een fout als id leeg is', async () => {
    const repo = makeRepo()
    const useCase = new DeleteHourEntryUseCase(repo)
    await expect(useCase.execute('')).rejects.toThrow('id ontbreekt')
  })

  it('gooit een fout als id undefined is', async () => {
    const repo = makeRepo()
    const useCase = new DeleteHourEntryUseCase(repo)
    await expect(useCase.execute(undefined as unknown as string)).rejects.toThrow('id ontbreekt')
  })
})
```

- [ ] **Stap 2: Draai de test — verwacht FAIL**

```bash
npm run test -- DeleteHourEntryUseCase --reporter=verbose 2>&1 | tail -20
```

Verwacht: `Cannot find module './DeleteHourEntryUseCase'`

- [ ] **Stap 3: Schrijf de implementatie**

Maak `src/domain/usecases/DeleteHourEntryUseCase.ts`:

```typescript
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

export class DeleteHourEntryUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(id: string): Promise<void> {
    if (!id) throw new Error('id ontbreekt')
    await this.simplicateRepo.deleteHourEntry(id)
  }
}
```

- [ ] **Stap 4: Draai de test — verwacht PASS**

```bash
npm run test -- DeleteHourEntryUseCase --reporter=verbose 2>&1 | tail -10
```

Verwacht: `3 passed`

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/DeleteHourEntryUseCase.ts src/domain/usecases/DeleteHourEntryUseCase.test.ts
git commit -m "feat(domain): add DeleteHourEntryUseCase"
```

---

### Task 3: Implementeer `deleteHourEntry` in SimplicateRepository

**Files:**
- Modify: `src/infrastructure/simplicate/SimplicateRepository.ts`

- [ ] **Stap 1: Voeg een `delete` helper en de methode toe**

Voeg na de `post` methode (na regel 46) een private `delete` methode toe, en voeg `deleteHourEntry` toe als laatste methode van de klasse:

```typescript
  private async delete(path: string): Promise<void> {
    const url = `${this.baseUrl}${path}`
    await invoke<string>('simplicate_request', {
      args: {
        method: 'DELETE',
        url,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        body: null,
      },
    })
  }
```

En aan het einde van de klasse (na `getHourEntries`):

```typescript
  async deleteHourEntry(id: string): Promise<void> {
    await this.delete(`/hours/hours/${encodeURIComponent(id)}`)
  }
```

- [ ] **Stap 2: Typecheck — verwacht geen fouten**

```bash
npm run typecheck 2>&1 | grep -E "error|deleteHourEntry"
```

Verwacht: geen output (geen fouten).

- [ ] **Stap 3: Commit**

```bash
git add src/infrastructure/simplicate/SimplicateRepository.ts
git commit -m "feat(infra): implement deleteHourEntry in SimplicateRepository"
```

---

### Task 4: Registreer `DeleteHourEntryUseCase` in de container

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Stap 1: Voeg import en registratie toe**

Voeg na regel 20 (`import { BookHoursUseCase }`) toe:

```typescript
import { DeleteHourEntryUseCase } from '../domain/usecases/DeleteHourEntryUseCase'
```

Voeg in de `createUseCases` functie (na `bookHours: new BookHoursUseCase(simplicateRepo),`) toe:

```typescript
    deleteHourEntry: new DeleteHourEntryUseCase(simplicateRepo),
```

Het volledige `createUseCases` return object wordt:

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
  }
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep error
```

Verwacht: geen output.

- [ ] **Stap 3: Commit**

```bash
git add src/application/container.ts
git commit -m "feat(app): register DeleteHourEntryUseCase in container"
```

---

### Task 5: Voeg `deleteEntry` toe aan `useBooking`

**Files:**
- Modify: `src/ui/hooks/useBooking.ts`

- [ ] **Stap 1: Voeg de `deleteEntry` functie toe**

Voeg na de `book` functie (na regel 119, voor de `return`) toe:

```typescript
  async function deleteEntry(id: string) {
    setStatus('loading')
    setErrorMessage(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { deleteHourEntry } = createUseCases(simplicateRepo)

      await deleteHourEntry.execute(id)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Verwijderen mislukt')
    }
  }
```

- [ ] **Stap 2: Voeg `deleteEntry` toe aan de return waarde**

Voeg `deleteEntry,` toe aan het return object (na `book,`):

```typescript
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
    projects: sortedProjects,
    starredIds,
    toggleStar,
    lastStarredId,
    hourTypes,
    book,
    deleteEntry,
  }
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep error
```

Verwacht: geen output.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/hooks/useBooking.ts
git commit -m "feat(ui): add deleteEntry to useBooking hook"
```

---

### Task 6: Voeg verwijderknop met two-step bevestiging toe aan BookingModal

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Stap 1: Voeg `useState` en `useRef` imports toe en `onDeleted` prop**

Regel 1 wordt:

```typescript
import { useEffect, useState, useRef } from 'react'
```

De `Props` interface (regel 90–96) wordt:

```typescript
interface Props {
  initialEntry?: Partial<HourEntry>
  title?: string
  evidenceBlock?: ClassifiedBlock
  onClose: () => void
  onBooked?: () => void
  onDeleted?: () => void
}
```

De functiesignatuur (regel 98) wordt:

```typescript
export function BookingModal({ initialEntry = {}, title = 'Uren boeken', evidenceBlock, onClose, onBooked, onDeleted }: Props) {
```

- [ ] **Stap 2: Voeg deleteState toe onder `const booking = useBooking(initialEntry)`**

Voeg toe na regel 99 (`const booking = useBooking(initialEntry)`):

```typescript
  type DeleteState = 'idle' | 'confirm'
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleDeleteClick() {
    if (deleteState === 'idle') {
      setDeleteState('confirm')
      deleteTimeoutRef.current = setTimeout(() => setDeleteState('idle'), 3000)
    } else {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
      void booking.deleteEntry(initialEntry.id!)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    }
  }, [])
```

- [ ] **Stap 3: Reageer op success status voor delete**

Verander de success check (regel 125):

```typescript
  if (booking.status === 'success') {
    if (initialEntry.id) {
      // Verwijdering geslaagd
      onDeleted?.()
    } else {
      onBooked?.()
    }
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(1px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: 24, width: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: 'var(--success)', fontSize: 36 }}>✓</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {initialEntry.id ? 'Boeking verwijderd!' : 'Uren geboekt!'}
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

- [ ] **Stap 4: Voeg de verwijderknop toe in de footer**

Vervang de volledige footer (regels 214–229):

```tsx
        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={onClose}
              style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              Annuleren
            </button>
            {initialEntry.id && (
              <button
                onClick={handleDeleteClick}
                disabled={booking.status === 'loading'}
                style={{
                  background: deleteState === 'confirm' ? '#b45309' : 'transparent',
                  color: deleteState === 'confirm' ? 'white' : '#ef4444',
                  border: `1px solid ${deleteState === 'confirm' ? '#b45309' : '#ef4444'}`,
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: booking.status === 'loading' ? 'not-allowed' : 'pointer',
                  opacity: booking.status === 'loading' ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {booking.status === 'loading' && deleteState === 'confirm'
                  ? 'Bezig...'
                  : deleteState === 'confirm'
                    ? 'Zeker weten?'
                    : 'Verwijderen'}
              </button>
            )}
          </div>
          <button
            onClick={booking.book}
            disabled={!booking.canBook || booking.status === 'loading'}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: booking.canBook ? 'pointer' : 'not-allowed', opacity: booking.canBook ? 1 : 0.4 }}
          >
            {booking.status === 'loading' ? 'Bezig...' : 'Opslaan'}
          </button>
        </div>
```

- [ ] **Stap 5: Typecheck**

```bash
npm run typecheck 2>&1 | grep error
```

Verwacht: geen output.

- [ ] **Stap 6: Lint**

```bash
npm run lint 2>&1 | tail -20
```

Verwacht: geen errors.

- [ ] **Stap 7: Alle tests draaien**

```bash
npm run test 2>&1 | tail -15
```

Verwacht: alle bestaande tests + de nieuwe `DeleteHourEntryUseCase` tests groen.

- [ ] **Stap 8: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "feat(ui): add two-step delete button to BookingModal"
```

---

### Task 7: Koppel `onDeleted` in WeekPage

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

- [ ] **Stap 1: Zoek waar BookingModal gebruikt wordt**

```bash
grep -n "BookingModal\|onBooked" src/ui/pages/WeekPage.tsx | head -30
```

- [ ] **Stap 2: Voeg `onDeleted` prop toe aan BookingModal aanroep**

Zoek de `<BookingModal` JSX in WeekPage.tsx. Voeg `onDeleted` toe naast `onBooked`:

```tsx
onDeleted={() => {
  setBookingEntry(null)
  void refreshWeek()   // of de bestaande refresh-functie die ook bij onBooked gebruikt wordt
}}
```

Gebruik dezelfde refresh-aanroep die bij `onBooked` staat — kijk welke functie daar aangeroepen wordt en gebruik exact dezelfde.

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep error
```

Verwacht: geen output.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/pages/WeekPage.tsx
git commit -m "feat(ui): wire onDeleted callback in WeekPage"
```
