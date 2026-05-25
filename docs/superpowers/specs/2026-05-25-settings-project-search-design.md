# Design: Zoeken en favorieten-overzicht in Settings

**Datum:** 2026-05-25

## Probleemstelling

Er zijn veel projecten. Het is moeilijk om de juiste projecten te vinden om te favoriten. Bovendien is er geen overzicht van huidige favorieten in de settings.

## Ontwerp

### Wijzigingen in `AccountSettings.tsx`

1. **Zoekbalk** — een tekstinput boven de projectenlijst. Filtert live op projectnaam (case-insensitive). Leeg = alle projecten zichtbaar.

2. **Sorteervolgorde** — favorieten altijd bovenaan, daarna de rest. Beide groepen intern alfabetisch gesorteerd op `organizationName — name`. Geldt ook tijdens filteren.

3. **Visuele scheiding** — wanneer er favorieten zijn én er ook niet-favorieten zichtbaar zijn, een label/divider tussen de twee groepen (bijv. "Favorieten" en "Overige projecten").

### Geen architectuurwijzigingen

Alles speelt zich af in `AccountSettings.tsx`. Geen nieuwe use cases, repositories of hooks nodig. De `useStarredProjects` hook en `StarredProjectsStore` blijven ongewijzigd.

## Scope

- Alleen `src/ui/pages/Settings/AccountSettings.tsx`
- Zoeken op projectnaam, niet op klantnaam
- Geen tabs, geen aparte secties — één gecombineerde lijst

## Niet in scope

- Zoeken in de booking modal (aparte feature)
- Synchronisatie van favorieten tussen dev en prod
