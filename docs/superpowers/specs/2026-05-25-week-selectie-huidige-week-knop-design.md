# Design: Week selectie — "Huidige week" knop

**Datum:** 2026-05-25

## Samenvatting

Voeg een "Nu" knop toe aan de week-navigatiebalk in de zijbalk. De knop is alleen zichtbaar wanneer de gebruiker een andere week bekijkt dan de huidige week. Bij klik springt de app terug naar de huidige week en selecteert maandag.

## Gedrag

- **Zichtbaarheid:** De knop verschijnt alleen als `selectedWeekStart !== getMondayOf(new Date())`. Als de gebruiker al op de huidige week zit, is de knop niet aanwezig in de DOM.
- **Bij klik:** `selectedWeekStart` wordt gereset naar de maandag van de huidige week. `selectedDate` wordt ingesteld op diezelfde maandag.
- **Geen andere side-effects:** Data refresh volgt het bestaande mechanisme (useEffect op `selectedWeekStart` in `useWeek`).

## Wijzigingen

### `src/ui/hooks/useWeek.ts`

- Voeg computed `isCurrentWeek: boolean` toe — `getMondayOf(new Date()) === selectedWeekStart`.
- Voeg `goToCurrentWeek()` functie toe — zet `selectedWeekStart` op `getMondayOf(new Date())` en `selectedDate` op diezelfde maandag.
- Exporteer beide via de hook return value.

### `src/ui/components/WeekDayList.tsx`

- Nieuwe prop `isCurrentWeek: boolean`.
- Nieuwe prop `onGoToCurrentWeek: () => void`.
- In de navigatiebalk onderaan: render tussen `‹` en `›` een "Nu" knop als `!isCurrentWeek`.
- Stijl: zelfde hoogte als de pijlen, groene achtergrond (`background: #4a7a6a` of bestaande accentkleur), witte tekst, bold 12px, `border-radius: 4px`.

### `src/ui/pages/WeekPage.tsx`

- Geef `week.isCurrentWeek` door als `isCurrentWeek` prop aan `WeekDayList`.
- Geef `week.goToCurrentWeek` door als `onGoToCurrentWeek` prop aan `WeekDayList`.

## Niet gewijzigd

- Domain layer (`src/domain/`)
- Application layer (`src/application/`)
- Infrastructure layer (`src/infrastructure/`)
- Andere componenten of pagina's

## Acceptatiecriteria

1. Als gebruiker op de huidige week zit: geen "Nu" knop zichtbaar.
2. Als gebruiker op een andere week zit: "Nu" knop zichtbaar tussen `‹` en `›`.
3. Na klik op "Nu": app toont de huidige week, maandag is geselecteerd.
4. Na klik: data wordt opnieuw geladen voor de huidige week (via bestaand refresh-mechanisme).
