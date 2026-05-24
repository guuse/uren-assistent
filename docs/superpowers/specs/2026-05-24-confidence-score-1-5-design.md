# Design: Confidence Score 1–5 met kleurgradiënt

**Datum:** 2026-05-24  
**Status:** Goedgekeurd

---

## Doel

Vervang de huidige `confidence: number` (0.0–1.0 float) door een expliciete `1 | 2 | 3 | 4 | 5` integer schaal. Maak de score zichtbaar als kleurgradiënt op blokken (groen = zeker, rood = onzeker). Dwing de LLM om actief over zekerheid na te denken via een expliciete rubric.

---

## Scope

- Domain types: `ClassifiedBlock`, `DayClassificationResult`, `PatternBlock`
- Infrastructure: LLM-prompt in `CopilotRepository.ts` en `ClassifyHistoryBlocksUseCase.ts`
- UI: `DayTimeline.tsx` en `BookingModal.tsx`
- Tests: bestaande use case tests bijwerken, helper unit tests toevoegen

---

## Section 1: Domain types

### Gewijzigde typen

**`src/domain/entities/ClassifiedBlock.ts`**
```ts
confidence: 1 | 2 | 3 | 4 | 5
```

**`src/domain/repositories/ICopilotRepository.ts`**
```ts
// DayClassificationResult
confidence: 1 | 2 | 3 | 4 | 5

// PatternBlock
confidence: 1 | 2 | 3 | 4 | 5
```

### Parse-en-clamp helper

Beide bestaande clamp-sites worden vervangen door één gedeelde helper (in een utility module of inline):

```ts
function toConfidenceScore(raw: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(Number(raw))
  return (Math.min(5, Math.max(1, isNaN(n) ? 1 : n)) as 1 | 2 | 3 | 4 | 5)
}
```

De helper komt in `src/domain/usecases/toConfidenceScore.ts` (één export, nul dependencies).

**Bestaande clamp-sites:**
- `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts:79` — `Math.min(1, Math.max(0, r.confidence))` → `toConfidenceScore(r.confidence)`
- `src/infrastructure/copilot/CopilotRepository.ts:203` — `Math.min(1, Math.max(0, match?.confidence ?? 0))` → `toConfidenceScore(match?.confidence)`

---

## Section 2: LLM-prompt

### Rubric voor `classifyDay` (CopilotRepository.ts)

Vervang de bestaande confidence-instructie door:

```
confidence (integer 1–5):
  5 = Zeer zeker — project, service en tijdstip kloppen precies met de agenda
  4 = Zeker — goede match, klein detail ontbreekt of is afgeleid
  3 = Aannemelijk — patroon klopt, maar meerdere opties waren mogelijk
  2 = Twijfelachtig — weinig bewijs, gok op basis van context
  1 = Onzeker — geen duidelijke match, vul in als best guess

Overweeg actief welke score van toepassing is. Geef niet standaard een hoge score.
```

Dezelfde rubric wordt toegevoegd aan de prompt in `ClassifyHistoryBlocksUseCase.ts`.

---

## Section 3: UI — kleurgradiënt en badge

### Kleurgradiënt

`conceptStatus()` in `DayTimeline.tsx` wordt vervangen door `confidenceColor()`:

```ts
function confidenceColor(score: 1 | 2 | 3 | 4 | 5): { bg: string; border: string; text: string } {
  const colors: Record<1 | 2 | 3 | 4 | 5, { bg: string; border: string; text: string }> = {
    5: { bg: '#1a2a1a', border: '#5a8a6a', text: '#5a8a6a' }, // groen
    4: { bg: '#1e2a18', border: '#6a8a50', text: '#6a8a50' }, // geel-groen
    3: { bg: '#2a2510', border: '#8a7a40', text: '#8a7a40' }, // geel
    2: { bg: '#2a1c10', border: '#a06030', text: '#a06030' }, // oranje
    1: { bg: '#2a1010', border: '#8a3a3a', text: '#8a3a3a' }, // rood
  }
  return colors[score]
}
```

### `warn`-state blijft apart

Als een blok geen `projectId` of `serviceId` heeft, overschrijft de amber kleur (`#a07848`) de confidence-kleur. Dit is onafhankelijk van de confidence score.

### Badge label

| Situatie | Badge |
|----------|-------|
| `origin === 'cache'` | `"Cache"` |
| anders | `"3/5"` (score als integer) |

### BookingModal

`BookingModal.tsx` krijgt dezelfde `confidenceColor()` logica. Het huidige altijd-groen gedrag wordt vervangen.

---

## Section 4: Testing

- **Unit test** voor `toConfidenceScore()`: correcte clamping (0 → 1, 6 → 5), rounding (2.7 → 3), NaN-handling (→ 1)
- **Bestaande use case tests** die `ClassifiedBlock` of `DayClassificationResult` aanmaken met float confidence: bijwerken naar integer 1–5
- Geen nieuwe UI-component tests nodig (wijziging is cosmetisch)
- `npm run typecheck` vangt gemiste call sites op compile-tijd

---

## Betrokken bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/domain/entities/ClassifiedBlock.ts` | `confidence: number` → `1 \| 2 \| 3 \| 4 \| 5` |
| `src/domain/repositories/ICopilotRepository.ts` | `confidence` in `DayClassificationResult` en `PatternBlock` |
| `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts` | Clamp → `toConfidenceScore()`, prompt rubric |
| `src/infrastructure/copilot/CopilotRepository.ts` | Clamp → `toConfidenceScore()`, prompt rubric |
| `src/ui/components/DayTimeline.tsx` | `conceptStatus()` → `confidenceColor()`, badge label |
| `src/ui/pages/BookingModal.tsx` | Badge kleur: altijd-groen → `confidenceColor()` |
| Tests die `confidence` gebruiken | Float → integer 1–5 |
