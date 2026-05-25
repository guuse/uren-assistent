# Dag-selectie via maand-overzicht popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een kalenderknop toe aan de week-navigatiebalk waarmee de gebruiker via een maand-overzicht popup snel naar een dag ver in het verleden kan navigeren.

**Architecture:** Nieuw `MonthPickerPopup` component met eigen maand-state, `goToDate()` functie in `useWeek`, kalenderknop in `WeekDayList` met lokale open/dicht state, wiring in `WeekPage`.

**Tech Stack:** React, TypeScript strict, Tailwind CSS, lucide-react (CalendarDays icoon), Vitest

---

## Bestandsoverzicht

| Bestand | Wijziging |
|---|---|
| `src/ui/components/MonthPickerPopup.tsx` | Nieuw — maand-kalender popup component |
| `src/ui/hooks/useWeek.ts` | Uitbreiden — `goToDate(date)` functie toevoegen |
| `src/ui/components/WeekDayList.tsx` | Uitbreiden — kalenderknop + `onGoToDate` prop + popup renderen |
| `src/ui/pages/WeekPage.tsx` | Uitbreiden — `week.goToDate` doorgeven als `onGoToDate` |

---

### Task 1: Voeg `goToDate` toe aan `useWeek`

**Files:**
- Modify: `src/ui/hooks/useWeek.ts`
- Modify: `src/ui/hooks/useWeek.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

Voeg toe aan `src/ui/hooks/useWeek.test.ts` (na de bestaande 4 tests):

```typescript
describe('goToDate', () => {
  it('zet selectedDate op de opgegeven datum', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.goToDate('2024-05-08') })
    expect(result.current.selectedDate).toBe('2024-05-08')
  })

  it('zet selectedWeekStart op de maandag van de opgegeven datum', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.goToDate('2024-05-08') }) // woensdag
    expect(result.current.selectedWeekStart).toBe('2024-05-06') // maandag
  })

  it('zet selectedWeekStart correct voor een maandag', () => {
    const { result } = renderHook(() => useWeek())
    act(() => { result.current.goToDate('2024-05-06') }) // maandag
    expect(result.current.selectedWeekStart).toBe('2024-05-06')
  })
})
```

- [ ] **Stap 2: Draai de tests — verwacht FAIL**

```bash
npm run test -- src/ui/hooks/useWeek.test.ts
```

Verwacht: FAIL — `goToDate` bestaat niet.

- [ ] **Stap 3: Implementeer `goToDate` in `useWeek.ts`**

Voeg toe na `goToCurrentWeek` (na regel 82 in het huidige bestand):

```typescript
function goToDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  setSelectedWeekStart(getMondayOf(new Date(year!, month! - 1, day!)))
  setSelectedDate(date)
}
```

Voeg toe aan de return object (na `goToCurrentWeek,`):

```typescript
goToDate,
```

- [ ] **Stap 4: Draai de tests — verwacht PASS**

```bash
npm run test -- src/ui/hooks/useWeek.test.ts
```

Verwacht: alle 7 tests PASS.

- [ ] **Stap 5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 6: Commit**

```bash
git add src/ui/hooks/useWeek.ts src/ui/hooks/useWeek.test.ts
git commit -m "feat: add goToDate to useWeek hook"
```

---

### Task 2: Bouw `MonthPickerPopup` component

**Files:**
- Create: `src/ui/components/MonthPickerPopup.tsx`

- [ ] **Stap 1: Schrijf het component**

Maak `src/ui/components/MonthPickerPopup.tsx` aan met deze volledige inhoud:

```typescript
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  initialMonth: string  // YYYY-MM-DD van de eerste dag van de startmaand
  onSelectDate: (date: string) => void
  onClose: () => void
}

const MAAND_NAMEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

const DAG_HEADERS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

function firstOfMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  return `${year}-${String(month!).padStart(2, '0')}-01`
}

function prevMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, 1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function nextMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, 1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function buildCalendarDays(monthStart: string): Array<{ date: string; isWeekend: boolean } | null> {
  const [year, month] = monthStart.split('-').map(Number)
  const firstDay = new Date(year!, month! - 1, 1)
  // Dag van de week: 0=zo, 1=ma ... 6=za. We willen ma=0.
  const startOffset = (firstDay.getDay() + 6) % 7  // ma=0, di=1, ..., zo=6
  const daysInMonth = new Date(year!, month!, 0).getDate()

  const cells: Array<{ date: string; isWeekend: boolean } | null> = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month!).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(year!, month! - 1, d).getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    cells.push({ date, isWeekend })
  }
  return cells
}

export function MonthPickerPopup({ initialMonth, onSelectDate, onClose }: Props) {
  const [viewMonth, setViewMonth] = useState<string>(() => firstOfMonth(initialMonth))

  const [year, month] = viewMonth.split('-').map(Number)
  const maandNaam = MAAND_NAMEN[month! - 1]
  const days = buildCalendarDays(viewMonth)

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Popup */}
      <div className="absolute bottom-8 left-0 z-50 bg-[#1e1b18] border border-[#3a3530] rounded-lg shadow-xl p-3 w-52">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setViewMonth(prevMonth(viewMonth))}
            className="text-[#4a4540] hover:text-[#e8e2d9] transition-colors cursor-pointer p-0.5"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[#e8e2d9] text-xs font-medium">
            {maandNaam} {year}
          </span>
          <button
            onClick={() => setViewMonth(nextMonth(viewMonth))}
            className="text-[#4a4540] hover:text-[#e8e2d9] transition-colors cursor-pointer p-0.5"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Dagheaders */}
        <div className="grid grid-cols-7 mb-1">
          {DAG_HEADERS.map((h) => (
            <div key={h} className="text-center text-[0.5rem] text-[#4a4540] uppercase">
              {h}
            </div>
          ))}
        </div>

        {/* Dagen */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />
            return (
              <button
                key={cell.date}
                disabled={cell.isWeekend}
                onClick={() => onSelectDate(cell.date)}
                className={[
                  'text-center text-[0.6rem] py-0.5 rounded transition-colors',
                  cell.isWeekend
                    ? 'text-[#3a3530] cursor-default'
                    : 'text-[#c8c2b9] hover:bg-[#3a6b5a] hover:text-white cursor-pointer',
                ].join(' ')}
              >
                {Number(cell.date.split('-')[2])}
              </button>
            )
          })}
        </div>
      </div>
    </>
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
git add src/ui/components/MonthPickerPopup.tsx
git commit -m "feat: add MonthPickerPopup component"
```

---

### Task 3: Voeg kalenderknop en popup toe aan `WeekDayList`

**Files:**
- Modify: `src/ui/components/WeekDayList.tsx`

- [ ] **Stap 1: Voeg `CalendarDays` import toe en nieuwe prop**

Vervang de bestaande import-regel bovenaan:

```typescript
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
```

Door:

```typescript
import { useState } from 'react'
import { Trash2, CalendarDays } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import { MonthPickerPopup } from './MonthPickerPopup'
```

- [ ] **Stap 2: Voeg `onGoToDate` toe aan de Props interface**

Voeg toe aan de `Props` interface (na `onGoToCurrentWeek?`):

```typescript
onGoToDate?: (date: string) => void
```

- [ ] **Stap 3: Destructureer de nieuwe prop**

Voeg toe aan de destructuring van `WeekDayList` (na `onGoToCurrentWeek`):

```typescript
onGoToDate,
```

- [ ] **Stap 4: Voeg `isPickerOpen` state toe**

Voeg toe aan de bestaande `useState` declaraties in de functie-body (na de `confirmWeek` state):

```typescript
const [isPickerOpen, setIsPickerOpen] = useState(false)
```

- [ ] **Stap 5: Vervang de navigatiebalk door de versie met kalenderknop**

Vervang de bestaande navigatiebalk (de `<div className="flex justify-between items-center px-1 mt-2">` sectie):

```tsx
<div className="relative">
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
        className="bg-[#3a6b5a] hover:bg-[#4a7a6a] text-white text-[0.6rem] font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
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
  {onGoToDate && (
    <button
      onClick={() => setIsPickerOpen((v) => !v)}
      className="absolute -top-0.5 right-1 text-[#4a4540] hover:text-[#e8e2d9] transition-colors cursor-pointer"
      title="Kies een dag"
    >
      <CalendarDays size={12} />
    </button>
  )}
  {isPickerOpen && onGoToDate && (
    <MonthPickerPopup
      initialMonth={weekDays[0]!}
      onSelectDate={(date) => {
        onGoToDate(date)
        setIsPickerOpen(false)
      }}
      onClose={() => setIsPickerOpen(false)}
    />
  )}
</div>
```

- [ ] **Stap 6: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 7: Commit**

```bash
git add src/ui/components/WeekDayList.tsx
git commit -m "feat: add calendar button and MonthPickerPopup to WeekDayList"
```

---

### Task 4: Wire `goToDate` door in `WeekPage`

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

- [ ] **Stap 1: Zoek de `WeekDayList` aanroep**

```bash
grep -n "WeekDayList\|onGoToDate" src/ui/pages/WeekPage.tsx
```

- [ ] **Stap 2: Voeg `onGoToDate` prop toe**

Voeg toe aan de JSX props van `<WeekDayList ...>` (na `onGoToCurrentWeek`):

```tsx
onGoToDate={week.goToDate}
```

- [ ] **Stap 3: Typecheck en tests**

```bash
npm run typecheck && npm run test
```

Verwacht: geen fouten, alle tests PASS.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/pages/WeekPage.tsx
git commit -m "feat: wire goToDate into WeekPage"
```

---

### Task 5: Handmatige smoke test

- [ ] **Start de dev app**

```bash
make run
```

- [ ] **Controleer: kalenderknop zichtbaar**

Rechtsbovenin de navigatiebalk zie je een klein kalender-icoon.

- [ ] **Klik op kalenderknop**

Popup verschijnt met de maand van de huidige week.

- [ ] **Navigeer naar een maand ver in het verleden**

Klik meerdere keren op `‹`. Popup toont de correcte maand + jaar.

- [ ] **Klik op een werkdag**

Popup sluit, app toont de week van die dag, die dag is geselecteerd.

- [ ] **Klik op een weekenddag**

Geen actie — dag is grijs en niet-klikbaar.

- [ ] **Klik buiten de popup**

Popup sluit, selectie ongewijzigd.
