# LLM Blokken Opschonen — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een prullenbak-icoon toe per dag in de WeekDayList sidebar waarmee de gebruiker alle ongebookte LLM-conceptblokken van die dag kan verwijderen, met een bevestigingsdialoog.

**Architecture:** Nieuwe `ClearDayBlocksUseCase` in de domain layer haalt ongebookte LLM-blokken op uit `IHistoryStore` en verwijdert ze één voor één. Een nieuwe `useClearDayBlocks` hook wikkelt de use case in. `WeekDayList` krijgt een prullenbak-icoon per dag dat rood/actief is als er ongebookte LLM-blokken zijn, en dat een `ConfirmDialog` opent voor bevestiging.

**Tech Stack:** TypeScript strict, React, Zustand, Lucide icons, Tailwind CSS, Vitest

---

## Bestandsoverzicht

| Actie | Bestand | Verantwoordelijkheid |
|---|---|---|
| Nieuw | `src/domain/usecases/ClearDayBlocksUseCase.ts` | Filtert en verwijdert ongebookte LLM-blokken |
| Nieuw | `src/domain/usecases/ClearDayBlocksUseCase.test.ts` | Unit tests voor de use case |
| Nieuw | `src/ui/hooks/useClearDayBlocks.ts` | React hook die de use case aanroept |
| Nieuw | `src/ui/components/ConfirmDialog.tsx` | Herbruikbare bevestigingsdialoog |
| Gewijzigd | `src/ui/components/WeekDayList.tsx` | Prullenbak-icoon per dag + dialoog state |
| Gewijzigd | `src/application/container.ts` | Factory functie voor de use case |

> `IHistoryStore` heeft al `removeBlock(date, urlPattern)` — geen wijzigingen nodig aan de interface.  
> `ClassifiedBlock` heeft `origin` maar geen `bookedAt`. Ongebookt = blokken die aanwezig zijn in de store (na boeken worden blokken verwijderd via `removeBlock`).

---

## Task 1: ClearDayBlocksUseCase (TDD)

**Files:**
- Create: `src/domain/usecases/ClearDayBlocksUseCase.ts`
- Create: `src/domain/usecases/ClearDayBlocksUseCase.test.ts`

- [ ] **Stap 1: Schrijf de failing tests**

Maak `src/domain/usecases/ClearDayBlocksUseCase.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClearDayBlocksUseCase } from './ClearDayBlocksUseCase'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'

function makeBlock(overrides: Partial<ClassifiedBlock>): ClassifiedBlock {
  return {
    urlPattern: 'test-pattern',
    title: 'Test',
    visitCount: 1,
    timeRange: { start: '09:00', end: '10:00' },
    blockName: 'Test blok',
    summary: 'samenvatting',
    startTime: '09:00',
    endTime: '10:00',
    confidence: 3,
    origin: 'llm',
    ...overrides,
  }
}

describe('ClearDayBlocksUseCase', () => {
  let historyStore: IHistoryStore
  let useCase: ClearDayBlocksUseCase

  beforeEach(() => {
    historyStore = {
      load: vi.fn().mockResolvedValue(undefined),
      getBlocksForDate: vi.fn(),
      setBlocksForDate: vi.fn().mockResolvedValue(undefined),
      removeBlock: vi.fn().mockResolvedValue(undefined),
      hasDataForDate: vi.fn(),
      hasHistoryForWeek: vi.fn(),
    }
    useCase = new ClearDayBlocksUseCase(historyStore)
  })

  it('verwijdert llm-blokken', async () => {
    const blocks = [
      makeBlock({ urlPattern: 'a', origin: 'llm' }),
      makeBlock({ urlPattern: 'b', origin: 'llm-pattern' }),
    ]
    vi.mocked(historyStore.getBlocksForDate).mockResolvedValue(blocks)

    const result = await useCase.execute('2026-05-27')

    expect(historyStore.removeBlock).toHaveBeenCalledWith('2026-05-27', 'a')
    expect(historyStore.removeBlock).toHaveBeenCalledWith('2026-05-27', 'b')
    expect(result.removedCount).toBe(2)
  })

  it('laat calendar-blokken ongemoeid', async () => {
    const blocks = [
      makeBlock({ urlPattern: 'c', origin: 'calendar' }),
      makeBlock({ urlPattern: 'd', origin: 'manual' }),
      makeBlock({ urlPattern: 'e', origin: 'cache' }),
    ]
    vi.mocked(historyStore.getBlocksForDate).mockResolvedValue(blocks)

    const result = await useCase.execute('2026-05-27')

    expect(historyStore.removeBlock).not.toHaveBeenCalled()
    expect(result.removedCount).toBe(0)
  })

  it('geeft 0 terug als er geen blokken zijn', async () => {
    vi.mocked(historyStore.getBlocksForDate).mockResolvedValue([])

    const result = await useCase.execute('2026-05-27')

    expect(result.removedCount).toBe(0)
  })

  it('verwijdert llm en llm-pattern maar laat andere origins staan', async () => {
    const blocks = [
      makeBlock({ urlPattern: 'llm-1', origin: 'llm' }),
      makeBlock({ urlPattern: 'calendar-1', origin: 'calendar' }),
      makeBlock({ urlPattern: 'pattern-1', origin: 'llm-pattern' }),
    ]
    vi.mocked(historyStore.getBlocksForDate).mockResolvedValue(blocks)

    const result = await useCase.execute('2026-05-27')

    expect(historyStore.removeBlock).toHaveBeenCalledTimes(2)
    expect(historyStore.removeBlock).toHaveBeenCalledWith('2026-05-27', 'llm-1')
    expect(historyStore.removeBlock).toHaveBeenCalledWith('2026-05-27', 'pattern-1')
    expect(result.removedCount).toBe(2)
  })
})
```

- [ ] **Stap 2: Draai tests — verwacht FAIL**

```bash
npm run test -- ClearDayBlocksUseCase
```

Verwacht: `Cannot find module './ClearDayBlocksUseCase'`

- [ ] **Stap 3: Implementeer de use case**

Maak `src/domain/usecases/ClearDayBlocksUseCase.ts`:

```typescript
import type { IHistoryStore } from '../repositories/IHistoryStore'

export interface ClearDayBlocksResult {
  removedCount: number
}

export class ClearDayBlocksUseCase {
  constructor(private readonly historyStore: IHistoryStore) {}

  async execute(date: string): Promise<ClearDayBlocksResult> {
    const blocks = await this.historyStore.getBlocksForDate(date)
    const llmBlocks = blocks.filter(
      (b) => b.origin === 'llm' || b.origin === 'llm-pattern',
    )
    for (const block of llmBlocks) {
      await this.historyStore.removeBlock(date, block.urlPattern)
    }
    return { removedCount: llmBlocks.length }
  }
}
```

- [ ] **Stap 4: Draai tests — verwacht PASS**

```bash
npm run test -- ClearDayBlocksUseCase
```

Verwacht: 4 tests PASS

- [ ] **Stap 5: Commit**

```bash
git add src/domain/usecases/ClearDayBlocksUseCase.ts src/domain/usecases/ClearDayBlocksUseCase.test.ts
git commit -m "feat: add ClearDayBlocksUseCase with tests"
```

---

## Task 2: Container registratie

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Stap 1: Voeg factory functie toe aan container**

Open `src/application/container.ts`. Voeg bovenaan de imports toe:

```typescript
import { ClearDayBlocksUseCase } from '../domain/usecases/ClearDayBlocksUseCase'
```

Voeg onderaan het bestand (na de `createProcessDayUseCase` functie) toe:

```typescript
export function createClearDayBlocksUseCase(): ClearDayBlocksUseCase {
  return new ClearDayBlocksUseCase(historyStore)
}
```

- [ ] **Stap 2: Controleer typecheck**

```bash
npm run typecheck
```

Verwacht: geen errors

- [ ] **Stap 3: Commit**

```bash
git add src/application/container.ts
git commit -m "feat: register ClearDayBlocksUseCase in container"
```

---

## Task 3: ConfirmDialog component

**Files:**
- Create: `src/ui/components/ConfirmDialog.tsx`

- [ ] **Stap 1: Maak de component**

Maak `src/ui/components/ConfirmDialog.tsx`:

```tsx
interface Props {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Verwijderen',
  cancelLabel = 'Annuleren',
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />
      <div className="relative z-10 bg-[#1e1b18] border border-[#2e2a26] rounded-xl p-6 w-80 shadow-xl">
        <h2 className="text-[#e8e2d9] font-semibold text-sm mb-2">{title}</h2>
        <p className="text-[#7a7268] text-xs mb-5">{description}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#2e2a26] text-[#7a7268] hover:text-[#e8e2d9] hover:border-[#4a4540] transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {isLoading ? 'Bezig...' : confirmLabel}
          </button>
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

Verwacht: geen errors

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/ConfirmDialog.tsx
git commit -m "feat: add ConfirmDialog component"
```

---

## Task 4: useClearDayBlocks hook

**Files:**
- Create: `src/ui/hooks/useClearDayBlocks.ts`

- [ ] **Stap 1: Maak de hook**

Maak `src/ui/hooks/useClearDayBlocks.ts`:

```typescript
import { useState, useCallback } from 'react'
import { createClearDayBlocksUseCase } from '../../application/container'

export function useClearDayBlocks(onSuccess: (date: string) => void) {
  const [isClearing, setIsClearing] = useState(false)

  const clearDay = useCallback(async (date: string) => {
    setIsClearing(true)
    try {
      const useCase = createClearDayBlocksUseCase()
      await useCase.execute(date)
      onSuccess(date)
    } finally {
      setIsClearing(false)
    }
  }, [onSuccess])

  return { clearDay, isClearing }
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen errors

- [ ] **Stap 3: Commit**

```bash
git add src/ui/hooks/useClearDayBlocks.ts
git commit -m "feat: add useClearDayBlocks hook"
```

---

## Task 5: WeekDayList — prullenbak-icoon en dialoog

**Files:**
- Modify: `src/ui/components/WeekDayList.tsx`

Dit is de grootste wijziging. De component krijgt:
1. Een nieuwe optionele prop `onClearDayBlocks?: (date: string) => Promise<void>`
2. Een nieuwe optionele prop `llmBlockCountForDate?: (date: string) => number`
3. State voor de confirm-dialoog
4. Prullenbak-icoon per dag (Lucide `Trash2`)

- [ ] **Stap 1: Voeg imports toe**

Open `src/ui/components/WeekDayList.tsx`. Voeg bovenaan toe:

```tsx
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
```

> Controleer of `lucide-react` al in `package.json` staat (andere componenten gebruiken het waarschijnlijk al). Als niet: `npm install lucide-react`.

- [ ] **Stap 2: Breid Props interface uit**

Voeg aan de `interface Props` toe:

```tsx
  llmBlockCountForDate?: (date: string) => number
  onClearDayBlocks?: (date: string) => Promise<void>
  isClearingDay?: boolean
```

- [ ] **Stap 3: Voeg dialoog state toe**

Voeg na de destructuring van props toe:

```tsx
  const [confirmDate, setConfirmDate] = useState<string | null>(null)
```

- [ ] **Stap 4: Voeg prullenbak toe aan dag-rij**

Zoek in de component de `<button key={date} ...>` rij. Voeg vlak voor de sluitende `</button>` een prullenbak-sectie toe. Voeg ook `llmBlockCountForDate` en `onClearDayBlocks` toe aan de destructuring.

Voeg in de `.map()` callback toe:

```tsx
          const llmCount = llmBlockCountForDate?.(date) ?? 0
          const canClear = llmCount > 0 && !!onClearDayBlocks
```

En voeg binnen de `<button key={date}>` onderaan toe (na het `conceptCount` badge):

```tsx
              {onClearDayBlocks && (
                <div className="mt-1 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (canClear) setConfirmDate(date)
                    }}
                    disabled={!canClear}
                    title={canClear ? `${llmCount} LLM-blok${llmCount !== 1 ? 'ken' : ''} verwijderen` : 'Geen LLM-blokken'}
                    className={`p-0.5 rounded transition-colors ${
                      canClear
                        ? 'text-red-500 hover:text-red-400 cursor-pointer'
                        : 'text-[#2e2a26] cursor-default'
                    }`}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
```

- [ ] **Stap 5: Voeg ConfirmDialog toe**

Voeg vóór de afsluitende `</div>` van de hele component toe:

```tsx
      {confirmDate && onClearDayBlocks && (
        <ConfirmDialog
          title="LLM-blokken verwijderen?"
          description={`${llmBlockCountForDate?.(confirmDate) ?? 0} ongebookte LLM-concept${(llmBlockCountForDate?.(confirmDate) ?? 0) !== 1 ? 'en' : ''} van deze dag worden verwijderd. Geschreven uren blijven staan.`}
          isLoading={isClearingDay}
          onConfirm={async () => {
            await onClearDayBlocks(confirmDate)
            setConfirmDate(null)
          }}
          onCancel={() => setConfirmDate(null)}
        />
      )}
```

- [ ] **Stap 6: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen errors

- [ ] **Stap 7: Commit**

```bash
git add src/ui/components/WeekDayList.tsx
git commit -m "feat: add clear LLM blocks button to WeekDayList"
```

---

## Task 6: WeekPage — koppel alles

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

De `WeekPage` moet de hook aanroepen en de props doorgeven aan `WeekDayList`. Eerst de bestaande structuur inspecteren.

- [ ] **Stap 1: Inspecteer WeekPage**

Lees `src/ui/pages/WeekPage.tsx` volledig. Let op:
- Hoe `conceptCountForDate` berekend wordt (waarschijnlijk via `useHistoryStore` of een eigen berekening)
- Hoe `onProcessWeek` en andere callbacks doorgegeven worden
- Hoe de week-data refreshed wordt na een actie (patroon van `useWeek` of `useHistoryStore`)

- [ ] **Stap 2: Voeg hook en state toe**

Voeg imports toe bovenaan `WeekPage.tsx`:

```tsx
import { useClearDayBlocks } from '../hooks/useClearDayBlocks'
```

Voeg in de component body toe (na bestaande hooks):

```tsx
  const { clearDay, isClearing } = useClearDayBlocks((clearedDate) => {
    // Trigger reload van de history store voor deze datum
    // Gebruik het bestaande reload-patroon van de pagina
    void reloadDay(clearedDate)  // vervang 'reloadDay' met de daadwerkelijke functie
  })

  const llmBlockCountForDate = useCallback((date: string): number => {
    // Haal blocks op uit de bestaande state — pas aan op basis van wat WeekPage al bijhoudt
    // Typisch: blocks gefilterd op origin llm/llm-pattern tellen
    return blocksForDate(date).filter(
      (b) => b.origin === 'llm' || b.origin === 'llm-pattern'
    ).length
  }, [blocksForDate])  // vervang 'blocksForDate' met de daadwerkelijke functie/state
```

> **Noot voor implementeerder:** De exacte namen van functies/state in WeekPage zijn afhankelijk van de huidige implementatie. Lees de file eerst, pas de namen aan.

- [ ] **Stap 3: Koppel props aan WeekDayList**

Zoek de `<WeekDayList ... />` aanroep en voeg toe:

```tsx
          llmBlockCountForDate={llmBlockCountForDate}
          onClearDayBlocks={clearDay}
          isClearingDay={isClearing}
```

- [ ] **Stap 4: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen errors

- [ ] **Stap 5: Commit**

```bash
git add src/ui/pages/WeekPage.tsx
git commit -m "feat: wire clear day blocks into WeekPage"
```

---

## Task 7: Handmatig testen

- [ ] **Stap 1: Start de app**

```bash
npm run tauri dev
```

- [ ] **Stap 2: Test het volledige pad**

1. Ga naar een week met verwerkte dagen (met LLM-concepten)
2. Controleer: prullenbak-icoon is rood voor dagen met ongebookte LLM-blokken
3. Controleer: prullenbak-icoon is grijs voor dagen zonder LLM-blokken
4. Klik het rode prullenbak-icoon
5. Controleer: bevestigingsdialoog verschijnt met correct aantal blokken
6. Klik "Annuleren" — dialoog sluit, niets veranderd
7. Klik het icoon opnieuw, klik "Verwijderen"
8. Controleer: dag-status reset naar "niet verwerkt" in de sidebar
9. Controleer: de DayTimeline toont geen LLM-concepten meer voor die dag
10. Controleer: eerder geboekte uren in Simplicate zijn onaangetast

- [ ] **Stap 3: Final commit als alles werkt**

```bash
git add -A
git commit -m "feat: LLM blokken opschonen per dag — volledig geïmplementeerd"
```
