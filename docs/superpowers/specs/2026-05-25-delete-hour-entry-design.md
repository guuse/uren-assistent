# Design: Verwijder boeking uit Simplicate

**Datum:** 2026-05-25  
**Status:** Goedgekeurd

## Doel

Een bestaande uur-entry in Simplicate kunnen verwijderen vanuit de BookingModal, met een two-step bevestiging om per ongeluk verwijderen te voorkomen.

## Architectuur

Volgt Clean Architecture — dependencies wijzen alleen naar binnen.

```
BookingModal (UI)
  → useBooking hook (UI)
    → DeleteHourEntryUseCase (Domain)
      → ISimplicateRepository.deleteHourEntry (Domain interface)
        ← SimplicateRepository.deleteHourEntry (Infrastructure)
          ← DELETE /hours/hours/:id via Tauri IPC
```

## Wijzigingen per laag

### Domain

**`src/domain/repositories/ISimplicateRepository.ts`**
- Voeg toe: `deleteHourEntry(id: string): Promise<void>`

**`src/domain/usecases/DeleteHourEntryUseCase.ts`** (nieuw)
- Valideert dat `id` een niet-lege string is
- Roept `simplicateRepo.deleteHourEntry(id)` aan
- Gooit een fout bij ontbrekend id

### Infrastructure

**`src/infrastructure/simplicate/SimplicateRepository.ts`**
- Implementeer `deleteHourEntry(id: string): Promise<void>`
- Gebruikt Tauri IPC: `invoke('simplicate_request', { method: 'DELETE', path: `/hours/hours/${id}` })`
- Zelfde patroon als bestaande methoden

### Application

**`src/application/container.ts`**
- Registreer `DeleteHourEntryUseCase` met de bestaande `simplicateRepo`

### UI

**`src/ui/hooks/useBooking.ts`**
- Voeg `deleteEntry(id: string): Promise<void>` toe
- Haalt credentials op via keychain (zelfde patroon als `book()`)
- Roept `deleteHourEntry.execute(id)` aan
- Bij succes: roept callback `onDeleted?.()` aan

**`src/ui/pages/BookingModal.tsx`**
- Voeg prop toe: `onDeleted?: () => void`
- Toont verwijderknop alleen als `entry?.id` aanwezig is
- Lokale state: `deleteState: 'idle' | 'confirm'`
  - `idle`: rode "Verwijderen" knop
  - Na eerste klik → `confirm`: knop wordt "Zeker weten?" (oranje/andere stijl)
  - Timeout van 3 seconden: reset automatisch naar `idle` als niet bevestigd
  - Tweede klik: voert `deleteEntry(entry.id)` uit
- Tijdens verwijdering: knop disabled + loading indicator
- Bij succes: modal sluiten, `onDeleted?.()` aanroepen
- Bij fout: foutmelding tonen, modal blijft open, state reset naar `idle`

## Foutafhandeling

- Ontbrekend id: use case gooit fout vóór API-aanroep
- API-fout: wordt getoond in modal (zelfde patroon als boekingsfouten)
- Netwerkfout: idem

## Testing

- Unit test `DeleteHourEntryUseCase`: valideert id-check, mock repo, succesvol pad en foutpad
- `SimplicateRepository.deleteHourEntry`: mock Tauri IPC, controleer juist endpoint
- `BookingModal`: test two-step state machine (idle → confirm → idle na timeout, idle → confirm → deleted)

## Niet in scope

- Verwijderknop op tijdlijn-blokjes (toekomstige uitbreiding)
- Ongedaan maken na verwijdering
