# Confidence Score 1–5 met kleurgradiënt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang `confidence: number` (0–1 float) door `1 | 2 | 3 | 4 | 5` integer overal in domain, infrastructure en UI, met kleurgradiënt op blokken en een bijgewerkte LLM-prompt die de LLM dwingt bewust over zekerheid na te denken.

**Architecture:** TDD-first: helper-unit-test → domeintype-wijzigingen → infrastructure-prompt-updates → UI-kleuren. TypeScript compile-check (`npm run typecheck`) na elke taak als vangnet voor gemiste call sites.

**Tech Stack:** TypeScript strict, Vitest, React, Tauri

---

## File map

| Bestand | Actie |
|---------|-------|
| `src/domain/usecases/toConfidenceScore.ts` | Nieuw — helper + export |
| `src/domain/usecases/toConfidenceScore.test.ts` | Nieuw — unit tests voor helper |
| `src/domain/entities/ClassifiedBlock.ts` | Wijzig `confidence: number` → `1 \| 2 \| 3 \| 4 \| 5` |
| `src/domain/repositories/ICopilotRepository.ts` | Wijzig `confidence` in `DayClassificationResult` en `PatternBlock` |
| `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts` | Vervang clamp, voeg rubric toe aan prompt |
| `src/infrastructure/copilot/CopilotRepository.ts` | Vervang clamp, voeg rubric toe aan prompt |
| `src/ui/components/DayTimeline.tsx` | Vervang `conceptStatus()` door `confidenceColor()`, badge label |
| `src/ui/pages/BookingModal.tsx` | Badge kleur: altijd-groen → `confidenceColor()` |
| `src/domain/usecases/__tests__/ClassifyHistoryBlocksUseCase.test.ts` | Bijwerken: float → 1–5, clamping-test aanpassen |
| `tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts` | Bijwerken: float → 1–5 |
| `src/infrastructure/copilot/CopilotRepository.test.ts` | Bijwerken: `confidence: 0.9` → `confidence: 4` |
| `src/domain/entities/ClassifiedBlock.test.ts` | Bijwerken: `confidence: 0.9` → `confidence: 4` |
| `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts` | Bijwerken: `confidence: 0.9` → `confidence: 4` |
| `src/ui/components/DayTimeline.helpers.test.ts` | Bijwerken: `confidence: 0.9` → `confidence: 4` |
| `tests/unit/usecases/mergeConceptsIntoTimeline.test.ts` | Bijwerken: `confidence: 0.9` → `confidence: 4` |
| `src/infrastructure/storage/HistoryStore.test.ts` | Bijwerken: `confidence: 0.9` → `confidence: 4` |
| `tests/unit/usecases/HistoryStore.test.ts` | Bijwerken: `confidence: 0.9` → `confidence: 4` |
| `src/domain/usecases/__tests__/ClassifyCalendarBlocksUseCase.test.ts` | Bijwerken: `confidence: 0.8` → `confidence: 4` |
| `tests/unit/domain/HistoryBlock.test.ts` | Bijwerken: `confidence: 0.9` → `confidence: 4` |

---

## Task 1: Helper `toConfidenceScore` — test first

**Files:**
- Create: `src/domain/usecases/toConfidenceScore.ts`
- Create: `src/domain/usecases/toConfidenceScore.test.ts`

- [ ] **Stap 1: Schrijf de failing tests**

Maak `src/domain/usecases/toConfidenceScore.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toConfidenceScore } from './toConfidenceScore'

describe('toConfidenceScore', () => {
  it('geeft 1 terug voor 1', () => {
    expect(toConfidenceScore(1)).toBe(1)
  })
  it('geeft 5 terug voor 5', () => {
    expect(toConfidenceScore(5)).toBe(5)
  })
  it('klampt 0 naar 1', () => {
    expect(toConfidenceScore(0)).toBe(1)
  })
  it('klampt 6 naar 5', () => {
    expect(toConfidenceScore(6)).toBe(5)
  })
  it('rondt 2.7 af naar 3', () => {
    expect(toConfidenceScore(2.7)).toBe(3)
  })
  it('rondt 2.3 af naar 2', () => {
    expect(toConfidenceScore(2.3)).toBe(2)
  })
  it('geeft 1 terug voor NaN', () => {
    expect(toConfidenceScore(NaN)).toBe(1)
  })
  it('geeft 1 terug voor undefined', () => {
    expect(toConfidenceScore(undefined)).toBe(1)
  })
  it('geeft 1 terug voor een string die geen getal is', () => {
    expect(toConfidenceScore('hoog')).toBe(1)
  })
  it('accepteert een string-getal', () => {
    expect(toConfidenceScore('4')).toBe(4)
  })
})
```

- [ ] **Stap 2: Run de tests, verwacht FAIL**

```bash
cd /Users/guus/projects/uren-schrijven && npm run test -- toConfidenceScore
```

Verwacht: module not found of alle tests FAIL.

- [ ] **Stap 3: Implementeer de helper**

Maak `src/domain/usecases/toConfidenceScore.ts`:

```ts
export function toConfidenceScore(raw: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(Number(raw))
  const clamped = isNaN(n) ? 1 : Math.min(5, Math.max(1, n))
  return clamped as 1 | 2 | 3 | 4 | 5
}
```

- [ ] **Stap 4: Run de tests, verwacht PASS**

```bash
cd /Users/guus/projects/uren-schrijven && npm run test -- toConfidenceScore
```

Verwacht: 10/10 PASS.

- [ ] **Stap 5: Commit**

```bash
cd /Users/guus/projects/uren-schrijven && git add src/domain/usecases/toConfidenceScore.ts src/domain/usecases/toConfidenceScore.test.ts && git commit -m "feat: add toConfidenceScore helper (1-5 integer)"
```

---

## Task 2: Domeintypen bijwerken

**Files:**
- Modify: `src/domain/entities/ClassifiedBlock.ts:13`
- Modify: `src/domain/repositories/ICopilotRepository.ts:39,51`

- [ ] **Stap 1: Wijzig `ClassifiedBlock.confidence`**

In `src/domain/entities/ClassifiedBlock.ts`, regel 13:

```ts
// Voor:
confidence: number

// Na:
confidence: 1 | 2 | 3 | 4 | 5
```

- [ ] **Stap 2: Wijzig `PatternBlock.confidence` en `DayClassificationResult.confidence`**

In `src/domain/repositories/ICopilotRepository.ts`:

Regel 39 (in `PatternBlock`):
```ts
// Voor:
confidence: number

// Na:
confidence: 1 | 2 | 3 | 4 | 5
```

Regel 51 (in `DayClassificationResult`):
```ts
// Voor:
confidence: number

// Na:
confidence: 1 | 2 | 3 | 4 | 5
```

- [ ] **Stap 3: Typecheck — verwacht fouten op clamp-sites en tests**

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck 2>&1 | head -60
```

Verwacht: typefouten in `ClassifyHistoryBlocksUseCase.ts`, `CopilotRepository.ts`, en diverse testbestanden. Dit is correct — de volgende taken lossen ze op.

- [ ] **Stap 4: Commit**

```bash
cd /Users/guus/projects/uren-schrijven && git add src/domain/entities/ClassifiedBlock.ts src/domain/repositories/ICopilotRepository.ts && git commit -m "feat: change confidence type to 1|2|3|4|5 in domain"
```

---

## Task 3: Clamp-sites vervangen en LLM-prompts bijwerken

**Files:**
- Modify: `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts:79`
- Modify: `src/infrastructure/copilot/CopilotRepository.ts:203`
- Modify: `src/infrastructure/copilot/CopilotRepository.ts` (classifyDay prompt)

- [ ] **Stap 1: Vervang clamp in `ClassifyHistoryBlocksUseCase.ts`**

In `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts`, voeg bovenaan de imports toe:

```ts
import { toConfidenceScore } from './toConfidenceScore'
```

Vervang regel 79:
```ts
// Voor:
confidence: Math.min(1, Math.max(0, r.confidence)),

// Na:
confidence: toConfidenceScore(r.confidence),
```

- [ ] **Stap 2: Voeg de rubric toe aan de classify-prompt in `ClassifyHistoryBlocksUseCase.ts`**

Zoek in `ClassifyHistoryBlocksUseCase.ts` naar het deel van de prompt-string dat `confidence` beschrijft (zoek op `confidence` in de promptstring). Vervang de bestaande omschrijving door:

```
confidence (integer 1–5):
  5 = Zeer zeker — project, service en tijdstip kloppen precies met de agenda
  4 = Zeker — goede match, klein detail ontbreekt of is afgeleid
  3 = Aannemelijk — patroon klopt, maar meerdere opties waren mogelijk
  2 = Twijfelachtig — weinig bewijs, gok op basis van context
  1 = Onzeker — geen duidelijke match, vul in als best guess

Overweeg actief welke score van toepassing is. Geef niet standaard een hoge score.
```

- [ ] **Stap 3: Vervang clamp in `CopilotRepository.ts`**

Voeg bovenaan `CopilotRepository.ts` de import toe (of in de sectie waar de classify-functies staan):

```ts
import { toConfidenceScore } from '../../domain/usecases/toConfidenceScore'
```

Vervang regel 203:
```ts
// Voor:
confidence: Math.min(1, Math.max(0, match?.confidence ?? 0)),

// Na:
confidence: toConfidenceScore(match?.confidence),
```

- [ ] **Stap 4: Voeg de rubric toe aan de `classifyDay`-prompt in `CopilotRepository.ts`**

Zoek in de `classifyDay`-methode (vanaf regel 215) naar het deel van de promptstring dat `confidence` beschrijft. Vervang door dezelfde rubric als in stap 2.

- [ ] **Stap 5: Run de volledige testsuite**

```bash
cd /Users/guus/projects/uren-schrijven && npm run test 2>&1 | tail -30
```

Verwacht: testfouten in de testbestanden die nog `0.9` of `0.85` als confidence gebruiken. De twee `ClassifyHistoryBlocksUseCase`-tests die de clamping controleren falen ook — die worden in Task 4 gefixed.

- [ ] **Stap 6: Commit**

```bash
cd /Users/guus/projects/uren-schrijven && git add src/domain/usecases/ClassifyHistoryBlocksUseCase.ts src/infrastructure/copilot/CopilotRepository.ts && git commit -m "feat: replace confidence clamp with toConfidenceScore, update LLM prompts"
```

---

## Task 4: Testbestanden bijwerken

**Files:**
- Modify: `src/domain/usecases/__tests__/ClassifyHistoryBlocksUseCase.test.ts`
- Modify: `tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts`
- Modify: `src/infrastructure/copilot/CopilotRepository.test.ts`
- Modify: `src/domain/entities/ClassifiedBlock.test.ts`
- Modify: `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts`
- Modify: `src/ui/components/DayTimeline.helpers.test.ts`
- Modify: `tests/unit/usecases/mergeConceptsIntoTimeline.test.ts`
- Modify: `src/infrastructure/storage/HistoryStore.test.ts`
- Modify: `tests/unit/usecases/HistoryStore.test.ts`
- Modify: `src/domain/usecases/__tests__/ClassifyCalendarBlocksUseCase.test.ts`
- Modify: `tests/unit/domain/HistoryBlock.test.ts`

Vuistregel: alle `confidence: 0.x` of `confidence: 1.0` in testbestanden worden vervangen door een integer in het bereik 1–5. Gebruik `4` als algemene vervanging tenzij de test een specifieke waarde nodig heeft.

- [ ] **Stap 1: Bijwerken `src/domain/usecases/__tests__/ClassifyHistoryBlocksUseCase.test.ts`**

Dit bestand heeft de meest specifieke logica. Zoek de test `'clamps confidence to [0, 1]'` (rond regel 68) en pas hem aan:

```ts
// Voor (rond regel 68–73):
it('clamps confidence to [0, 1]', async () => {
  // mock die confidence: 1.5 teruggeeft
  ...
  expect(result[0]!.confidence).toBe(1)
})

// Na:
it('klampt confidence naar [1, 5]', async () => {
  // mock die confidence: 8 teruggeeft
  ...
  expect(result[0]!.confidence).toBe(5)
})
```

Vervang ook `confidence: 0.9` op regel 40 door `confidence: 4`.

- [ ] **Stap 2: Bijwerken `tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts`**

Zoek alle `confidence:` waarden:
- Regel 45: `expect(result[0]!.confidence).toBe(1.0)` → `toBe(5)` (of pas de mock aan zodat die `5` retourneert)
- Regel 58: `confidence: 0.85` → `confidence: 4`
- Regel 71: `expect(result[0]!.confidence).toBe(0.85)` → `toBe(4)`
- Regel 97: `confidence: 0.7` → `confidence: 3`

- [ ] **Stap 3: Bijwerken overige testbestanden**

In elk van de volgende bestanden: vervang elke `confidence: 0.x` of `confidence: 1.0` door `confidence: 4`:

- `src/infrastructure/copilot/CopilotRepository.test.ts` (regel 16)
- `src/domain/entities/ClassifiedBlock.test.ts` (regels 19, 40)
- `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts` (regel 38)
- `src/ui/components/DayTimeline.helpers.test.ts` (regel 105)
- `tests/unit/usecases/mergeConceptsIntoTimeline.test.ts` (regel 19)
- `src/infrastructure/storage/HistoryStore.test.ts` (regels 41, 62)
- `tests/unit/usecases/HistoryStore.test.ts` (regel 31)
- `src/domain/usecases/__tests__/ClassifyCalendarBlocksUseCase.test.ts` (regel 28)
- `tests/unit/domain/HistoryBlock.test.ts` (regels 34, 38 — ook de `expect` bijwerken naar `toBe(4)`)

- [ ] **Stap 4: Run de volledige testsuite**

```bash
cd /Users/guus/projects/uren-schrijven && npm run test 2>&1 | tail -30
```

Verwacht: alle tests PASS (168+ tests).

- [ ] **Stap 5: Typecheck**

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck
```

Verwacht: geen fouten meer in de domain/infrastructure laag. Mogelijk nog UI-fouten (volgende taak).

- [ ] **Stap 6: Commit**

```bash
cd /Users/guus/projects/uren-schrijven && git add -A && git commit -m "test: update confidence values from float to 1-5 integer"
```

---

## Task 5: UI — `DayTimeline.tsx` kleurgradiënt en badge

**Files:**
- Modify: `src/ui/components/DayTimeline.tsx:23–33,178–192`

- [ ] **Stap 1: Vervang `conceptStatus()` en `CONCEPT_STYLES` door `confidenceColor()`**

In `src/ui/components/DayTimeline.tsx`, vervang regels 23–33:

```ts
// Voor:
function conceptStatus(block: ClassifiedBlock): 'ok' | 'warn' | 'low' {
  if (!block.projectId || !block.serviceId) return 'warn'
  if (block.confidence < 0.6) return 'low'
  return 'ok'
}

const CONCEPT_STYLES = {
  ok:   { bg: 'bg-[#1a2a1a]', border: 'border border-dashed border-[#5a8a6a]', sub: 'text-[#5a8a6a]', badge: 'bg-[#1a3a1a] text-[#5a8a6a]' },
  warn: { bg: 'bg-[#2a2010]', border: 'border border-dashed border-[#a07848]', sub: 'text-[#a07848]', badge: 'bg-[#3a2e10] text-[#a07848]' },
  low:  { bg: 'bg-[#2a1010]', border: 'border border-dashed border-[#8a3a3a]', sub: 'text-[#8a3a3a]', badge: 'bg-[#3a1010] text-[#8a3a3a]' },
}

// Na:
const CONFIDENCE_COLORS: Record<1 | 2 | 3 | 4 | 5, { bg: string; border: string; sub: string; badge: string }> = {
  5: { bg: 'bg-[#1a2a1a]', border: 'border border-dashed border-[#5a8a6a]', sub: 'text-[#5a8a6a]', badge: 'bg-[#1a3a1a] text-[#5a8a6a]' },
  4: { bg: 'bg-[#1e2a18]', border: 'border border-dashed border-[#6a8a50]', sub: 'text-[#6a8a50]', badge: 'bg-[#203018] text-[#6a8a50]' },
  3: { bg: 'bg-[#2a2510]', border: 'border border-dashed border-[#8a7a40]', sub: 'text-[#8a7a40]', badge: 'bg-[#332e10] text-[#8a7a40]' },
  2: { bg: 'bg-[#2a1c10]', border: 'border border-dashed border-[#a06030]', sub: 'text-[#a06030]', badge: 'bg-[#332210] text-[#a06030]' },
  1: { bg: 'bg-[#2a1010]', border: 'border border-dashed border-[#8a3a3a]', sub: 'text-[#8a3a3a]', badge: 'bg-[#3a1010] text-[#8a3a3a]' },
}

const WARN_STYLE = { bg: 'bg-[#2a2010]', border: 'border border-dashed border-[#a07848]', sub: 'text-[#a07848]', badge: 'bg-[#3a2e10] text-[#a07848]' }

function blockStyle(block: ClassifiedBlock) {
  if (!block.projectId || !block.serviceId) return WARN_STYLE
  return CONFIDENCE_COLORS[block.confidence]
}
```

- [ ] **Stap 2: Vervang gebruik van `conceptStatus` en `CONCEPT_STYLES` in de render**

In `src/ui/components/DayTimeline.tsx`, vervang regels 177–182:

```tsx
// Voor:
if (block.type === 'concept') {
  const status = conceptStatus(block.block)
  const s = CONCEPT_STYLES[status]
  const badgeLabel = block.block.origin === 'cache'
    ? 'Cache'
    : `${Math.round(block.block.confidence * 100)}% zeker`

// Na:
if (block.type === 'concept') {
  const s = blockStyle(block.block)
  const badgeLabel = block.block.origin === 'cache'
    ? 'Cache'
    : `${block.block.confidence}/5`
```

- [ ] **Stap 3: Typecheck**

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck 2>&1 | grep DayTimeline
```

Verwacht: geen fouten voor DayTimeline.

- [ ] **Stap 4: Commit**

```bash
cd /Users/guus/projects/uren-schrijven && git add src/ui/components/DayTimeline.tsx && git commit -m "feat: replace conceptStatus with confidence color gradient in DayTimeline"
```

---

## Task 6: UI — `BookingModal.tsx` badge kleur

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx:30–38`

- [ ] **Stap 1: Voeg `confidenceColor` helper toe en vervang altijd-groen badge**

In `src/ui/pages/BookingModal.tsx`, voeg bovenaan (na de imports) toe:

```ts
const CONFIDENCE_BG: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: '#1a3a1a',
  4: '#203018',
  3: '#332e10',
  2: '#332210',
  1: '#3a1010',
}

const CONFIDENCE_TEXT: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: '#5a8a6a',
  4: '#6a8a50',
  3: '#8a7a40',
  2: '#a06030',
  1: '#8a3a3a',
}
```

Vervang regels 30–38:

```ts
// Voor:
const confidenceBadge = evidenceBlock
  ? {
      label: evidenceBlock.origin === 'cache'
        ? 'Cache'
        : `${Math.round(evidenceBlock.confidence * 100)}% zeker`,
      bg: '#1a3a1a',
      color: '#5a8a6a',
    }
  : null

// Na:
const confidenceBadge = evidenceBlock
  ? {
      label: evidenceBlock.origin === 'cache'
        ? 'Cache'
        : `${evidenceBlock.confidence}/5`,
      bg: evidenceBlock.origin === 'cache' ? '#1a3a1a' : CONFIDENCE_BG[evidenceBlock.confidence],
      color: evidenceBlock.origin === 'cache' ? '#5a8a6a' : CONFIDENCE_TEXT[evidenceBlock.confidence],
    }
  : null
```

- [ ] **Stap 2: Typecheck**

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck 2>&1 | grep BookingModal
```

Verwacht: geen fouten voor BookingModal.

- [ ] **Stap 3: Commit**

```bash
cd /Users/guus/projects/uren-schrijven && git add src/ui/pages/BookingModal.tsx && git commit -m "feat: apply confidence color gradient to BookingModal badge"
```

---

## Task 7: Finale verificatie

- [ ] **Stap 1: Volledige testsuite**

```bash
cd /Users/guus/projects/uren-schrijven && npm run test
```

Verwacht: alle tests PASS, geen failures.

- [ ] **Stap 2: Volledige typecheck**

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Lint**

```bash
cd /Users/guus/projects/uren-schrijven && npm run lint 2>&1 | grep -v "warning\|pre-existing" | head -20
```

Verwacht: geen nieuwe fouten (pre-existing WeekPage.tsx errors zijn acceptabel).

- [ ] **Stap 4: Commit**

Als alles groen is:

```bash
cd /Users/guus/projects/uren-schrijven && git add -A && git commit -m "chore: confidence 1-5 feature complete — all tests pass"
```
