# Design: Dag-selectie via maand-overzicht popup

**Datum:** 2026-05-25

## Samenvatting

Voeg een kalenderknop toe aan de week-navigatiebalk in de zijbalk. Bij klik verschijnt een maand-overzicht popup waarmee de gebruiker snel naar een dag ver in het verleden kan navigeren. Per klik op een dag springt de app naar de week van die dag en selecteert die dag.

## Gedrag

- **Trigger:** Een kalenderknop (lucide-react `CalendarDays` icoon) in de navigatiebalk naast de `‹`/`›`/`Nu` knoppen.
- **Popup openen:** Klik op de kalenderknop toont de `MonthPickerPopup`.
- **Popup sluiten:** Klik buiten de popup, of klik op een dag.
- **Maand navigeren:** `‹` / `›` pijlen in de popup-header scrollen één maand per klik. Header toont "mei 2024".
- **Dag selecteren:** Klik op een werkdag (ma–vr). De popup sluit, de app springt naar de week van die dag en selecteert die dag.
- **Weekenddagen:** Zichtbaar in de kalender maar grijs en niet-klikbaar.
- **Beginmaand:** De popup opent op de maand van de huidig geselecteerde week.

## Componenten

### Nieuw: `src/ui/components/MonthPickerPopup.tsx`

Zelfstandig component. Props:
```typescript
interface Props {
  initialMonth: string   // YYYY-MM-DD van de eerste dag van de startmaand
  onSelectDate: (date: string) => void
  onClose: () => void
}
```

Interne state:
- `viewMonth: string` — de maand die getoond wordt (YYYY-MM-DD van de eerste van de maand), geïnitialiseerd vanuit `initialMonth`.

Rendert:
- Header met maandnaam + jaar, `‹` en `›` knoppen
- Grid van 7 kolommen (ma t/m zo), met dagnamen als headers
- Dagen als knoppen; werkdagen klikbaar, weekenddagen disabled + grijs
- Klik buiten (overlay) roept `onClose` aan

### Aangepast: `src/ui/components/WeekDayList.tsx`

Nieuwe props:
```typescript
onGoToDate?: (date: string) => void
```

Lokale state:
- `isPickerOpen: boolean` — beheert zichtbaarheid van de popup

Navigatiebalk: kalenderknopje (uiterst links of rechts van de `‹`/`›`/`Nu` rij), altijd zichtbaar als `onGoToDate` aanwezig is. Bij klik: `setIsPickerOpen(true)`.

Rendert `<MonthPickerPopup>` als `isPickerOpen && onGoToDate`.

`MonthPickerPopup` ontvangt:
- `initialMonth`: de eerste dag van de maand van `selectedWeekStart`, bijv. als `selectedWeekStart` = `2024-05-06` dan is `initialMonth` = `2024-05-01`
- `onSelectDate`: roept `onGoToDate` aan en zet `setIsPickerOpen(false)`
- `onClose`: zet `setIsPickerOpen(false)`

### Aangepast: `src/ui/hooks/useWeek.ts`

Nieuwe functie:
```typescript
function goToDate(date: string) {
  setSelectedWeekStart(getMondayOf(new Date(date + 'T00:00:00')))
  setSelectedDate(date)
}
```

Geëxporteerd in return value.

### Aangepast: `src/ui/pages/WeekPage.tsx`

Geeft `week.goToDate` door als `onGoToDate` prop aan `WeekDayList`.

## Niet gewijzigd

- Domain layer, application layer, infrastructure layer
- Andere componenten of pagina's

## Acceptatiecriteria

1. Kalenderknop zichtbaar in navigatiebalk.
2. Klik op knop: popup verschijnt op de maand van de huidige geselecteerde week.
3. `‹`/`›` in popup: navigeert één maand voor/achter.
4. Klik op werkdag: popup sluit, app toont week van die dag, die dag geselecteerd.
5. Klik op weekenddag: geen actie.
6. Klik buiten popup: popup sluit, selectie ongewijzigd.
