# Design: Uur-entry bijwerken (tijd + project)

**Datum:** 2026-05-25  
**Status:** Goedgekeurd

## Probleem

`BookingModal` opent correct pre-filled voor bewerking (inclusief `id`), maar de "Opslaan" knop roept altijd `bookHours.execute()` aan — die POSTt een nieuwe entry. Wijzigen van tijd of project resulteert daardoor in een duplicaat.

## Oplossing

`PUT /hours/hours/{id}` met dezelfde body als POST. In `useBooking.book()` branchen op `initial.id`: aanwezig → update, afwezig → nieuw aanmaken.

## Architectuur

```
BookingModal (UI)
  → useBooking.book() (UI)
    → UpdateHourEntryUseCase (Domain) — als entry.id aanwezig
    → BookHoursUseCase (Domain)       — als entry.id afwezig
      → ISimplicateRepository.updateHourEntry (Domain interface)
        ← SimplicateRepository.updateHourEntry (Infrastructure)
          ← PUT /hours/hours/:id via Tauri IPC
```

## Wijzigingen per laag

### Domain

**`src/domain/repositories/ISimplicateRepository.ts`**
- Voeg toe: `updateHourEntry(entry: HourEntry): Promise<void>`

**`src/domain/usecases/UpdateHourEntryUseCase.ts`** (nieuw)
- Valideert dat `entry.id` aanwezig is
- Valideert dezelfde verplichte velden als `BookHoursUseCase` (`employeeId`, `projectId`, `projectServiceId`, `hourTypeId`, `startDate`, `startTime`, `endTime`)
- Roept `simplicateRepo.updateHourEntry(entry)` aan

### Infrastructure

**`src/infrastructure/simplicate/SimplicateRepository.ts`**
- Voeg `private async put(path, body)` helper toe (na de `delete` helper) — zelfde structuur als `post`, maar `method: 'PUT'`
- Implementeer `updateHourEntry(entry: HourEntry)`: `PUT /hours/hours/${encodeURIComponent(entry.id!)}` met dezelfde body-shape als `bookHours`

### Application

**`src/application/container.ts`**
- Registreer `updateHourEntry: new UpdateHourEntryUseCase(simplicateRepo)` in `createUseCases`

### UI

**`src/ui/hooks/useBooking.ts`**
- In `book()`: voeg if-else toe op `initial.id`
  - Aanwezig: bouw `HourEntry` met `id` en roep `updateHourEntry.execute(entry)` aan
  - Afwezig: bestaand pad (`bookHours.execute(entry)`)

**`src/ui/pages/BookingModal.tsx`**
- Success message: "Uren bijgewerkt!" als `initialEntry.id` aanwezig, anders "Uren geboekt!" (was hard-coded "Uren geboekt!" voor beide)
- Geen andere UI-wijzigingen — de "Opslaan" knop en het formulier werken al correct

## Foutafhandeling

- Ontbrekend id of verplicht veld: use case gooit fout vóór API-aanroep
- API-fout (bijv. Simplicate accepteert het veld niet): foutmelding in modal, modal blijft open
- Zelfde foutpad als bestaande boeking-errors

## Testing

- Unit test `UpdateHourEntryUseCase`: valideert id-check, veldvalidatie, succesvol pad, foutpad
- `SimplicateRepository.updateHourEntry`: mock Tauri IPC, controleer PUT endpoint + correcte body
- `useBooking.book()`: branching op `initial.id` — update-pad en nieuw-pad

## Niet in scope

- Aparte "Bewerken" modus of UI-indicator dat je een bestaande boeking aan het bewerken bent
- Optimistic UI updates
