# Design: Gecombineerde agenda + history flow

**Datum:** 2026-05-22  
**Status:** Goedgekeurd door gebruiker

---

## Samenvatting

De huidige twee afzonderlijke flows (WeekPage / ImportPage) worden samengevoegd tot één centrale agenda-flow. De `WeekPage` wordt de enige home. Browser history (CSV) is een databron die je laadt om dagen te verrijken — de LLM classificeert en plot concept-items direct op de tijdlijn. Je klikt een concept aan, vult ontbrekende info in via de `BookingModal`, en boekt. Na boeken keer je terug naar de dag; het concept is vervangen door een echte geboekte entry.

`ImportPage` en de `import`-navigatieknop in de `Sidebar` vervallen volledig.

---

## Flows

### Flow A — Dag zonder history (CTA-state)

1. Gebruiker selecteert een dag in `WeekDayList`.
2. Er zijn geen `ClassifiedBlock`s voor die dag in de `HistoryStore`.
3. `DayTimeline` toont een CTA-card centraal in het tijdlijn-gebied:
   - Icoontje (↑), heading, subtekst, "Chrome history uploaden"-knop, drag-drop hint.
   - Stijl: `border-2 border-dashed border-[#3a5a2a]`, achtergrond `#1e2418`, identiek aan bestaande dashed-stijlen in de app.
4. De gebruiker sleept een CSV of klikt de knop → `analyseFile(csvContent)` van `useImport` wordt aangeroepen.
5. Tijdens verwerking toont de header `"Bezig met classificeren..."` en een loading-indicator.
6. Na afloop worden de `ClassifiedBlock`s voor alle datums in de CSV opgeslagen in de `HistoryStore` (zie hieronder).
7. De tijdlijn van de geselecteerde dag wordt direct getoond met concept-items.

### Flow B — Dag met concepten (timeline-state)

1. `DayTimeline` toont `HourEntry`s (geboekt, indigo) én `ClassifiedBlock`s (concept, gestippeld) gemixed op dezelfde tijdlijn.
2. Concept-blokken zijn klikbaar (`cursor-pointer`).
3. Rechtsboven in de day-header: kleine knop "↑ Nieuwe CSV" om aanvullende history te uploaden (zelfde flow als A).
4. De `WeekDayList` toont een badge `"N concept"` bij dagen die onbevestigde blokken hebben en nog geen 8u geboekt.

### Flow C — Concept bevestigen

1. Gebruiker klikt een concept-blok op de tijdlijn.
2. `BookingModal` opent, pre-filled met alle velden uit het `ClassifiedBlock`:
   - `blockName` / `summary` → `note`
   - `startTime`, `endTime`, `date`
   - `projectId`, `serviceId` (indien aanwezig)
3. Bovenaan de modal: een **evidence-strip** met `block.rawUrls` / `block.rawTitles` (compact, één regel, scrollbaar).
4. Ontbrekende verplichte velden (`projectId`, `serviceId`) worden amber gemarkeerd: `border-[#a07848]`.
5. "Boek"-knop is disabled zolang `projectId` of `serviceId` leeg is.
6. Na succesvol boeken:
   - `ClassifiedBlock` wordt verwijderd uit de `HistoryStore` voor die dag.
   - `BookingModal` sluit.
   - Week-entries worden ververst via `week.refresh()`.
   - Gebruiker ziet de dag opnieuw — concept is weg, geboekte entry staat in indigo.
7. "Overslaan": modal sluit, concept blijft op de tijdlijn staan (niet verwijderd).

---

## Nieuwe component: HistoryStore

**Locatie:** `src/infrastructure/storage/HistoryStore.ts`  
**Interface:** `src/domain/repositories/IHistoryStore.ts`

Verantwoordelijkheid: persisteer `ClassifiedBlock[]` per datum in een lokaal JSON-bestand (`history-store.json`) via de Tauri `fs` plugin — zelfde patroon als `MappingCacheRepository`.

```ts
interface IHistoryStore {
  getBlocksForDate(date: string): Promise<ClassifiedBlock[]>
  setBlocksForDate(date: string, blocks: ClassifiedBlock[]): Promise<void>
  removeBlock(date: string, urlPattern: string): Promise<void>
  hasDataForDate(date: string): Promise<boolean>
}
```

- Blokken worden opgeslagen na een succesvolle `analyseFile`-run.
- Een blok wordt verwijderd na succesvol boeken (`confirmBlock`).
- Meerdere CSV-uploads voor overlappende datums worden **gemergd**: bestaande blokken worden vervangen op basis van `urlPattern`.
- De store wordt geladen bij app-start (lazy, eerste keer dat een dag wordt geselecteerd).

---

## Aanpassingen bestaande bestanden

### `src/ui/pages/WeekPage.tsx`

- Importeert `useImport` naast `useWeek` en `useSuggestions`.
- Geeft `ClassifiedBlock[]` voor de geselecteerde datum door aan `DayTimeline`.
- Geeft `analyseFile`, `status` (voor loading-state) en `onConceptClick` door.
- `BookingModal` wordt ook geopend vanuit concept-klik (pre-fill via `ClassifiedBlock`).
- `onBooked`-callback roept zowel `week.refresh()` als `historyStore.removeBlock(...)` aan.
- Import-navigatieknop in `Sidebar` vervalt; `Sidebar`-component verliest de `import`-page optie.

### `src/ui/components/DayTimeline.tsx`

Nieuwe props:
```ts
conceptBlocks?: ClassifiedBlock[]
onConceptClick?: (block: ClassifiedBlock) => void
onUploadCsv?: () => void
isClassifying?: boolean
```

Gedrag:
- Als `conceptBlocks` leeg is én geen geboekte `entries`: toon CTA-card (drag-drop zone + upload-knop).
- Als er blokken zijn: merge `conceptBlocks` met `entries` tot één gesorteerde tijdlijn.
- Concept-blokken worden gerenderd als gestippelde blokken (zie visuele stijlen hieronder).
- Rechtsboven in de header: "↑ Nieuwe CSV"-knop, alleen zichtbaar als er al blokken/entries zijn.
- Loading-state (`isClassifying`): toon `"Bezig met classificeren..."` spinner centraal.

### `src/ui/components/DayTimeline.helpers.ts`

Nieuwe exportfunctie:
```ts
export function mergeConceptsIntoTimeline(
  entries: HourEntry[],
  concepts: ClassifiedBlock[],
  dayStart: string,
  dayEnd: string,
): TimelineBlock[]
```

- Sorteert entries + concepts samen op `startTime`.
- Geeft gaten terug zonder concept-overlap (concepts vullen hun eigen tijdslot).
- Nieuw `TimelineBlock`-type: `{ type: 'concept'; startTime: string; endTime: string; block: ClassifiedBlock }`.

### `src/ui/components/WeekDayList.tsx`

Nieuwe prop:
```ts
conceptCountForDate?: (date: string) => number
```

- Toont een amber badge `"N concept"` onder de progress bar bij een dag die onbevestigde concepten heeft.
- Badge-stijl: `bg-[#2a2010] text-[#a07848] text-[8px] px-[5px] py-[0.5px] rounded`.

### `src/ui/pages/BookingModal.tsx`

Nieuwe prop:
```ts
evidenceBlock?: ClassifiedBlock
```

- Als aanwezig: toon een evidence-strip direct onder de modal-header, boven de form-fields.
- Strip-stijl: `bg-[#1c1917] border border-[#2e2a26] rounded-[6px] px-[10px] py-[7px] text-[9px] text-[#4a4540]`.
- Inhoud: `rawUrls` en `rawTitles` samengevat als één regel (max 6 items, daarna `+N meer`).

### `src/ui/components/Sidebar.tsx`

- `Page` type: verwijder `'import'`.
- Verwijder `navItem('import', ArrowDownTrayIcon, 'Importeer')`.

---

## Visuele stijlen concept-blokken

Alle concept-blokken zijn gestippeld (`strokeDashArray`) en klikbaar. De kleur geeft de betrouwbaarheid aan:

| Toestand | Achtergrond | Border | Tekst subtitel |
|---|---|---|---|
| Compleet (cache / conf ≥ 0.8) | `#1a2a1a` | `1.5px dashed #5a8a6a` | `#5a8a6a` |
| Ontbrekend project/dienst | `#2a2010` | `1.5px dashed #a07848` | `#a07848` |
| Lage zekerheid (conf < 0.6) | `#2a1010` | `1.5px dashed #8a3a3a` | `#8a3a3a` |

Concept-blok structuur (identiek aan bestaande entry-blokken, zelfde hoogte-berekening):
```tsx
<button
  onClick={() => onConceptClick(block)}
  style={{ height }}
  className="w-full text-left rounded-r px-3 py-1 transition-colors cursor-pointer flex flex-col justify-center [concept-klasse]"
>
  <div className="text-[#e8e2d9] text-[11px] font-semibold truncate">{block.blockName}</div>
  <div className="text-[10px] [subtitel-kleur]">{block.startTime}–{block.endTime} · {duur}u</div>
  {!block.projectId && <div className="text-[#7a7268] text-[9px]">⚠ Project ontbreekt</div>}
  <div className="absolute right-2 top-2 text-[9px] px-[6px] py-[2px] rounded [badge-klasse]">
    {block.origin === 'cache' ? 'Cache' : `${Math.round(block.confidence * 100)}% zeker`}
  </div>
</button>
```

---

## State management

`useImport` blijft het bestaande patroon volgen (in-memory `blocks[]`). De `HistoryStore` is de persistentielaag eronder — `useImport` laadt bij initialisatie blokken van de store en schrijft ernaar na classificatie en na boeken.

Er komt een nieuwe `useHistoryStore`-hook die `HistoryStore` omhult en reactieve updates biedt:
```ts
const { blocksForDate, hasData, removeBlock } = useHistoryStore(selectedDate)
```

`WeekPage` gebruikt `useHistoryStore` om te bepalen of een dag een CTA of tijdlijn toont, en om het `conceptCountForDate`-getal door te geven aan `WeekDayList`.

---

## Wat vervalt

| Bestand | Actie |
|---|---|
| `src/ui/pages/ImportPage.tsx` | Verwijderen |
| `src/ui/hooks/useImport.ts` | Behouden, maar `selectedBlockIndex` / `openBlock` / `closeBlock` worden vervangen door `WeekPage`-lokale state |
| Sidebar import-nav-item | Verwijderen |
| `ImportBlockCard.tsx` | Verwijderen (functionaliteit zit in `BookingModal` + evidence-strip) |

---

## Wat niet verandert

- `useWeek`, `useBooking`, `useSuggestions`, `useCalendarEvents` — ongewijzigd.
- `BookHoursUseCase`, `GroupAndClassifyDayUseCase`, `MappingCacheRepository` — ongewijzigd.
- `DayTimeline.helpers.ts` `computeTimelineBlocks` — blijft bestaan voor de geboekte-entries tijdlijn, de nieuwe `mergeConceptsIntoTimeline` komt ernaast.
- Kleuren, spacing, border-radius, font-sizes — exact bestaande tokens (`#1c1917`, `#2e2a26`, `#e8e2d9`, `rounded-[7px]`, `text-[11px]`, etc.).

---

## Testplan

- Unit test `mergeConceptsIntoTimeline`: concepts en entries goed gesorteerd, geen overlap, gaten correct.
- Unit test `IHistoryStore`: set/get/remove/merge per datum.
- Unit test `useHistoryStore`: `hasData` correct na set, false na remove van laatste blok.
- Bestaande use-case tests blijven ongewijzigd.
