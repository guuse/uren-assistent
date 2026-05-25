# Clear LLM Blocks UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign de WeekDayList sidebar zodat (A) de prullenbak-knop zichtbaar is voor alle dagen met LLM-blokken (niet alleen de geselecteerde dag), en (B) een week-niveau opruim-knop wordt toegevoegd.

**Architecture:** Nieuw `ClearWeekBlocksUseCase` in domain layer iteratief over alle weekdagen. Nieuw `useClearWeekBlocks` hook in UI layer. `WeekDayList` krijgt prullenbak inline rechts van dagnaam (altijd zichtbaar per dag met LLM-blokken) + week-knop boven de actie-knoppen. `WeekPage` geeft `weekDays` en `onClearWeekBlocks` door.

**Tech Stack:** TypeScript strict, React, Vitest, Lucide-react (Trash2 al aanwezig)

---

## Files

| Actie | Pad | Verantwoordelijkheid |
|---|---|---|
| Create | `src/domain/usecases/ClearWeekBlocksUseCase.ts` | Itereer over weekdagen, roep ClearDayBlocksUseCase aan per dag |
| Create | `src/domain/usecases/ClearWeekBlocksUseCase.test.ts` | Unit tests voor week-opruim use case |
| Modify | `src/application/container.ts` | Factory `createClearWeekBlocksUseCase()` toevoegen |
| Create | `src/ui/hooks/useClearWeekBlocks.ts` | Hook: loading state, error, roept use case aan, onSuccess callback |
| Modify | `src/ui/components/WeekDayList.tsx` | Props uitbreiden, prullenbak voor alle dagen, week-knop, ConfirmDialog voor week |
| Modify | `src/ui/pages/WeekPage.tsx` | `llmBlockCountForDate` voor alle dagen, week-hook wiren, props doorgeven |

---

### Task 1: ClearWeekBlocksUseCase

**Files:**
- Create: `src/domain/usecases/ClearWeekBlocksUseCase.ts`
- Create: `src/domain/usecases/ClearWeekBlocksUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing test**

```typescript
// src/domain/usecases/ClearWeekBlocksUseCase.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClearWeekBlocksUseCase } from './ClearWeekBlocksUseCase'
import type { IHistoryStore } from '../repositories/IHistoryStore'

const makeMockStore = (blocksByDate: Record<string, { urlPattern: string; origin: string }[]>): IHistoryStore => ({
  getBlocksForDate: vi.fn(async (date: string) =>
    (blocksByDate[date] ?? []) as Parameters<IHistoryStore['getBlocksForDate']>[0] extends string ? Awaited<ReturnType<IHistoryStore['getBlocksForDate']>> : never
  ) as IHistoryStore['getBlocksForDate'],
  removeBlock: vi.fn(async () => {}),
  saveBlocksForDate: vi.fn(async () => {}),
  hasDataForDate: vi.fn(async () => false),
  hasHistoryForWeek: vi.fn(async () => false),
})

describe('ClearWeekBlocksUseCase', () => {
  it('verwijdert LLM-blokken van alle opgegeven weekdagen', async () => {
    const store = makeMockStore({
      '2026-05-26': [
        { urlPattern: 'github.com/a', origin: 'llm' },
        { urlPattern: 'github.com/b', origin: 'cache' },
      ],
      '2026-05-27': [
        { urlPattern: 'github.com/c', origin: 'llm-pattern' },
      ],
      '2026-05-28': [],
    })
    const useCase = new ClearWeekBlocksUseCase(store)
    const result = await useCase.execute(['2026-05-26', '2026-05-27', '2026-05-28'])
    expect(result.removedCount).toBe(2)
    expect(store.removeBlock).toHaveBeenCalledWith('2026-05-26', 'github.com/a')
    expect(store.removeBlock).not.toHaveBeenCalledWith('2026-05-26', 'github.com/b')
    expect(store.removeBlock).toHaveBeenCalledWith('2026-05-27', 'github.com/c')
  })

  it('geeft 0 terug als er geen LLM-blokken zijn', async () => {
    const store = makeMockStore({
      '2026-05-26': [{ urlPattern: 'github.com/x', origin: 'cache' }],
    })
    const useCase = new ClearWeekBlocksUseCase(store)
    const result = await useCase.execute(['2026-05-26'])
    expect(result.removedCount).toBe(0)
    expect(store.removeBlock).not.toHaveBeenCalled()
  })

  it('werkt met een lege lijst weekdagen', async () => {
    const store = makeMockStore({})
    const useCase = new ClearWeekBlocksUseCase(store)
    const result = await useCase.execute([])
    expect(result.removedCount).toBe(0)
  })

  it('geeft removedByDate terug per dag', async () => {
    const store = makeMockStore({
      '2026-05-26': [{ urlPattern: 'github.com/a', origin: 'llm' }],
      '2026-05-27': [{ urlPattern: 'github.com/b', origin: 'llm' }, { urlPattern: 'github.com/c', origin: 'llm' }],
    })
    const useCase = new ClearWeekBlocksUseCase(store)
    const result = await useCase.execute(['2026-05-26', '2026-05-27'])
    expect(result.removedByDate['2026-05-26']).toBe(1)
    expect(result.removedByDate['2026-05-27']).toBe(2)
  })
})
```

- [ ] **Stap 2: Run tests om te verifiëren dat ze falen**

```bash
npm run test -- ClearWeekBlocksUseCase
```
Verwacht: FAIL — `ClearWeekBlocksUseCase` bestaat niet.

- [ ] **Stap 3: Implementeer ClearWeekBlocksUseCase**

```typescript
// src/domain/usecases/ClearWeekBlocksUseCase.ts
import type { IHistoryStore } from '../repositories/IHistoryStore'

export interface ClearWeekBlocksResult {
  removedCount: number
  removedByDate: Record<string, number>
}

export class ClearWeekBlocksUseCase {
  constructor(private readonly historyStore: IHistoryStore) {}

  async execute(weekDays: string[]): Promise<ClearWeekBlocksResult> {
    let removedCount = 0
    const removedByDate: Record<string, number> = {}

    for (const date of weekDays) {
      const blocks = await this.historyStore.getBlocksForDate(date)
      const llmBlocks = blocks.filter(
        (b) => b.origin === 'llm' || b.origin === 'llm-pattern',
      )
      for (const block of llmBlocks) {
        await this.historyStore.removeBlock(date, block.urlPattern)
      }
      removedByDate[date] = llmBlocks.length
      removedCount += llmBlocks.length
    }

    return { removedCount, removedByDate }
  }
}
```

- [ ] **Stap 4: Run tests om te verifiëren dat ze slagen**

```bash
npm run test -- ClearWeekBlocksUseCase
```
Verwacht: 4 PASS

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/ClearWeekBlocksUseCase.ts src/domain/usecases/ClearWeekBlocksUseCase.test.ts
git commit -m "feat: add ClearWeekBlocksUseCase with tests"
```

---

### Task 2: Container factory + hook

**Files:**
- Modify: `src/application/container.ts`
- Create: `src/ui/hooks/useClearWeekBlocks.ts`

- [ ] **Stap 1: Voeg factory toe aan container**

Open `src/application/container.ts`. Voeg bovenaan de imports toe:

```typescript
import { ClearWeekBlocksUseCase } from '../domain/usecases/ClearWeekBlocksUseCase'
```

Voeg onderaan (na `createClearDayBlocksUseCase`) toe:

```typescript
export function createClearWeekBlocksUseCase(): ClearWeekBlocksUseCase {
  return new ClearWeekBlocksUseCase(historyStore)
}
```

- [ ] **Stap 2: Schrijf de hook**

```typescript
// src/ui/hooks/useClearWeekBlocks.ts
import { useState, useCallback } from 'react'
import { createClearWeekBlocksUseCase } from '../../application/container'

export function useClearWeekBlocks(onSuccess: (weekDays: string[]) => void) {
  const [isClearingWeek, setIsClearingWeek] = useState(false)
  const [clearWeekError, setClearWeekError] = useState<string | null>(null)

  const clearWeek = useCallback(async (weekDays: string[]) => {
    setIsClearingWeek(true)
    setClearWeekError(null)
    try {
      const useCase = createClearWeekBlocksUseCase()
      await useCase.execute(weekDays)
      onSuccess(weekDays)
    } catch (err) {
      setClearWeekError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setIsClearingWeek(false)
    }
  }, [onSuccess])

  return { clearWeek, isClearingWeek, clearWeekError }
}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```
Verwacht: geen fouten.

- [ ] **Stap 4: Commit**

```bash
git add src/application/container.ts src/ui/hooks/useClearWeekBlocks.ts
git commit -m "feat: add createClearWeekBlocksUseCase factory and useClearWeekBlocks hook"
```

---

### Task 3: WeekPage — llmBlockCountForDate voor alle dagen + week-hook wiren

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

Het probleem nu: `llmBlockCountForDate` geeft altijd 0 terug voor dagen die niet `selectedDate` zijn, omdat `useHistoryStore` alleen blokken voor één datum laadt. We lossen dit op door voor alle weekdagen het LLM-count bij te houden in een `Map` die bijgewerkt wordt na elke clear-actie.

- [ ] **Stap 1: Voeg week LLM count state toe en hook import**

Voeg bovenaan de imports toe in `WeekPage.tsx`:

```typescript
import { useClearWeekBlocks } from '../hooks/useClearWeekBlocks'
import { createClearWeekBlocksUseCase } from '../../application/container'
```

Voeg na de bestaande state-declaraties (na `abortRef`) toe:

```typescript
// LLM-block counts voor alle weekdagen (geladen on-demand)
const [weekLlmCounts, setWeekLlmCounts] = useState<Map<string, number>>(new Map())
```

- [ ] **Stap 2: Vervang llmBlockCountForDate**

Vervang de bestaande `llmBlockCountForDate` functie:

```typescript
// Laad LLM counts voor alle weekdagen wanneer de week verandert
useEffect(() => {
  async function loadWeekLlmCounts() {
    const useCase = createClearWeekBlocksUseCase()
    // Gebruik getBlocksForDate via historyStore direct
    const counts = new Map<string, number>()
    for (const date of week.weekDays) {
      const blocks = await domainHistoryStore.getBlocksForDate(date)
      const llmCount = blocks.filter(
        b => b.origin === 'llm' || b.origin === 'llm-pattern'
      ).length
      counts.set(date, llmCount)
    }
    setWeekLlmCounts(counts)
  }
  void loadWeekLlmCounts()
}, [week.weekDays, week.selectedWeekStart])

function llmBlockCountForDate(date: string): number {
  // Voor de geselecteerde dag: gebruik live data uit historyStore
  if (date === week.selectedDate) {
    return historyStore.blocksForDate.filter(
      b => b.origin === 'llm' || b.origin === 'llm-pattern'
    ).length
  }
  return weekLlmCounts.get(date) ?? 0
}
```

Let op: verwijder de oude `llmBlockCountForDate` functie (regels 97-102 in de huidige versie).

Voeg `useEffect` toe aan de imports bovenaan:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'
```

- [ ] **Stap 3: Voeg week-clear hook toe**

Voeg na de bestaande `useClearDayBlocks` call toe:

```typescript
const { clearWeek, isClearingWeek, clearWeekError: clearWeekErr } = useClearWeekBlocks(
  async (clearedDays) => {
    for (const date of clearedDays) {
      await reloadForDate(date)
    }
    // Herlaad week LLM counts
    const counts = new Map<string, number>()
    for (const date of week.weekDays) {
      const blocks = await domainHistoryStore.getBlocksForDate(date)
      const llmCount = blocks.filter(
        b => b.origin === 'llm' || b.origin === 'llm-pattern'
      ).length
      counts.set(date, llmCount)
    }
    setWeekLlmCounts(counts)
  }
)
```

- [ ] **Stap 4: Geef week-props door aan WeekDayList**

Zoek de `<WeekDayList .../>` render call en voeg toe:

```typescript
onClearWeekBlocks={() => clearWeek(week.weekDays)}
isClearingWeek={isClearingWeek}
clearWeekError={clearWeekErr}
totalLlmBlockCount={Array.from(weekLlmCounts.values()).reduce((a, b) => a + b, 0)}
```

- [ ] **Stap 5: Typecheck**

```bash
npm run typecheck
```
Verwacht: fouten over ontbrekende props in WeekDayList (die voegen we toe in Task 4). Ignore die, ga verder.

- [ ] **Stap 6: Commit** (na Task 4 volledig)

---

### Task 4: WeekDayList — UX redesign optie A

**Files:**
- Modify: `src/ui/components/WeekDayList.tsx`

**Gewenst resultaat (Optie A):**
- Prullenbak-icoon rechts van de dagnaam, zichtbaar voor **elke dag** met LLM-blokken (niet alleen geselecteerde)
- Week-opruim knop in de actie-knoppen sectie bovenaan (vóór "Verwerk week")
- `canClear` niet meer afhankelijk van `isSelected`

- [ ] **Stap 1: Breid Props interface uit**

Vervang de bestaande `Props` interface met:

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
  llmBlockCountForDate?: (date: string) => number
  onClearDayBlocks?: (date: string) => Promise<void>
  isClearingDay?: boolean
  clearError?: string | null
  onClearWeekBlocks?: () => Promise<void>
  isClearingWeek?: boolean
  clearWeekError?: string | null
  totalLlmBlockCount?: number
}
```

- [ ] **Stap 2: Destructureer nieuwe props**

Voeg aan de destructuring toe (na `clearError`):

```typescript
  onClearWeekBlocks,
  isClearingWeek = false,
  clearWeekError,
  totalLlmBlockCount = 0,
```

Voeg ook week-confirm state toe na `confirmDate`:

```typescript
const [confirmWeek, setConfirmWeek] = useState(false)
```

- [ ] **Stap 3: Verander canClear — niet meer afhankelijk van isSelected**

Vervang regel:
```typescript
const canClear = llmCount > 0 && !!onClearDayBlocks && isSelected
```
Met:
```typescript
const canClear = llmCount > 0 && !!onClearDayBlocks
```

- [ ] **Stap 4: Verplaats prullenbak naar naast dagnaam**

Vervang het blok dat de prullenbak rendert (de `{canClear && (...)}` div met `mt-1 flex justify-end`):

```typescript
// VERWIJDER dit blok volledig:
{canClear && (
  <div className="mt-1 flex justify-end">
    <button ... >
      <Trash2 size={10} />
    </button>
  </div>
)}
```

En voeg de prullenbak toe **in de header-rij** van de dag, rechts naast de status-indicatoren. Vervang de bestaande `<div className="flex justify-between items-center">` sectie (regels 95-118) met:

```typescript
<div className="flex justify-between items-center">
  <span
    className={`text-[0.625rem] font-semibold ${
      isSelected ? 'text-[#a5b4fc]' : isFull ? 'text-[#94a3b8]' : 'text-[#64748b]'
    }`}
  >
    {label} {dayOfMonth}
  </span>
  <div className="flex items-center gap-1">
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
    {canClear && (
      <button
        onClick={(e) => {
          e.stopPropagation()
          setConfirmDate(date)
        }}
        title={`${llmCount} LLM-blok${llmCount !== 1 ? 'ken' : ''} verwijderen`}
        className="p-0.5 rounded transition-colors text-red-500/60 hover:text-red-400 cursor-pointer"
      >
        <Trash2 size={9} />
      </button>
    )}
  </div>
</div>
```

- [ ] **Stap 5: Voeg week-opruim knop toe**

Zoek de actie-knoppen sectie (`{(onProcessWeek || onUploadCsv) && (...)}`) en voeg **vóór** de `onProcessWeek` knop een week-clear knop toe:

```typescript
{(onProcessWeek || onUploadCsv) && (
  <div className="mt-2 px-1 flex flex-col gap-1.5">
    {onClearWeekBlocks && totalLlmBlockCount > 0 && (
      <button
        onClick={() => setConfirmWeek(true)}
        disabled={isClearingWeek}
        className="w-full bg-transparent border border-red-900/50 hover:border-red-800/70 disabled:opacity-40 text-red-500/70 hover:text-red-400 text-[0.5625rem] py-[5px] rounded-lg transition-colors cursor-pointer disabled:cursor-default flex items-center justify-center gap-1"
      >
        <Trash2 size={9} />
        {isClearingWeek ? 'Bezig...' : `Week opruimen (${totalLlmBlockCount})`}
      </button>
    )}
    {onProcessWeek && (
      // ... bestaande knop
    )}
    {onUploadCsv && (
      // ... bestaande knop
    )}
  </div>
)}
```

- [ ] **Stap 6: Voeg ConfirmDialog toe voor week**

Voeg na het bestaande `{confirmDate && ...}` blok toe:

```typescript
{confirmWeek && onClearWeekBlocks && (
  <ConfirmDialog
    title="Hele week opruimen?"
    description={`${totalLlmBlockCount} ongebookte LLM-concept${totalLlmBlockCount !== 1 ? 'en' : ''} van deze week worden verwijderd. Geschreven uren blijven staan.`}
    isLoading={isClearingWeek}
    onConfirm={async () => {
      await onClearWeekBlocks()
      setConfirmWeek(false)
    }}
    onCancel={() => setConfirmWeek(false)}
  />
)}
```

Voeg ook een error toast toe voor week-clear errors:

```typescript
{clearWeekError && (
  <div className="fixed bottom-4 right-4 z-50 bg-red-900/80 text-red-200 text-xs px-3 py-2 rounded-lg">
    {clearWeekError}
  </div>
)}
```

- [ ] **Stap 7: Typecheck**

```bash
npm run typecheck
```
Verwacht: geen fouten.

- [ ] **Stap 8: Commit WeekPage + WeekDayList samen**

```bash
git add src/ui/components/WeekDayList.tsx src/ui/pages/WeekPage.tsx
git commit -m "feat: redesign clear-LLM UX — per-dag prullenbak voor alle dagen + week-opruim knop"
```

---

### Task 5: Alle bestaande tests groen

- [ ] **Stap 1: Run alle tests**

```bash
npm run test
```
Verwacht: alle tests PASS inclusief `ClearDayBlocksUseCase` (4 tests) en `ClearWeekBlocksUseCase` (4 tests).

- [ ] **Stap 2: Typecheck finaal**

```bash
npm run typecheck
```
Verwacht: geen fouten.

- [ ] **Stap 3: Lint**

```bash
npm run lint
```
Verwacht: geen fouten.

---

## Self-Review

**Spec coverage:**
- ✅ Prullenbak zichtbaar voor alle dagen met LLM-blokken (canClear niet meer afhankelijk van isSelected)
- ✅ Prullenbak inline rechts van dagnaam (Optie A)
- ✅ Week-opruim knop toegevoegd
- ✅ Bevestigingsdialoog voor beide acties
- ✅ Geschreven uren worden nooit aangeraakt
- ✅ Clean architecture: business logic in use case, niet in component

**Mogelijke issues:**
- `useEffect` in WeekPage voor het laden van weekLlmCounts mist `domainHistoryStore` in dependencies (is een module-level singleton, geen probleem)
- `createClearWeekBlocksUseCase` wordt ook gebruikt in de `onSuccess` callback van `useClearWeekBlocks` om counts te herladen — dat is iets repetitief. Maar YAGNI: herextractie is nu niet nodig.
