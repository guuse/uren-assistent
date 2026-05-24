# Design spec: Week vullen CTA redesign

**Datum:** 2026-05-24  
**Status:** Goedgekeurd

---

## Probleemstelling

De app draait momenteel om browser history als primaire input. De lege staat toont een CSV-upload CTA, waardoor de gebruiker het gevoel heeft dat hij eerst iets moet aanleveren voordat de app iets kan doen. Dit is de verkeerde framing: de hoofd-workflow is het vullen van de week op basis van alle beschikbare context (GitHub, Linear, agenda, history van afgelopen 4 weken). De CSV-upload is slechts een optionele verrijking, geen vereiste.

---

## Doelstelling

- Primaire CTA wordt "week vullen" — niet history aanleveren
- Lege staat toont de agenda zoals die is (geboekte uren + calendar events), geen upload-prompt
- CSV-upload blijft bereikbaar maar is een beheer-actie, geen trigger
- Dag-niveau verwerking krijgt een eigen CTA in de timeline-header
- Warning popup waarschuwt als er geen browser history beschikbaar is, maar blokkeert niet

---

## Architectuur

### Nieuw: `ProcessDayUseCase`

Extraheer de per-dag verwerkingslogica uit `ProcessWeekUseCase` naar een zelfstandige use case.

```
src/domain/usecases/ProcessDayUseCase.ts
```

**Interface:**
```typescript
execute(date: Date): AsyncGenerator<ProcessDayProgress>
```

**Pipeline (identiek aan huidige per-dag stap in ProcessWeekUseCase):**
1. Fetch GitHub commits voor die dag
2. Fetch Linear issues voor die dag
3. Fetch Google Calendar events voor die dag
4. Laad bestaande `ClassifiedBlock[]` uit `HistoryStore` voor die datum
5. Combineer context, classificeer via `GroupAndClassifyDayUseCase`
6. Sla resultaat op in `HistoryStore`

**`ProcessWeekUseCase` refactor:**
- Roept `ProcessDayUseCase.execute()` aan voor ma t/m vr
- Aggregeert voortgang per dag
- Gedrag voor de gebruiker is ongewijzigd

### Nieuw: history-check helpers

Twee helper-functies in de application layer (of als methode op `HistoryStore`):

```typescript
hasHistoryForDate(date: Date): Promise<boolean>
hasHistoryForWeek(weekStart: Date): Promise<boolean>  // true als minstens 1 dag history heeft
```

Gebruikt door de UI hooks voordat de pipeline wordt gestart.

---

## UI-wijzigingen

### 1. `WeekDayList`

**Wijzigingen:**
- "Verwerk week" knop krijgt prominentere stijl: primary button (accent achtergrond, bold, volle breedte)
- Nieuwe secundaire knop onder "Verwerk week": **"📂 Upload geschiedenis"**
  - Opent file picker (zelfde als huidige CSV-upload flow via `useImport`)
  - Niet week-gebonden — parsed de CSV en slaat alle datums op in `HistoryStore`
  - Na upload: geen automatische verwerking, gebruiker kiest zelf wanneer te verwerken
  - Zichtbaar ongeacht welke week geselecteerd is

**Geen wijziging:** tokens-check blijft — "Verwerk week" en de dag-CTA zijn alleen zichtbaar als GitHub + Linear + Copilot tokens ingesteld zijn.

### 2. `DayTimeline` — header

**Nieuw:** een header-balk bovenaan de timeline (boven het tijdsraster).

```
| Maandag 19 mei                    [▶ Verwerk dag] |
```

- "Verwerk dag" triggert `ProcessDayUseCase` voor de geselecteerde datum
- Zelfde tokens-check als "Verwerk week"
- Na verwerking: knop toont tijdelijk een "✓ Verwerkt" staat, daarna terug naar normaal

### 3. `DayTimeline` — lege staat

**Verwijderen:** de CTA-kaart "Chrome history uploaden" (de grote drag/drop prompt die nu toont als er geen concepts zijn).

**Vervangen door:** het tijdsraster is altijd zichtbaar. Geboekte Simplicate-uren en Google Calendar events worden getoond. Als er geen concepts en geen geboekte uren zijn, toont een subtiele hint-tekst in het midden van de lege ruimte:

> *Klik op **Verwerk dag** om voorstellen te genereren*

De hint-tekst verdwijnt zodra er concepts of geboekte uren zichtbaar zijn.

### 4. Warning popup: `NoHistoryWarningModal`

Nieuwe gedeelde modal, getriggerd door zowel "Verwerk week" als "Verwerk dag" als er geen browser history beschikbaar is voor de betreffende scope.

**Trigger-logica:**
- "Verwerk dag" → `hasHistoryForDate(selectedDate)` → false → popup
- "Verwerk week" → `hasHistoryForWeek(weekStart)` → false → popup

**Inhoud popup:**

- Titel: "Geen browsergeschiedenis beschikbaar"
- Beschrijving: "Er is geen browsergeschiedenis voor **[week 21 / maandag 19 mei]**. Voorstellen worden gegenereerd op basis van GitHub, Linear en je agenda — maar zijn mogelijk minder nauwkeurig."
  - Tekst past zich aan: week-context toont weeknummer, dag-context toont dagnaam + datum
- Drie acties:
  1. **"Toch verwerken"** (primary) — sluit popup, start pipeline direct
  2. **"📂 Upload geschiedenis eerst"** (secondary) — opent file picker; na succesvolle upload sluit de popup en start de pipeline automatisch
  3. **"Annuleren"** (ghost) — sluit popup, niets gebeurt

---

## Gedrag & edge cases

| Situatie | Gedrag |
|---|---|
| Verwerk dag/week aangeklikt, history aanwezig | Pipeline start direct, geen popup |
| Verwerk dag/week aangeklikt, geen history | Warning popup toont |
| Popup: "Toch verwerken" | Popup sluit, pipeline start |
| Popup: "Upload geschiedenis eerst" | File picker opent; na upload: popup sluit, pipeline start |
| Popup: "Annuleren" | Popup sluit, niets |
| CSV upload via WeekDayList knop | File picker, parsed alle datums, opslaan in HistoryStore, geen verwerking |
| Lege dag, geen concepts, geen uren | Tijdsraster zichtbaar, subtiele hint, geen upload-CTA |
| Lege dag, wél calendar events | Events zichtbaar in raster, hint verdwijnt niet (nog geen concepts/uren) |
| Lege dag, wél geboekte uren | Uren zichtbaar als solide blokken, hint verdwijnt |
| Tokens niet ingesteld | "Verwerk week" en "Verwerk dag" niet zichtbaar (huidig gedrag) |

---

## Wat niet verandert

- `ParseBrowserHistoryUseCase`, `ClassifyHistoryBlocksUseCase`, `GroupAndClassifyDayUseCase` — ongewijzigd
- `HistoryStore`, `MappingCacheRepository` — ongewijzigd
- `BookingModal`, `EvidencePanel`, `FieldSelector` — ongewijzigd
- Drag-and-drop op de timeline als alternatieve CSV-upload — **blijft werken** als alternatief voor de file picker in WeekDayList; alleen de grote CTA-kaart ("Chrome history uploaden") verdwijnt
- `useImport` hook — wordt hergebruikt door zowel de WeekDayList-knop als de popup-upload

---

## Betrokken bestanden

| Bestand | Wijziging |
|---|---|
| `src/domain/usecases/ProcessDayUseCase.ts` | Nieuw — extraheren uit ProcessWeekUseCase |
| `src/domain/usecases/ProcessWeekUseCase.ts` | Refactor — delegeert aan ProcessDayUseCase |
| `src/application/container.ts` | ProcessDayUseCase toevoegen als singleton |
| `src/ui/hooks/useProcessDay.ts` | Nieuw — hook voor dag-verwerking + history-check |
| `src/ui/hooks/useProcessWeek.ts` | Aanpassen — history-check toevoegen voor popup-trigger |
| `src/ui/components/WeekDayList.tsx` | "Verwerk week" stijl, CSV-knop toevoegen |
| `src/ui/components/DayTimeline.tsx` | Header-balk met dag-CTA, lege staat aanpassen |
| `src/ui/components/NoHistoryWarningModal.tsx` | Nieuw — gedeelde warning popup |
| `src/domain/repositories/IHistoryStore.ts` | `hasHistoryForDate` en `hasHistoryForWeek` toevoegen aan interface |
| `src/infrastructure/storage/HistoryStore.ts` | Implementatie van `hasHistoryForDate` en `hasHistoryForWeek` |
