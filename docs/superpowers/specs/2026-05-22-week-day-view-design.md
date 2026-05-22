# Week/Day View — Design Spec

**Date:** 2026-05-22  
**Status:** Approved

---

## Overzicht

De app wordt omgebouwd van een template-gebaseerde boekingstool naar een dag-gerichte urenschrijver. Het centrale concept: elke werkdag moet gevuld worden met 8 uur. De app haalt bestaande boekingen op uit Simplicate, toont een tijdlijn per dag, en vult gaten automatisch op met slimme suggesties gebaseerd op boekingshistorie.

Templates, template-opslag en alle bijbehorende UI worden volledig verwijderd.

---

## Wat verdwijnt

| Onderdeel | Locatie |
|---|---|
| `HomePage` | `src/ui/pages/Home.tsx` |
| `TemplateCard` | `src/ui/components/TemplateCard.tsx` |
| `TemplateForm` | `src/ui/pages/Settings/TemplateForm.tsx` |
| Templates tab in Settings | `src/ui/pages/Settings/SettingsPage.tsx` |
| `BookTemplateUseCase` | `src/domain/usecases/BookTemplateUseCase.ts` |
| `SaveTemplateUseCase` | `src/domain/usecases/SaveTemplateUseCase.ts` |
| `DeleteTemplateUseCase` | `src/domain/usecases/DeleteTemplateUseCase.ts` |
| `ITemplateRepository` | `src/domain/repositories/ITemplateRepository.ts` |
| `TemplateStorageRepository` | `src/infrastructure/storage/TemplateStorageRepository.ts` |
| `Template` entities en types | `src/domain/entities/Template.ts` |
| `useTemplates` hook | `src/ui/hooks/useTemplates.ts` |

---

## Wat er bij komt

### Domain

**`src/domain/entities/HourEntrySuggestion.ts`**
```ts
interface HourEntrySuggestion {
  projectId: string
  serviceId: string
  hourTypeId: string
  startTime?: string       // meest recente tijden uit historie
  endTime?: string
  reason: 'pattern' | 'last-week'
  occurrences: number      // hoe vaak in de laatste 4 weken op deze weekdag
}
```

**`src/domain/repositories/ISimplicateRepository.ts`** — uitgebreid met:
```ts
getHourEntries(employeeId: string, from: string, to: string): Promise<HourEntry[]>
```
Haalt boekingen op via de Simplicate `/hours` API gefilterd op medewerker en datumbereik. De response bevat `project.id`, `projectservice.id`, `hourtype.id`, `start_date`, `start_time`, `end_time`, `hours`, `note` — mapt direct op de bestaande `HourEntry` interface.

**`src/domain/usecases/GetWeekEntriesUseCase.ts`**  
Haalt alle `HourEntry[]` op voor een gegeven ISO-week (ma t/m vr). Groepeert resultaat per datum: `Record<string, HourEntry[]>`.

**`src/domain/usecases/GenerateSuggestionsUseCase.ts`**  
Analyseert de boekingen van de afgelopen 4 weken voor een gegeven weekdag (bijv. `'tue'`). Logica:
- Entries van exact vorige week op die dag → `reason: 'last-week'`
- `(projectId, serviceId, hourTypeId)` combinaties die op ≥2 van de 4 vorige gelijke weekdagen voorkomen → `reason: 'pattern'`
- Duplicaten (zelfde combinatie in beide categorieën) worden samengevoegd, `last-week` heeft prioriteit
- Gesorteerd op `occurrences` desc, daarna `last-week` voor `pattern`
- `startTime`/`endTime` worden overgenomen van de meest recente boeking met die combinatie

**`src/domain/usecases/BookHoursUseCase.ts`**  
Vervangt `BookTemplateUseCase`. Neemt een volledig ingevulde `HourEntry` (geen template meer) en boekt deze via `simplicateRepo.bookHours([entry])`. Valideert dat alle verplichte velden aanwezig zijn.

### Infrastructure

**`src/infrastructure/simplicate/SimplicateRepository.ts`** — `getHourEntries` implementatie:
- `GET /v2/hours/hours?q[employee.id]=<id>&q[start_date][gte]=<from>&q[start_date][lte]=<to>`
- Mapt response op `HourEntry[]`

### Application

**`src/application/container.ts`** — registreer `GetWeekEntriesUseCase`, `GenerateSuggestionsUseCase`, `BookHoursUseCase`.

### UI Hooks

**`src/ui/hooks/useWeek.ts`**  
State voor de week-view:
- `selectedWeekStart: string` (ISO datum van maandag, default = huidige week)
- `selectedDate: string` (default = vandaag)
- `entriesByDate: Record<string, HourEntry[]>`
- `isLoading: boolean`
- Acties: `selectDate(date)`, `prevWeek()`, `nextWeek()`, `refresh()`
- Laadt entries via `GetWeekEntriesUseCase` wanneer `selectedWeekStart` verandert

**`src/ui/hooks/useSuggestions.ts`**  
- Input: `selectedDate: string`
- Output: `suggestions: HourEntrySuggestion[]`, `isLoading: boolean`
- Roept `GenerateSuggestionsUseCase` aan wanneer `selectedDate` verandert

### UI Componenten

**`src/ui/pages/WeekPage.tsx`** — vervangt `HomePage` als hoofdpagina  
Layout: app-sidebar (bestaand) + dag-lijst links + tijdlijn rechts.

**`src/ui/components/WeekDayList.tsx`**  
Verticale lijst van ma t/m vr. Per dag:
- Dagnaam + datum (bijv. "DI 20")
- Voortgangsbalk (geboekte uren / 8u)
- Uren-label (bijv. "5 / 8u")
- Kleurcode: groen = vol (≥8u), oranje = gedeeltelijk, grijs = leeg
- Geselecteerde dag heeft highlight-border
- Pijltjes onderaan voor vorige/volgende week + label "deze week" / "week X"

**`src/ui/components/DayTimeline.tsx`**  
Tijdlijn van 08:00–18:00 (10 uur). Per uur een rij van 48px hoogte.  
Toont twee soorten blokken:
1. **Boeking** (gevuld blok): gekleurde achtergrond met gekleurde linkerborder, projectnaam, tijdrange, optionele notitie. Klikbaar → `BookingModal` in bewerkingsmodus.
2. **Gat met suggestie** (gestippeld blok): donkere achtergrond, gestippelde border, suggestienaam + reden (`vorige week` of `patroon`), "+ Boek" knop. Klikbaar → `BookingModal` met pre-filled data.
3. **Leeg gat zonder suggestie**: neutrale donkere achtergrond, geen interactie.

Gat-berekening: aaneengesloten tijdvakken tussen 08:00–18:00 die niet door een `HourEntry` gedekt zijn. Suggestie-matching: suggestie waarvan `startTime` in het gat valt; anders eerste beschikbare suggestie.

**`BookingModal`** (bestaand, licht aangepast)  
- Ontvangt nu `initialEntry: Partial<HourEntry>` in plaats van een `Template`
- Pre-fills alle beschikbare velden
- Behoudt bestaande logica voor ontbrekende velden (project/service/hourtype selectors)
- Nieuw: `mode: 'create' | 'edit'` — edit-mode toont ook een "Verwijder" knop die de boeking uit Simplicate verwijdert (vereist `DELETE /v2/hours/hours/:id`, dus `HourEntry` krijgt optioneel `id?: string` veld)
- **Scope-afbakening:** delete-boeking is optioneel voor de eerste versie; als het `DELETE` endpoint beschikbaar is wordt het meegenomen, anders alleen create.

---

## Dataflow

```
WeekPage mount
  → useWeek: GetWeekEntriesUseCase(weekStart, weekEnd)
    → SimplicateRepository.getHourEntries()
      → entriesByDate gevuld

selectedDate verandert
  → useSuggestions: GenerateSuggestionsUseCase(date, last4WeeksEntries)
    → suggestions[] voor die dag

DayTimeline render
  → entries voor selectedDate + suggestions
  → gaten berekend tussen 08:00–18:00
  → per gat: beste suggestie gezocht op basis van startTime-overlap

Gebruiker klikt "+ Boek" op suggestie
  → BookingModal opent met Partial<HourEntry> pre-filled
  → gebruiker bevestigt → BookHoursUseCase.execute(entry)
    → SimplicateRepository.bookHours([entry])
  → useWeek.refresh() → tijdlijn herlaadt
```

---

## Foutafhandeling

- `getHourEntries` mislukt → tijdlijn toont lege staat met foutmelding, suggesties worden niet gegenereerd
- `bookHours` mislukt → BookingModal toont inline foutmelding (bestaand gedrag)
- Geen boekingen in afgelopen 4 weken → geen suggesties, gaten tonen neutrale lege staat
- Simplicate API timeout → zelfde lege staat + retry-knop

---

## Wat niet verandert

- `ImportPage` en de volledige import-flow blijven intact
- `AccountSettings` blijft
- `useAuth`, `useSimplicateData`, `useAppInit` blijven
- `HourEntry` entity blijft (krijgt optioneel `id?: string`)
- `BookingModal` blijft, ontvangt `Partial<HourEntry>` i.p.v. `Template`
- Sidebar navigatie: Home-icoon wordt WeekPage, Import-icoon blijft

---

## Testing

- Unit tests voor `GenerateSuggestionsUseCase`: patroon-detectie (≥2 van 4 weken), last-week prioriteit, deduplicatie, lege invoer
- Unit tests voor `GetWeekEntriesUseCase`: groupering per datum, weekgrenzen
- Unit tests voor `BookHoursUseCase`: validatie verplichte velden
- Unit tests voor gat-berekening in `DayTimeline` (pure helper functie extracten)
- Mock `SimplicateRepository` in alle use case tests
- Geen wijzigingen aan bestaande e2e tests voor import-flow
