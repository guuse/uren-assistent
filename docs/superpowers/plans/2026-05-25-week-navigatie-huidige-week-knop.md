# Week navigatie — "Huidige week" knop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een "Nu" knop toe aan de week-navigatiebalk die alleen zichtbaar is wanneer de gebruiker niet op de huidige week zit, en bij klik teruggaat naar de huidige week met maandag geselecteerd.

**Architecture:** Uitbreiding van de bestaande `useWeek` hook met `isCurrentWeek` en `goToCurrentWeek`, doorgegeven als props aan `WeekDayList`, conditioneel gerenderd tussen de bestaande `‹` en `›` knoppen.

**Tech Stack:** React, TypeScript strict, Tailwind CSS (Vitest voor tests)

---

### Task 1: Voeg `isCurrentWeek` en `goToCurrentWeek` toe aan `useWeek`

**Files:**
- Modify: `src/ui/hooks/useWeek.ts`
- Test: `src/ui/hooks/useWeek.test.ts` (nieuw)

- [ ] **Stap 1: Schrijf de falende tests**

Maak `src/ui/hooks/useWeek.test.ts` aan:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWeek } from './useWeek'

// Mock Tauri IPC en dependencies
vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(() => 'employee-1'),
}))
vi.mock('../../application/container', () => ({
  keychainRepo: { get: vi.fn().mockResolvedValue('key') },
  createSimplicateRepository: vi.fn(),
  createUseCases: vi.fn(() => ({
    getWeekEntries: { execute: vi.fn().mockResolvedValue({}) },
  })),
}))

describe('useWeek', () => {
  it('isCurrentWeek is true wanneer selectedWeekStart de maandag van deze week is', () => {
    const { result } = renderHook(() => useWeek())
    expect(result.current.isCurrentWeek).toBe(true)
  })

  it('isCurrentWeek is false na prevWeek()', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.prevWeek() })
    expect(result.current.isCurrentWeek).toBe(false)
  })

  it('goToCurrentWeek reset selectedWeekStart naar maandag van huidige week', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.prevWeek() })
    expect(result.current.isCurrentWeek).toBe(false)
    act(() => { result.current.goToCurrentWeek() })
    expect(result.current.isCurrentWeek).toBe(true)
  })

  it('goToCurrentWeek zet selectedDate op maandag van huidige week', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.prevWeek() })
    act(() => { result.current.goToCurrentWeek() })
    expect(result.current.selectedDate).toBe(result.current.selectedWeekStart)
  })
})
```

- [ ] **Stap 2: Draai de tests — verwacht FAIL**

```bash
npm run test -- src/ui/hooks/useWeek.test.ts
```

Verwacht: FAIL — `isCurrentWeek` en `goToCurrentWeek` bestaan niet.

- [ ] **Stap 3: Implementeer `isCurrentWeek` en `goToCurrentWeek` in `useWeek.ts`**

Voeg toe in `src/ui/hooks/useWeek.ts` na de `nextWeek` functie (na regel 73):

```typescript
const isCurrentWeek = selectedWeekStart === getMondayOf(new Date())

function goToCurrentWeek() {
  const monday = getMondayOf(new Date())
  setSelectedWeekStart(monday)
  setSelectedDate(monday)
}
```

Voeg ook toe aan de return object (na `nextWeek,` op regel 93):

```typescript
isCurrentWeek,
goToCurrentWeek,
```

- [ ] **Stap 4: Draai de tests — verwacht PASS**

```bash
npm run test -- src/ui/hooks/useWeek.test.ts
```

Verwacht: alle 4 tests PASS.

- [ ] **Stap 5: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 6: Commit**

```bash
git add src/ui/hooks/useWeek.ts src/ui/hooks/useWeek.test.ts
git commit -m "feat: add isCurrentWeek and goToCurrentWeek to useWeek hook"
```

---

### Task 2: Voeg props toe aan `WeekDayList` en render de "Nu" knop

**Files:**
- Modify: `src/ui/components/WeekDayList.tsx`

- [ ] **Stap 1: Voeg de twee nieuwe props toe aan de `Props` interface**

In `src/ui/components/WeekDayList.tsx`, voeg toe aan de `Props` interface (na regel 31, vóór de sluitende `}`):

```typescript
isCurrentWeek?: boolean
onGoToCurrentWeek?: () => void
```

- [ ] **Stap 2: Destructureer de nieuwe props in de functiesignatuur**

In de `WeekDayList` functiedefinitie (rond regel 46), voeg toe aan de destructuring:

```typescript
isCurrentWeek = true,
onGoToCurrentWeek,
```

- [ ] **Stap 3: Vervang de navigatiebalk door de versie met conditionele "Nu" knop**

Vervang de bestaande navigatiebalk (regels 190–204):

```tsx
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
```

Door:

```tsx
<div className="flex justify-between items-center px-1 mt-2">
  <button
    onClick={onPrevWeek}
    className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
  >
    ‹
  </button>
  {!isCurrentWeek && onGoToCurrentWeek ? (
    <button
      onClick={onGoToCurrentWeek}
      className="bg-[#3a6b5a] hover:bg-[#4a7a6a] text-white text-[0.6rem] font-bold px-2 py-0.5 rounded transition-colors cursor-pointer"
    >
      Nu
    </button>
  ) : (
    <span className="text-[#4a4540] text-[0.5rem]">{weekLabel}</span>
  )}
  <button
    onClick={onNextWeek}
    className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
  >
    ›
  </button>
</div>
```

- [ ] **Stap 4: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 5: Commit**

```bash
git add src/ui/components/WeekDayList.tsx
git commit -m "feat: add conditional Nu button to WeekDayList nav bar"
```

---

### Task 3: Wires props door in `WeekPage`

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

- [ ] **Stap 1: Zoek de `WeekDayList` aanroep in `WeekPage.tsx`**

Gebruik grep om de exacte locatie te vinden:

```bash
grep -n "WeekDayList" src/ui/pages/WeekPage.tsx
```

- [ ] **Stap 2: Voeg de twee nieuwe props toe aan de `WeekDayList` aanroep**

Voeg toe aan de JSX props van `<WeekDayList ...>`:

```tsx
isCurrentWeek={week.isCurrentWeek}
onGoToCurrentWeek={week.goToCurrentWeek}
```

- [ ] **Stap 3: Typecheck en tests**

```bash
npm run typecheck && npm run test
```

Verwacht: geen fouten, alle tests PASS.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/pages/WeekPage.tsx
git commit -m "feat: wire isCurrentWeek and goToCurrentWeek into WeekPage"
```

---

### Task 4: Handmatige smoke test

- [ ] **Start de dev app**

```bash
make run
```

- [ ] **Controleer: op huidige week — geen "Nu" knop**

Controleer dat de navigatiebalk `‹ week 21 ›` toont (zonder "Nu" knop).

- [ ] **Navigeer naar vorige week**

Klik op `‹`. Controleer dat de "Nu" knop verschijnt tussen `‹` en `›`.

- [ ] **Klik op "Nu"**

Controleer dat de app terugspringt naar de huidige week en maandag geselecteerd is.

- [ ] **Controleer dat "Nu" knop weer verdwijnt**

Na terugkeer naar huidige week: geen "Nu" knop zichtbaar.
