# Design: LLM Blokken Opschonen per Dag

**Datum:** 2026-05-25  
**Status:** Goedgekeurd

---

## Samenvatting

Voeg een prullenbak-icoon toe per dag in de `WeekDayList` sidebar waarmee de gebruiker alle ongebookte LLM-conceptblokken van die dag kan verwijderen. Geschreven uren in Simplicate blijven altijd staan. Na verwijdering reset de dag-status naar "niet verwerkt".

---

## Scope

**In scope:**
- Verwijderen van ongebookte `ClassifiedBlock` entries met `origin === 'llm' || origin === 'llm-pattern'` uit de lokale `IHistoryStore`
- Prullenbak-icoon per dag in `WeekDayList`
- Bevestigingsdialoog met aantal blokken en duidelijke melding dat geschreven uren blijven staan
- Dag-status reset naar "niet verwerkt" na opschonen

**Buiten scope:**
- Week-niveau opschonen
- Verwijderen van geboekte uren in Simplicate (niet mogelijk via API)
- Verwijderen van calendar- of manual-blokken

---

## Architectuur

Volgt clean architecture conform `AGENTS.md`. Dependencies wijzen alleen naar binnen.

### Domain layer

**Nieuw:** `src/domain/usecases/ClearDayBlocksUseCase.ts`

```ts
interface ClearDayBlocksResult {
  removedCount: number
}

class ClearDayBlocksUseCase {
  constructor(private historyStore: IHistoryStore) {}

  async execute(date: string): Promise<ClearDayBlocksResult>
}
```

Logica:
1. Haal alle blokken op via `historyStore.getBlocks(date)`
2. Filter: `origin === 'llm' || origin === 'llm-pattern'` én geen `bookedAt`
3. Verwijder elk gefilterd blok via `historyStore.removeBlock(date, block.urlPattern)`
4. Geef `{ removedCount }` terug

**IHistoryStore:** Controleer of `removeBlock(date, urlPattern)` al bestaat. Zo niet, voeg toe. Geen nieuwe bulk-methode nodig — loop over individuele removes.

### Application layer

Registreer `ClearDayBlocksUseCase` in `src/application/container.ts`.

### UI layer

**Nieuwe hook:** `src/ui/hooks/useClearDayBlocks.ts`
- Roept `ClearDayBlocksUseCase` aan via container
- Beheert `isClearing: boolean` per dag
- Triggert week data refresh na succes (via bestaande refresh-mechanisme)

**Gewijzigd:** `src/ui/components/WeekDayList.tsx`
- Voeg Lucide `Trash2` icoon toe per dag-rij (rechts uitlijnen)
- Rood + klikbaar als er ongebookte LLM-blokken zijn (`count > 0`)
- Grijs + `disabled` als `count === 0`
- `onClick` opent `ConfirmDialog`

**Nieuw:** `src/ui/components/ConfirmDialog.tsx`
- Props: `title: string`, `description: string`, `onConfirm: () => void`, `onCancel: () => void`, `isLoading?: boolean`
- Eenvoudige modal met Annuleren / Verwijderen knoppen
- Verwijderen-knop rood, disabled tijdens loading

---

## Data flow

```
User klikt prullenbak
  → ConfirmDialog opent (toont count ongebookte LLM-blokken)
  → User bevestigt
    → useClearDayBlocks.execute(date)
      → ClearDayBlocksUseCase
        → IHistoryStore.getBlocks(date)
        → filter llm + ongebookt
        → IHistoryStore.removeBlock() per blok
      → week data refresh
      → dag ziet eruit als "niet verwerkt" (geen blokken meer)
```

---

## Dag-status reset

De dag-status in `WeekDayList` wordt afgeleid van de aanwezige blokken in de history store. Als alle LLM-blokken zijn verwijderd, toont de dag automatisch "niet verwerkt". Geen aparte state-veld nodig.

---

## Bevestigingsdialoog

Tekst:
- **Titel:** `LLM-blokken verwijderen?`
- **Body:** `{n} ongebookte LLM-concepten van {dag} worden verwijderd. Geschreven uren blijven staan.`
- **Knoppen:** Annuleren | Verwijderen (rood)

---

## Testing

- Unit test `ClearDayBlocksUseCase`:
  - Verwijdert alleen blokken met origin `llm`/`llm-pattern` zonder `bookedAt`
  - Laat blokken met andere origin ongemoeid
  - Laat geboekte LLM-blokken ongemoeid
  - Geeft correct `removedCount` terug
- Mock `IHistoryStore` via `vi.mock`

---

## Bestanden overzicht

| Actie | Bestand |
|---|---|
| Nieuw | `src/domain/usecases/ClearDayBlocksUseCase.ts` |
| Nieuw | `src/ui/hooks/useClearDayBlocks.ts` |
| Nieuw | `src/ui/components/ConfirmDialog.tsx` |
| Gewijzigd | `src/ui/components/WeekDayList.tsx` |
| Gewijzigd | `src/application/container.ts` |
| Gewijzigd | `src/domain/repositories/IHistoryStore.ts` (indien nodig) |
| Nieuw | `src/domain/usecases/ClearDayBlocksUseCase.test.ts` |
