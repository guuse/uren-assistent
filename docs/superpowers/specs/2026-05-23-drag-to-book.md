# Spec: Drag-to-Book in de dagkalender

**Datum:** 2026-05-23  
**Status:** Goedgekeurd

---

## Doel

De gebruiker kan in de dagkalender een tijdslot selecteren door verticaal te slepen over lege ruimte. Na loslaten opent de `BookingModal` met start- en eindtijd vooringevuld. Geen LLM betrokken — puur handmatige boeking.

---

## Gedrag

### Drag-interactie

- **Startpunt:** `mousedown` op lege ruimte in de blokkenkolom van de tijdlijn (niet op een bestaand blok).
- **Tijdens slepen:** een groen preview-blok verschijnt op de tijdlijn met:
  - Startijd en eindtijd (bijv. `10:00 – 11:30`)
  - Duur in uren (bijv. `1,5 uur`)
  - Subtiele resize-indicator aan de onderkant
  - Cursor wordt `ns-resize`
- **Snapping:** start- en eindtijd snappen naar het dichtstbijzijnde 30-minuteninterval.
- **Minimale duur:** 30 minuten (één snap-interval).
- **Loslaten (`mouseup`):** als de geselecteerde duur ≥ 30 minuten, opent `BookingModal` met `startTime` en `endTime` vooringevuld.
- **Annuleren:** `Escape` of `mouseup` buiten de kolom zonder minimale duur wist het preview-blok zonder modal te openen.
- **Bestaande blokken:** drag start niet op bestaande entry- of concept-blokken (die hebben hun eigen `onClick`).

### Preview-blok visueel

```
╔══════════════════════════╗
║  10:00 – 11:30           ║  ← groen (#5a8a6a), border dashed
║  1,5 uur · sleep om te   ║  ← subtekst, dimmer
║  boeken                  ║
╟──────────────────────────╢  ← resize handle (visueel, niet functioneel)
```

- Achtergrond: `rgba(90,138,106,0.2)`
- Border: `2px dashed #5a8a6a`
- Tekst: `#5a8a6a`

### BookingModal

- Opent met `initialEntry: { startDate, startTime, endTime }` — geen `evidenceBlock`.
- De modal toont géén EvidencePanel (want er is geen `evidenceBlock`).
- De gebruiker vult project, dienst en urensoort in zoals gewoonlijk.

---

## Architectuur

### Probleemstelling: flex column vs. absolute positioning

De tijdlijn gebruikt momenteel **flex column** voor blokken — blokken zijn gewoon opeenvolgende elementen, niet absoluut gepositioneerd. Dit maakt pixel-nauwkeurige hit-testing voor drag lastig.

**Oplossing:** de blokkenkolom (`<div className="flex-1 flex flex-col gap-[1px]">`) krijgt een `position: relative` overlay die de volledige hoogte van de tijdlijn beslaat en `mousedown`/`mousemove`/`mouseup` events afvangt. De overlay zit onder de bestaande blokken (via `z-index`) zodat klikken op blokken nog steeds werken.

Concreet:

```
<div style="position: relative">
  {/* Drag overlay — vangt lege muisgebeurtenissen */}
  <DragOverlay onDragComplete={handleDrag} />

  {/* Bestaande blokken — zitten er bovenop */}
  {blocks.map(...)}
</div>
```

De overlay berekent tijden via pixelpositie:
```
time = DAY_START + (mouseY / totalHeight) * DAY_DURATION
```
Afgerond naar 30-min intervals.

### Nieuwe component: `DragOverlay`

**Bestand:** `src/ui/components/DragOverlay.tsx`

```ts
interface Props {
  totalMinutes: number        // bijv. 600 voor 08:00–18:00
  dayStartMinutes: number     // bijv. 480 voor 08:00
  snapMinutes: number         // 30
  onDragComplete: (startTime: string, endTime: string) => void
}
```

Interne state:
- `dragStart: number | null` — minuten vanaf dag-start
- `dragEnd: number | null`

Logica:
- `onMouseDown`: sla pixelY op, bereken startMinutes, zet `dragStart`
- `onMouseMove`: bereken endMinutes, update `dragEnd` (en daarmee het preview-blok)
- `onMouseUp`: als `|end - start| >= 30`, roep `onDragComplete` aan

### Aanpassingen in `DayTimeline.tsx`

- Blokkenkolom krijgt `position: relative`
- `DragOverlay` toegevoegd als eerste child (laagste z-index)
- Nieuwe prop `onDragNew: (startTime: string, endTime: string) => void`

### Aanpassingen in `WeekPage.tsx`

- Handler `handleDragNew(startTime, endTime)`: zet `bookingEntry` met `{ startDate, startTime, endTime }`
- Doorgeven aan `DayTimeline` via `onDragNew`

---

## Wat er NIET verandert

- `BookingModal` zelf — geen wijzigingen nodig
- `useBooking` — geen wijzigingen
- Domain/application layer — geen wijzigingen
- Bestaande klik-interacties op blokken

---

## Randgevallen

| Situatie | Gedrag |
|---|---|
| Sleep omhoog (end < start) | Start en end worden geswapt |
| Minder dan 30 min gesleept | Geen modal, preview verdwijnt |
| Sleep start op bestaand blok | Niet opgepikt door overlay (blok zit er bovenop) |
| Escape tijdens drag | Preview verdwijnt, geen modal |
| Sleep buiten kolom | `mouseup` buiten → annuleren |

---

## Testen

- Unit tests voor `DragOverlay` logica (pixel → minuten, snapping, swap)
- Unit test: duur < 30 min → geen callback
- Unit test: swap als end < start
- Geen e2e tests vereist

---

## Niet in scope

- Drag om bestaand blok te verplaatsen
- Drag om tijden van bestaand blok aan te passen (resize)
- Touch/mobile ondersteuning
