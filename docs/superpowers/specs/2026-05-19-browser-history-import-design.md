# Browser History Import — Design Spec

**Date:** 2026-05-19  
**Status:** Approved

## Samenvatting

Een aparte import-pagina waarmee de gebruiker een Chrome browsergeschiedenis-CSV kan uploaden. De app analyseert de bezoeken per dag, groepeert ze per project-patroon tot tijdblokken, classificeert ze via GitHub Copilot API (met lokale mapping-cache), en laat de gebruiker de blokken reviewen en direct boeken naar Simplicate.

---

## Architectuur

De feature volgt de bestaande Clean Architecture. Dependencies lopen alleen naar binnen.

```
CSV-bestand (upload)
  → ParseBrowserHistoryUseCase        (domain/usecases)
      → groepeert per dag per URL-patroon
      → produceert: HistoryBlock[]
  → ClassifyHistoryBlocksUseCase      (domain/usecases)
      → checkt MappingCacheRepository eerst
      → roept CopilotRepository aan voor onbekende blokken
      → produceert: ClassifiedBlock[]
  → ImportPage (UI)
      → gebruiker reviewt/corrigeert
      → slaat mapping-cache op via MappingRepository
      → boekt via bestaande BookHourEntryUseCase
```

---

## Domain Entities

### `HistoryBlock`

```typescript
interface HistoryBlock {
  date: string           // YYYY-MM-DD
  urlPattern: string     // genormaliseerd, bijv. "github.com/Harborn-digital/eindhoven-doet"
  titles: string[]       // unieke paginatitels van dit patroon die dag
  visitCount: number     // totaal aantal visits
  firstVisitTime: string // HH:mm — starttijd op basis van vroegste visit
  hours: number          // (lastVisit - firstVisit) in minuten / 60, afgerond op 0.25, min 0.25
}
```

### `ClassifiedBlock`

```typescript
type ClassificationOrigin = 'cache' | 'llm' | 'manual'

interface ClassifiedBlock extends HistoryBlock {
  projectId?: string
  serviceId?: string
  note?: string
  confidence: number          // 0-1; <0.6 = onzeker
  origin: ClassificationOrigin
  startTime: string           // HH:mm (= firstVisitTime)
  endTime: string             // HH:mm (= startTime + hours)
}
```

---

## Repository Interfaces

### `ICopilotRepository`

```typescript
interface ICopilotRepository {
  classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[]
  ): Promise<ClassifiedBlock[]>
}
```

Implementatie in `src/infrastructure/CopilotRepository.ts`. Roept de GitHub Copilot API aan via Tauri's `fetch` (omzeilt CORS). De prompt bevat URL-patronen, paginatitels, en de beschikbare projecten+diensten. Geeft per blok terug: `projectId`, `serviceId`, `note`, `confidence`.

### `IMappingCacheRepository`

```typescript
interface IMappingCacheRepository {
  get(urlPattern: string): CachedMapping | undefined
  set(urlPattern: string, mapping: CachedMapping): Promise<void>
  getAll(): Record<string, CachedMapping>
}

interface CachedMapping {
  projectId: string
  serviceId: string
  note: string
}
```

Implementatie in `src/infrastructure/MappingCacheRepository.ts`. Opgeslagen als JSON in `app_data_dir/mapping-cache.json` via Tauri filesystem. Bij corrupt bestand: cache genegeerd en opnieuw opgebouwd.

---

## Use Cases

### `ParseBrowserHistoryUseCase`

**Input:** CSV-string, `minVisits: number` (standaard 3)

**Stappen:**
1. Parseer CSV — verwacht Chrome-export headers: `Order`, `ID`, `Last Visit Time`, `Title`, `URL`, `visit count`, `typed count`
2. Normaliseer elke URL naar een patroon: verwijder protocol/query/fragment, bewaar max 3 path-segmenten
3. Groepeer per dag (op basis van `Last Visit Time`) per URL-patroon
4. Filter groepen met `visitCount < minVisits`
5. Bereken `hours`: `(lastVisit - firstVisit) in minuten / 60`, afgerond op 0.25, minimaal 0.25
6. Stel `firstVisitTime` in als `startTime`

**Output:** `HistoryBlock[]`

**Foutgevallen:**
- Verkeerde headers → gooit `ParseError` met beschrijvende melding
- Lege CSV / alleen header → geeft lege array terug
- Ongeldige datums → rij overgeslagen

### `ClassifyHistoryBlocksUseCase`

**Input:** `HistoryBlock[]`, beschikbare projecten+diensten

**Stappen:**
1. Splits blokken in: cache-hits vs. onbekend
2. Cache-hits krijgen `origin: 'cache'`, `confidence: 1.0`
3. Onbekende blokken worden in één batch naar `CopilotRepository.classify()` gestuurd
4. LLM-resultaten krijgen `origin: 'llm'`
5. Blokken zonder classificatie (API-fout of geen match) krijgen `confidence: 0`, `origin: 'manual'`

**Output:** `ClassifiedBlock[]`

**Leerloop:** Wanneer de gebruiker een blok bevestigt of corrigeert, roept de UI `MappingCacheRepository.set()` aan met het URL-patroon en de definitieve mapping.

---

## Import-pagina UI

Locatie: `src/ui/pages/ImportPage.tsx`

### Stap 1: Upload

- Drag-and-drop of file picker voor `.csv`
- Numeriek veld: "Minimum aantal bezoeken" (standaard 3)
- "Analyseren" knop → triggert parse + classificatie
- Foutmeldingen worden boven het formulier getoond

### Stap 2: Review-tabel

Één rij per `ClassifiedBlock`, gesorteerd op datum → starttijd.

**Kolommen:**
| Kolom | Type | Notitie |
|---|---|---|
| Datum | tekst | YYYY-MM-DD |
| Tijdblok | twee tijdinputs | start–eind, bewerkbaar |
| Uren | berekend | automatisch uit start/eind |
| URL-patroon | tekst | readonly |
| Project | dropdown | alle beschikbare projecten |
| Dienst | dropdown | gefilterd op geselecteerd project |
| Notitie | tekstinput | vooringevuld door LLM/cache |
| Verwijderen | knop | verwijdert rij uit import |

**Visuele statusindicatoren per rij:**
- Groen — cache-hit (`origin: 'cache'`)
- Oranje — LLM-suggestie met `confidence < 0.6`
- Rood — geen classificatie (`origin: 'manual'` zonder project geselecteerd)

### Stap 3: Boeken

- "Boek geselecteerde" knop — disabled zolang er rode rijen zijn
- Boekt via bestaande `BookHourEntryUseCase` per rij
- Na boeken: succesmelding per rij inline; fouten tonen foutbericht per rij zonder de rest te blokkeren
- Dubbele boeking (zelfde dag + project + tijdstip) → waarschuwing per rij, niet automatisch overschreven

---

## Error Handling

| Situatie | Gedrag |
|---|---|
| Verkeerd CSV-formaat | Foutmelding boven upload, geen crash |
| Lege CSV | "Geen bruikbare data gevonden" |
| Copilot API niet bereikbaar | Blokken krijgen status rood, handmatig invullen |
| Projecten nog niet geladen | Classificatie geblokkeerd met melding |
| Corrupt mapping-cache bestand | Cache genegeerd, opnieuw opgebouwd |
| Dubbele boeking | Waarschuwing per rij, niet geblokkeerd |

---

## Testing

**Unit tests (Vitest):**

- `ParseBrowserHistoryUseCase`
  - Happy path met meerdere dagen en patronen
  - Lege CSV → lege array
  - Verkeerde headers → `ParseError`
  - Minimum-visits filtering
  - URL-normalisatie: lange paths, query strings, fragments
  - Tijdberekening: afronden op 0.25, minimum 0.25

- `ClassifyHistoryBlocksUseCase`
  - Cache-hit → `origin: 'cache'`, geen LLM-call
  - LLM-hit → `origin: 'llm'`, confidence doorgegeven
  - Geen hit → `origin: 'manual'`, `confidence: 0`
  - Leerloop: correctie overschrijft cache

- `MappingCacheRepository`
  - Lezen en schrijven
  - Corrupt JSON-bestand → lege cache, geen crash

**Mocks:**
- `CopilotRepository` via `vi.mock` — geen echte API-calls in unit tests
- Tauri filesystem commands via bestaande mock-patronen in de codebase

**Wat niet getest wordt:**
- Interne React component-state — alleen gedrag (upload → tabel verschijnt, boek-knop disabled bij rode rijen)

---

## Bestandsstructuur (nieuw)

```
src/domain/entities/
  HistoryBlock.ts
  ClassifiedBlock.ts

src/domain/repositories/
  ICopilotRepository.ts
  IMappingCacheRepository.ts

src/domain/usecases/
  ParseBrowserHistoryUseCase.ts
  ClassifyHistoryBlocksUseCase.ts

src/infrastructure/
  CopilotRepository.ts
  MappingCacheRepository.ts

src/ui/pages/
  ImportPage.tsx

src/ui/hooks/
  useImport.ts

src/application/
  container.ts  (uitgebreid met nieuwe repositories en use cases)
```
