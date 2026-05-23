# Spec: Gestarrde projecten

**Datum:** 2026-05-23  
**Status:** Goedgekeurd

## Doel

Gebruikers kunnen projecten sterren zodat die bovenaan de projecten-dropdown in de BookingModal staan. Sterren is ook mogelijk vanuit de Settings pagina. De selectie wordt persistent bewaard op schijf.

## Gedrag

### BookingModal dropdown
- Projecten worden gesplitst in twee groepen: **Favorieten** (gestarred) en **Overig**
- Favorieten staan bovenaan met een amber ★-icoon rechts; overige projecten hebben een dim ☆
- Binnen elke groep: alfabetisch gesorteerd op `organizationName — name`
- Klikken op ★/☆ toggle de starred-status onmiddellijk (optimistic update)
- Visueel: gestarrde items hebben een subtiele amber rand/achtergrond, de rest is normaal

### Settings — tabblad of sectie "Projecten"
- Volledige projectenlijst getoond, gestarrde bovenaan
- Zelfde ★/☆ toggle per project
- Toegevoegd aan de bestaande `AccountSettings.tsx` als nieuwe sectie onderaan (geen nieuw tabblad — eenvoudiger)

## Architectuur

### Nieuwe bestanden

**`src/domain/repositories/IStarredProjectsRepository.ts`**
```ts
export interface IStarredProjectsRepository {
  load(): Promise<void>
  getStarredIds(): Set<string>
  toggle(projectId: string): Promise<void>
}
```

**`src/infrastructure/storage/StarredProjectsStore.ts`**
- Implementeert `IStarredProjectsRepository`
- Leest/schrijft `starred-projects.json` via `@tauri-apps/plugin-fs` + `appDataDir()`
- Bestandsformaat: `{ "starredIds": ["id1", "id2"] }`
- Bij ontbrekend bestand: lege Set (geen fout)

**`src/ui/hooks/useStarredProjects.ts`**
- Laadt de store bij mount via `useEffect`
- Geeft terug: `{ starredIds: Set<string>, toggle: (id: string) => Promise<void> }`
- Gebruikt `useState` lokaal — geen Zustand nodig (de data is klein en component-lokaal voldoende)

### Gewijzigde bestanden

**`src/application/container.ts`**
- Exporteer een singleton `starredProjectsStore` instantie van `StarredProjectsStore`

**`src/ui/hooks/useBooking.ts`**
- Importeer `useStarredProjects`
- Sorteer `projects` vóór teruggeven: gestarrde eerst (alfabetisch), dan rest (alfabetisch)
- Geef ook `starredIds` en `toggleStar` mee terug

**`src/ui/pages/BookingModal.tsx`**
- Gebruik `starredIds` en `toggleStar` uit `useBooking`
- Render twee groepen in de dropdown: "Favorieten" sectie + "Overig" sectie
- Ster-knop per item (stopt propagatie zodat de dropdown niet sluit)

**`src/ui/pages/Settings/AccountSettings.tsx`**
- Voeg sectie "Favoriete projecten" toe onderaan
- Gebruik `useStarredProjects` + `useAppStore` om de projectenlijst te renderen
- Zelfde ★/☆ toggle

## SearchSelect component

De huidige `BookingModal` gebruikt een `SearchSelect` component voor de project-dropdown. Controleer of dit component custom rendering van items ondersteunt. Zo niet, render de project-dropdown als een eenvoudige gestyled lijst (net als in het mockup) in plaats van via `SearchSelect`. Dit is een implementatiedetail voor de uitvoerende subagent om op te besluiten.

## Persistentie

- Bestand: `<appDataDir>/starred-projects.json`
- Formaat: `{ "starredIds": ["simplicate/project/abc123", ...] }`
- Schrijven: na elke toggle direct wegschrijven (geen debounce nodig — kleine data)
- Leesfout/ontbrekend bestand: behandelen als lege set

## Niet in scope

- Drag-to-reorder binnen favorieten
- Maximumaantal favorieten
- Sync van sterren tussen apparaten
