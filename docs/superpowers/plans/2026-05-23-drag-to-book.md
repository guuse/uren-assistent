# Drag-to-Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gebruiker kan verticaal slepen over lege ruimte in de dagkalender om een tijdslot te selecteren; loslaten opent BookingModal met start/eindtijd vooringevuld.

**Architecture:** Een nieuwe `DragOverlay` component zit als absoluut-gepositioneerde overlay over de blokkenkolom in `DayTimeline`. De overlay vangt muisgebeurtenissen op lege ruimte af, berekent tijden (snapt naar 30 min), toont een preview-blok en roept `onDragComplete` aan bij loslaten. `DayTimeline` krijgt een nieuwe prop `onDragNew`; `WeekPage` handelt die af door `bookingEntry` te zetten.

**Tech Stack:** React 18, TypeScript strict (`exactOptionalPropertyTypes: true`), Tailwind CSS, Vitest

---

## File Map

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `src/ui/components/DragOverlay.tsx` | Create | Drag-interactie, preview-blok, snapping |
| `src/ui/components/DragOverlay.test.ts` | Create | Unit tests voor snap/pixel-logica |
| `src/ui/components/DayTimeline.tsx` | Modify | Blokkenkolom: `position:relative` wrapper + `DragOverlay` + `onDragNew` prop |
| `src/ui/pages/WeekPage.tsx` | Modify | `handleDragNew` handler + doorgeven aan `DayTimeline` |

`BookingModal`, `useBooking`, domain/application layer: **geen wijzigingen**.

---

## Constanten (referentie voor alle taken)

```ts
DAY_START_HOUR = 8        // 08:00
DAY_END_HOUR   = 18       // 18:00
TOTAL_MINUTES  = 600      // 10 uur × 60
HOUR_HEIGHT_PX = 80       // pixels per uur in DayTimeline
SNAP_MINUTES   = 30
MIN_DURATION   = 30       // minuten
```

---

## Task 1: DragOverlay — pure logica (geen React)

**Files:**
- Create: `src/ui/components/DragOverlay.tsx`
- Create: `src/ui/components/DragOverlay.test.ts`

### Stap 1.1 — Schrijf de failing tests

Maak `src/ui/components/DragOverlay.test.ts` aan:

```ts
import { describe, it, expect } from 'vitest'
import { pixelToMinutes, snapToInterval, minutesToTime, swapIfNeeded } from './DragOverlay'

describe('pixelToMinutes', () => {
  // totalHeight = 800px (10 uur × 80px), dayStartMinutes = 480 (08:00)
  it('converteert 0px naar 480 min (08:00)', () => {
    expect(pixelToMinutes(0, 800, 480)).toBe(480)
  })
  it('converteert 800px naar 1080 min (18:00)', () => {
    expect(pixelToMinutes(800, 800, 480)).toBe(1080)
  })
  it('converteert 400px naar 780 min (13:00)', () => {
    expect(pixelToMinutes(400, 800, 480)).toBe(780)
  })
})

describe('snapToInterval', () => {
  it('snapt 495 min naar 480 (08:00 bij 30-min interval)', () => {
    expect(snapToInterval(495, 30)).toBe(480)
  })
  it('snapt 510 min naar 510 (08:30)', () => {
    expect(snapToInterval(510, 30)).toBe(510)
  })
  it('snapt 525 min naar 540 (09:00)', () => {
    expect(snapToInterval(525, 30)).toBe(540)
  })
})

describe('minutesToTime', () => {
  it('converteert 480 naar "08:00"', () => {
    expect(minutesToTime(480)).toBe('08:00')
  })
  it('converteert 570 naar "09:30"', () => {
    expect(minutesToTime(570)).toBe('09:30')
  })
  it('converteert 780 naar "13:00"', () => {
    expect(minutesToTime(780)).toBe('13:00')
  })
})

describe('swapIfNeeded', () => {
  it('swappt als end < start', () => {
    expect(swapIfNeeded(600, 540)).toEqual({ start: 540, end: 600 })
  })
  it('laat ongewijzigd als start < end', () => {
    expect(swapIfNeeded(540, 600)).toEqual({ start: 540, end: 600 })
  })
  it('laat ongewijzigd als start === end', () => {
    expect(swapIfNeeded(540, 540)).toEqual({ start: 540, end: 540 })
  })
})
```

- [ ] Schrijf bovenstaande tests naar `src/ui/components/DragOverlay.test.ts`

### Stap 1.2 — Verifieer dat de tests falen

```bash
cd /Users/guus/projects/uren-schrijven && npm run test -- DragOverlay.test
```

Verwacht: FAIL — `pixelToMinutes is not a function` (of vergelijkbaar)

- [ ] Draai de tests en bevestig dat ze falen

### Stap 1.3 — Implementeer de hulpfuncties + component

Maak `src/ui/components/DragOverlay.tsx` aan:

```tsx
import { useState, useRef, useEffect } from 'react'

// ─── Pure helpers (geëxporteerd voor tests) ───────────────────────────────────

export function pixelToMinutes(
  pixelY: number,
  totalHeightPx: number,
  dayStartMinutes: number,
): number {
  const totalMinutes = 600 // 08:00–18:00
  return dayStartMinutes + (pixelY / totalHeightPx) * totalMinutes
}

export function snapToInterval(minutes: number, snapMinutes: number): number {
  return Math.round(minutes / snapMinutes) * snapMinutes
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function swapIfNeeded(
  start: number,
  end: number,
): { start: number; end: number } {
  return start <= end ? { start, end } : { start: end, end: start }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DragState {
  startMin: number
  endMin: number
}

interface Props {
  totalHeightPx: number
  dayStartMinutes: number
  snapMinutes: number
  minDurationMinutes: number
  onDragComplete: (startTime: string, endTime: string) => void
}

export function DragOverlay({
  totalHeightPx,
  dayStartMinutes,
  snapMinutes,
  minDurationMinutes,
  onDragComplete,
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function getMinutes(e: React.MouseEvent | MouseEvent): number {
    const rect = containerRef.current!.getBoundingClientRect()
    const y = Math.max(0, Math.min(e.clientY - rect.top, totalHeightPx))
    const raw = pixelToMinutes(y, totalHeightPx, dayStartMinutes)
    return snapToInterval(raw, snapMinutes)
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    const startMin = getMinutes(e)
    isDragging.current = true
    setDrag({ startMin, endMin: startMin })
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current || !drag) return
      const endMin = getMinutes(e as unknown as React.MouseEvent)
      setDrag((prev) => prev ? { ...prev, endMin } : prev)
    }

    function handleMouseUp(e: MouseEvent) {
      if (!isDragging.current || !drag) return
      isDragging.current = false
      const { start, end } = swapIfNeeded(drag.startMin, drag.endMin)
      setDrag(null)
      if (end - start >= minDurationMinutes) {
        onDragComplete(minutesToTime(start), minutesToTime(end))
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isDragging.current) {
        isDragging.current = false
        setDrag(null)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [drag, minDurationMinutes, onDragComplete])

  // Preview-blok berekening
  let preview: { top: number; height: number; startTime: string; endTime: string } | null = null
  if (drag) {
    const { start, end } = swapIfNeeded(drag.startMin, drag.endMin)
    const topFraction = (start - dayStartMinutes) / 600
    const endFraction = (end - dayStartMinutes) / 600
    preview = {
      top: topFraction * totalHeightPx,
      height: Math.max(1, (endFraction - topFraction) * totalHeightPx),
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
    }
  }

  const durationMins = drag
    ? Math.abs(drag.endMin - drag.startMin)
    : 0
  const durationLabel =
    durationMins >= 60
      ? `${durationMins / 60}u`
      : `${durationMins}m`

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        cursor: drag ? 'ns-resize' : 'crosshair',
        userSelect: 'none',
      }}
    >
      {preview && (
        <div
          style={{
            position: 'absolute',
            top: preview.top,
            left: 0,
            right: 0,
            height: preview.height,
            background: 'rgba(90,138,106,0.2)',
            border: '2px dashed #5a8a6a',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 8px',
            overflow: 'hidden',
          }}
        >
          <div style={{ color: '#5a8a6a', fontSize: '0.6875rem', fontWeight: 600 }}>
            {preview.startTime} – {preview.endTime}
          </div>
          {preview.height > 36 && (
            <div style={{ color: '#5a8a6a', fontSize: '0.5625rem', opacity: 0.8 }}>
              {durationLabel} · loslaten om te boeken
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] Schrijf bovenstaande code naar `src/ui/components/DragOverlay.tsx`

### Stap 1.4 — Verifieer dat de tests slagen

```bash
cd /Users/guus/projects/uren-schrijven && npm run test -- DragOverlay.test
```

Verwacht: 10 tests PASS

- [ ] Draai de tests en bevestig dat ze slagen

### Stap 1.5 — Typecheck

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck
```

Verwacht: 0 errors

- [ ] Draai typecheck en bevestig schoon

### Stap 1.6 — Commit

```bash
cd /Users/guus/projects/uren-schrijven && git add src/ui/components/DragOverlay.tsx src/ui/components/DragOverlay.test.ts && git commit -m "feat: DragOverlay component met snap-logica"
```

- [ ] Commit

---

## Task 2: DayTimeline — overlay integreren

**Files:**
- Modify: `src/ui/components/DayTimeline.tsx`

### Stap 2.1 — Voeg `onDragNew` toe aan de Props interface

Lees het huidige bestand. Zoek de `interface Props` (rond regel 34). Voeg `onDragNew` toe:

```ts
interface Props {
  date: string
  entries: HourEntry[]
  suggestions: HourEntrySuggestion[]
  conceptBlocks: ClassifiedBlock[]
  onBookSuggestion: (suggestion: HourEntrySuggestion) => void
  onEditEntry: (entry: HourEntry) => void
  onConceptClick?: (block: ClassifiedBlock) => void
  onUploadCsv?: (csvContent: string) => void
  isClassifying?: boolean
  onDragNew?: (startTime: string, endTime: string) => void
}
```

Voeg ook `onDragNew` toe aan de destructuring in de functiesignatuur:

```ts
export function DayTimeline({ date, entries, suggestions, conceptBlocks, onBookSuggestion, onEditEntry, onConceptClick, onUploadCsv, isClassifying, onDragNew }: Props) {
```

- [ ] Pas `interface Props` en de destructuring aan

### Stap 2.2 — Voeg import van `DragOverlay` toe

Voeg bovenaan, na de bestaande imports:

```ts
import { DragOverlay } from './DragOverlay'
```

- [ ] Voeg de import toe

### Stap 2.3 — Wrap de blokkenkolom in een `position:relative` container en voeg `DragOverlay` toe

Zoek in `DayTimeline.tsx` de blokkenkolom (rond regel 196):

```tsx
{/* Blokken */}
<div className="flex-1 flex flex-col gap-[1px]">
```

Vervang dit met:

```tsx
{/* Blokken — omhullende div voor drag overlay */}
<div className="flex-1 relative">
  {onDragNew && (
    <DragOverlay
      totalHeightPx={HOUR_HEIGHT_PX * 10}
      dayStartMinutes={8 * 60}
      snapMinutes={30}
      minDurationMinutes={30}
      onDragComplete={onDragNew}
    />
  )}
  <div className="flex flex-col gap-[1px]" style={{ position: 'relative', zIndex: 1 }}>
```

Voeg na alle `blocks.map(...)` en vóór de sluitende `</div>` van de blokkenkolom een extra `</div>` toe om de nieuwe wrapper te sluiten. De structuur wordt:

```tsx
<div className="flex-1 relative">           {/* nieuw */}
  {onDragNew && <DragOverlay ... />}         {/* nieuw */}
  <div className="flex flex-col gap-[1px]" style={{ position: 'relative', zIndex: 1 }}>
    {blocks.map(...)}
  </div>                                     {/* sluit flex flex-col */}
</div>                                       {/* sluit flex-1 relative */}
```

- [ ] Pas de blokkenkolom aan zoals hierboven

### Stap 2.4 — Verifieer dat alle bestaande tests nog slagen

```bash
cd /Users/guus/projects/uren-schrijven && npm run test
```

Verwacht: alle bestaande tests slagen (DragOverlay tests incluis)

- [ ] Draai alle tests

### Stap 2.5 — Typecheck

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck
```

Verwacht: 0 errors

- [ ] Draai typecheck

### Stap 2.6 — Commit

```bash
cd /Users/guus/projects/uren-schrijven && git add src/ui/components/DayTimeline.tsx && git commit -m "feat: DayTimeline integreert DragOverlay voor drag-to-book"
```

- [ ] Commit

---

## Task 3: WeekPage — handler en prop doorgeven

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

### Stap 3.1 — Voeg `handleDragNew` toe

Zoek in `WeekPage.tsx` de bestaande handlers (na `handleConceptClick`, rond regel 75). Voeg toe:

```ts
function handleDragNew(startTime: string, endTime: string) {
  setBookingConcept(null)
  setBookingEntry({
    startDate: week.selectedDate,
    startTime,
    endTime,
  })
}
```

- [ ] Voeg `handleDragNew` toe aan `WeekPage`

### Stap 3.2 — Geef `onDragNew` door aan `DayTimeline`

Zoek de `<DayTimeline ...>` JSX (rond regel 146). Voeg `onDragNew` toe:

```tsx
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
```

- [ ] Voeg `onDragNew={handleDragNew}` toe

### Stap 3.3 — Verifieer dat alle tests nog slagen

```bash
cd /Users/guus/projects/uren-schrijven && npm run test
```

Verwacht: alle tests slagen

- [ ] Draai alle tests

### Stap 3.4 — Typecheck

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck
```

Verwacht: 0 errors

- [ ] Draai typecheck

### Stap 3.5 — Commit

```bash
cd /Users/guus/projects/uren-schrijven && git add src/ui/pages/WeekPage.tsx && git commit -m "feat: WeekPage handleDragNew opent BookingModal vanuit sleep"
```

- [ ] Commit

---

## Eindverificatie

Na alle taken:

```bash
cd /Users/guus/projects/uren-schrijven && npm run test && npm run typecheck
```

Verwacht: alle tests groen, 0 typecheck-errors.

Handmatige smoke test in de app:
1. Open een dag in de kalender
2. Sleep verticaal over lege ruimte → groen preview-blok verschijnt met tijden
3. Laat los → BookingModal opent met start/eindtijd vooringevuld
4. Escape tijdens slepen → geen modal
5. Klik op bestaand blok → werkt nog steeds normaal (geen drag-interferentie)
