# Design: Relatieve lookback, projectfilter en patroonherkenning

**Datum:** 2026-05-24  
**Status:** Goedgekeurd

---

## Probleemstelling

De LLM-classificatie (`classifyDay`) gebruikt momenteel:
- De volledige, ongefilterde projectenlijst als kandidaten
- Geen historische boekingscontext
- Geen patroonherkenning over meerdere weken

Daarnaast is de lookback altijd relatief aan *vandaag*, terwijl hij relatief aan de *doeldatum* moet zijn.

---

## Doelen

1. De LLM mag alleen projecten voorstellen waarop in de 4 weken **vóór de doeldatum** geboekt is
2. Projecten met meer boekingen in die periode krijgen hogere prioriteit (volgorde in prompt)
3. De LLM krijgt de volledige historische boekingen (alle `HourEntry`-velden) mee als context
4. De LLM herkent terugkerende patronen en kan daar zelfstandig extra blokken van aanmaken
5. Het lookback-venster is altijd relatief aan de doeldatum, niet aan vandaag

---

## Lookback-venster

```
vensterStart = targetDate - 28 dagen  (inclusief)
vensterEind  = targetDate             (exclusief)
```

**Voorbeeld:** schrijven op 2026-05-10 → venster is 2026-04-12 t/m 2026-05-09.

Dit geldt voor:
- Projectfiltering (welke projecten zijn kandidaat voor de LLM)
- Historische boekingscontext in de LLM-prompt
- De rule-based `GenerateSuggestionsUseCase` (ongewijzigd — de `useSuggestions` hook haalt al correct relatief aan `selectedDate` op)

---

## Nieuwe use case: `GetActiveProjectsForDateUseCase`

**Locatie:** `src/domain/usecases/GetActiveProjectsForDateUseCase.ts`

**Verantwoordelijkheid:** Bepaal welke projecten actief waren in de 4 weken voor de doeldatum, en lever de ruwe boekingen terug voor hergebruik als LLM-context.

**Signatuur:**
```ts
execute(targetDate: string): Promise<{
  activeProjects: SimplicateProject[]
  historicalEntries: HourEntry[]
}>
```

**Algoritme:**
1. Bereken `vensterStart = targetDate - 28 dagen`
2. Haal `HourEntry[]` op via `simplicateRepo.getHourEntries(employeeId, vensterStart, targetDate)`
3. Bepaal unieke `projectId`s uit de entries
4. Filter de volledige projectenlijst op die `projectId`s
5. Sorteer op aantal boekingen in het venster (desc) — meest actief eerst
6. Return `{ activeProjects, historicalEntries }`

**Dependencies:** `ISimplicateRepository`

---

## Wijzigingen in `ProcessDayUseCase`

`ProcessDayUseCase.execute(date)` roept parallel op:
- GitHub commits, Linear issues, Calendar events, Browser history (bestaand)
- `GetActiveProjectsForDateUseCase.execute(date)` (nieuw)

Het resultaat `{ activeProjects, historicalEntries }` wordt doorgegeven aan `GroupAndClassifyDayUseCase`.

---

## Wijzigingen in `GroupAndClassifyDayUseCase`

Accepteert twee nieuwe parameters:
- `activeProjects: SimplicateProject[]` — vervangt de volledige projectenlijst
- `historicalEntries: HourEntry[]` — wordt doorgegeven aan de LLM-call

---

## Wijzigingen in `CopilotRepository.classifyDay`

### Nieuwe parameter
```ts
classifyDay(
  date: string,
  items: ClassifyItem[],
  projects: SimplicateProject[],   // nu: gefilterd en gesorteerd
  services: SimplicateService[],
  cacheHints: CacheHint[],
  context?: DayContext,
  historicalEntries?: HourEntry[]  // nieuw
): Promise<{ blocks: ClassifiedBlock[], patternBlocks: ClassifiedBlock[] }>
```

### Nieuwe promptsectie: historische boekingen

Na de projectenlijst wordt een sectie toegevoegd:

```
## Historische boekingen (afgelopen 4 weken)

2026-05-12:
  - 09:00-10:00 | Project: Klant A (id: P1) / Dienst: Development (id: S1) | note: "PR review auth module"
  - 14:00-15:00 | Project: Intern (id: P2) / Dienst: Retro (id: S3) | note: ""

2026-04-28:
  - 14:00-15:00 | Project: Intern (id: P2) / Dienst: Retro (id: S3) | note: ""
```

Entries worden gegroepeerd per dag, chronologisch gesorteerd (recentst eerst).

### Nieuwe patrooninstructie in system prompt

```
Analyseer de historische boekingen op terugkerende patronen:
- Een patroon is een combinatie van project+dienst die op vergelijkbare intervallen voorkomt
  (bijv. elke week, elke 2 weken, maandelijks)
- Als een patroon matcht met de doeldatum EN er is geen browser-activiteit of calendar-event
  voor die combinatie, maak dan een extra blok aan in `patternBlocks`
- Gebruik het historisch gemiddelde voor de geschatte duur
- Geef patronen hogere confidence dan losse browser-activiteit zonder aanvullende context
```

### Gewijzigde output

```ts
{
  blocks: ClassifiedBlock[]        // bestaand: geclassificeerde browser/calendar blokken
  patternBlocks: ClassifiedBlock[] // nieuw: blokken puur op basis van patroonherkenning
}
```

`patternBlocks` zijn reguliere `ClassifiedBlock`-objecten met een extra veld `origin: 'llm-pattern'`.

---

## Wijziging in `HourEntrySuggestion`

Het veld `reason` wordt uitgebreid:

```ts
reason: 'pattern' | 'last-week' | 'llm-pattern'
```

`'llm-pattern'` wordt gebruikt voor blokken die de LLM op basis van historische patronen heeft aangemaakt zonder onderliggende browser-activiteit.

---

## Gewijzigde bestanden — overzicht

| Bestand | Wijziging |
|---|---|
| `src/domain/usecases/GetActiveProjectsForDateUseCase.ts` | Nieuw |
| `src/domain/usecases/ProcessDayUseCase.ts` | Roept nieuwe use case aan; geeft resultaat door |
| `src/domain/usecases/GroupAndClassifyDayUseCase.ts` | Accepteert `activeProjects` + `historicalEntries` |
| `src/infrastructure/copilot/CopilotRepository.ts` | Prompt uitbreiding + `patternBlocks` in output |
| `src/application/container.ts` | Registreer `GetActiveProjectsForDateUseCase` |
| `src/domain/entities/HourEntrySuggestion.ts` | `reason` uitbreiden met `'llm-pattern'` |

### Ongewijzigd

- `GenerateSuggestionsUseCase` — gebruikt al correct relatieve lookback via de hook
- `useSuggestions` hook — haalt al 4 weken op relatief aan `selectedDate`
- `MappingCacheRepository` — geen wijziging

---

## Niet in scope

- UI-weergave van `patternBlocks` anders dan bestaande blokken (volgt bestaande `ClassifiedBlock` rendering)
- Persistentie van gedetecteerde patronen (LLM detecteert ze elke keer opnieuw)
- Configureerbare lookback-periode (altijd 28 dagen)
