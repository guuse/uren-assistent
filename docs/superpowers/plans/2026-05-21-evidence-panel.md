# Evidence Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toon de ruwe browser data (URLs + paginatitels) waarop de LLM zijn classificatie baseerde, bovenaan de `ImportBlockModal`, zodat de gebruiker het voorstel kan beoordelen zonder een apart venster te openen.

**Architecture:** `ClassifiedBlock` krijgt twee nieuwe optionele velden (`rawTitles`, `rawUrls`). `CopilotRepository` vult die velden vanuit de al-beschikbare input data na elke LLM classificatie. `ImportBlockModal` toont ze in een nieuw `EvidencePanel` component bovenaan de modal.

**Tech Stack:** TypeScript strict, React, Tailwind CSS (via className), Vitest voor unit tests

---

## File Map

| Bestand | Actie | Wat |
|---|---|---|
| `src/domain/entities/ClassifiedBlock.ts` | Modify | `rawTitles?: string[]` en `rawUrls?: string[]` toevoegen |
| `src/infrastructure/copilot/CopilotRepository.ts` | Modify | Velden vullen in `classify()` en `classifyDay()` |
| `src/ui/components/EvidencePanel.tsx` | Create | Nieuw component dat ruwe data toont |
| `src/ui/components/ImportBlockModal.tsx` | Modify | `EvidencePanel` toevoegen bovenaan de modal |

---

## Task 1: Extend ClassifiedBlock domain entity

**Files:**
- Modify: `src/domain/entities/ClassifiedBlock.ts`
- Test: `src/domain/entities/ClassifiedBlock.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Maak `src/domain/entities/ClassifiedBlock.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest'
import type { ClassifiedBlock } from './ClassifiedBlock'

describe('ClassifiedBlock', () => {
  it('allows rawTitles and rawUrls to be undefined', () => {
    const block: ClassifiedBlock = {
      urlPattern: 'github.com',
      urls: ['https://github.com/org/repo'],
      titles: ['repo'],
      visitCount: 3,
      hours: 1,
      date: '2026-05-21',
      firstVisitTime: '09:00',
      lastVisitTime: '10:00',
      blockName: 'GitHub',
      summary: 'Code review',
      startTime: '09:00',
      endTime: '10:00',
      confidence: 0.9,
      origin: 'llm',
    }
    expectTypeOf(block.rawTitles).toEqualTypeOf<string[] | undefined>()
    expectTypeOf(block.rawUrls).toEqualTypeOf<string[] | undefined>()
  })

  it('accepts rawTitles and rawUrls when provided', () => {
    const block: ClassifiedBlock = {
      urlPattern: 'github.com',
      urls: ['https://github.com/org/repo'],
      titles: ['repo'],
      visitCount: 3,
      hours: 1,
      date: '2026-05-21',
      firstVisitTime: '09:00',
      lastVisitTime: '10:00',
      blockName: 'GitHub',
      summary: 'Code review',
      startTime: '09:00',
      endTime: '10:00',
      confidence: 0.9,
      origin: 'llm',
      rawTitles: ['Pull Request #42 · org/repo', 'Files changed · Pull Request #42'],
      rawUrls: ['github.com/org/repo/pull/42', 'github.com/org/repo/pull/42/files'],
    }
    expectTypeOf(block.rawTitles).toEqualTypeOf<string[] | undefined>()
    expectTypeOf(block.rawUrls).toEqualTypeOf<string[] | undefined>()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/domain/entities/ClassifiedBlock.test.ts
```

Verwacht: FAIL — `rawTitles` en `rawUrls` bestaan nog niet op het type.

- [ ] **Step 3: Add fields to ClassifiedBlock**

Vervang de inhoud van `src/domain/entities/ClassifiedBlock.ts`:

```ts
import type { HistoryBlock } from './HistoryBlock'

export interface ClassifiedBlock extends HistoryBlock {
  blockName: string
  summary: string
  startTime: string
  endTime: string
  projectId?: string
  serviceId?: string
  note?: string
  confidence: number
  origin: 'llm' | 'cache' | 'manual' | 'calendar'
  overlappingMeetings?: import('./CalendarEvent').CalendarEvent[]
  rawTitles?: string[]
  rawUrls?: string[]
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- src/domain/entities/ClassifiedBlock.test.ts
```

Verwacht: PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/ClassifiedBlock.ts src/domain/entities/ClassifiedBlock.test.ts
git commit -m "feat(domain): add rawTitles and rawUrls to ClassifiedBlock"
```

---

## Task 2: Fill rawTitles and rawUrls in CopilotRepository

**Files:**
- Modify: `src/infrastructure/copilot/CopilotRepository.ts`
- Test: `src/infrastructure/copilot/CopilotRepository.test.ts` (create)

De ruwe data zit al in de `HistoryBlock` input (`block.titles`, `block.urls`). We moeten die na het mappen van LLM-output ook op het `ClassifiedBlock` zetten.

**URL sanitisatie:** strip query string en fragment via `new URL(url).origin + new URL(url).pathname`. Als de URL niet parseerbaar is, gebruik dan de originele string.

- [ ] **Step 1: Write the failing test**

Maak `src/infrastructure/copilot/CopilotRepository.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { CopilotRepository } from './CopilotRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify([{
          urlPattern: 'github.com',
          blockName: 'GitHub — review',
          summary: 'Code review',
          projectId: 'proj-1',
          serviceId: 'svc-1',
          note: 'review',
          confidence: 0.9,
        }]),
      },
    }],
  })),
}))

const block: HistoryBlock = {
  urlPattern: 'github.com',
  urls: [
    'https://github.com/org/repo/pull/42?tab=files#diff',
    'https://github.com/org/repo/pull/42',
  ],
  titles: [
    'Files changed · Pull Request #42 · org/repo',
    'Pull Request #42 · org/repo',
    'Some very long title that exceeds eighty characters and should be truncated by the evidence panel',
  ],
  visitCount: 5,
  hours: 1,
  date: '2026-05-21',
  firstVisitTime: '09:00',
  lastVisitTime: '10:00',
}

describe('CopilotRepository.classify', () => {
  it('sets rawUrls as sanitized URLs (no query/fragment), max 5', async () => {
    const repo = new CopilotRepository('test-token')
    const results = await repo.classify([block], [], [], [])
    expect(results[0].rawUrls).toEqual([
      'https://github.com/org/repo/pull/42',
      'https://github.com/org/repo/pull/42',
    ])
  })

  it('sets rawTitles from block.titles, max 5', async () => {
    const repo = new CopilotRepository('test-token')
    const results = await repo.classify([block], [], [], [])
    expect(results[0].rawTitles).toHaveLength(3)
    expect(results[0].rawTitles![0]).toBe('Files changed · Pull Request #42 · org/repo')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/infrastructure/copilot/CopilotRepository.test.ts
```

Verwacht: FAIL — `rawUrls` en `rawTitles` zijn undefined.

- [ ] **Step 3: Add sanitizeUrl helper and fill fields in classify()**

Voeg bovenaan `CopilotRepository.ts` (na de imports, vóór de `formatCalendarContext` functie) de helper toe:

```ts
function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return url
  }
}
```

Zoek in de `classify()` methode de plek waar `classified` wordt gebouwd (rond regel 128):

```ts
      const classified: ClassifiedBlock = {
        ...block,
        blockName: match?.blockName ?? block.urlPattern,
        summary: match?.summary ?? '',
        startTime: block.firstVisitTime,
        endTime: block.lastVisitTime || addHours(block.firstVisitTime, block.hours),
        confidence: Math.min(1, Math.max(0, match?.confidence ?? 0)),
        origin: 'llm' as const,
      }
```

Vervang dit door:

```ts
      const classified: ClassifiedBlock = {
        ...block,
        blockName: match?.blockName ?? block.urlPattern,
        summary: match?.summary ?? '',
        startTime: block.firstVisitTime,
        endTime: block.lastVisitTime || addHours(block.firstVisitTime, block.hours),
        confidence: Math.min(1, Math.max(0, match?.confidence ?? 0)),
        origin: 'llm' as const,
        rawTitles: block.titles.slice(0, 5),
        rawUrls: block.urls.slice(0, 5).map(sanitizeUrl),
      }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- src/infrastructure/copilot/CopilotRepository.test.ts
```

Verwacht: PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/copilot/CopilotRepository.ts src/infrastructure/copilot/CopilotRepository.test.ts
git commit -m "feat(infra): fill rawTitles and rawUrls on ClassifiedBlock after LLM classify"
```

---

## Task 3: Create EvidencePanel component

**Files:**
- Create: `src/ui/components/EvidencePanel.tsx`
- Test: `src/ui/components/EvidencePanel.test.tsx` (create)

Het component toont ruwe browser data. Het rendert niets als beide arrays leeg of undefined zijn. Titels worden afgekapt op 80 tekens. URLs worden als-is getoond (al gesaniteerd door de repo).

- [ ] **Step 1: Write the failing test**

Maak `src/ui/components/EvidencePanel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EvidencePanel from './EvidencePanel'

describe('EvidencePanel', () => {
  it('renders nothing when both arrays are empty', () => {
    const { container } = render(<EvidencePanel rawTitles={[]} rawUrls={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when both arrays are undefined', () => {
    const { container } = render(<EvidencePanel rawTitles={undefined} rawUrls={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders URLs when provided', () => {
    render(<EvidencePanel rawUrls={['https://github.com/org/repo/pull/42']} />)
    expect(screen.getByText('github.com/org/repo/pull/42')).toBeInTheDocument()
  })

  it('renders titles when provided', () => {
    render(<EvidencePanel rawTitles={['Pull Request #42 · org/repo']} />)
    expect(screen.getByText('Pull Request #42 · org/repo')).toBeInTheDocument()
  })

  it('truncates titles longer than 80 characters', () => {
    const longTitle = 'A'.repeat(90)
    render(<EvidencePanel rawTitles={[longTitle]} />)
    expect(screen.getByText('A'.repeat(80) + '…')).toBeInTheDocument()
  })

  it('shows section header "Wat je deed"', () => {
    render(<EvidencePanel rawUrls={['https://github.com/org/repo']} />)
    expect(screen.getByText('Wat je deed')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/ui/components/EvidencePanel.test.tsx
```

Verwacht: FAIL — component bestaat nog niet.

- [ ] **Step 3: Implement EvidencePanel**

Maak `src/ui/components/EvidencePanel.tsx`:

```tsx
interface Props {
  rawTitles?: string[]
  rawUrls?: string[]
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.host + u.pathname
  } catch {
    return url
  }
}

export default function EvidencePanel({ rawTitles, rawUrls }: Props) {
  const hasTitles = rawTitles && rawTitles.length > 0
  const hasUrls = rawUrls && rawUrls.length > 0

  if (!hasTitles && !hasUrls) return null

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: '#1a1a2e', borderLeft: '3px solid #444' }}
    >
      <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Wat je deed</div>
      <ul className="flex flex-col gap-1.5">
        {hasUrls && rawUrls!.map((url, i) => (
          <li key={i} className="flex flex-col gap-0.5">
            <span className="text-xs font-mono" style={{ color: '#6c63ff' }}>
              {displayUrl(url)}
            </span>
            {hasTitles && rawTitles![i] && (
              <span className="text-gray-400 text-xs leading-tight pl-1">
                "{truncate(rawTitles![i]!, 80)}"
              </span>
            )}
          </li>
        ))}
        {hasTitles && !hasUrls && rawTitles!.map((title, i) => (
          <li key={i} className="text-gray-400 text-xs leading-tight">
            "{truncate(title, 80)}"
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- src/ui/components/EvidencePanel.test.tsx
```

Verwacht: PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/EvidencePanel.tsx src/ui/components/EvidencePanel.test.tsx
git commit -m "feat(ui): add EvidencePanel component"
```

---

## Task 4: Integrate EvidencePanel in ImportBlockModal

**Files:**
- Modify: `src/ui/components/ImportBlockModal.tsx`

Het `EvidencePanel` wordt bovenaan de modal geplaatst, direct na de header en vóór de LLM samenvatting.

- [ ] **Step 1: Add EvidencePanel import en plaatsing**

In `src/ui/components/ImportBlockModal.tsx`, voeg de import toe na de bestaande imports:

```tsx
import EvidencePanel from './EvidencePanel'
```

Zoek het blok direct na de header comment (`{/* Header */}` ... sluitende `</div>`):

```tsx
        {/* LLM summary */}
        {block.summary && (
```

Voeg EvidencePanel ertussen in:

```tsx
        {/* Evidence */}
        <EvidencePanel rawTitles={block.rawTitles} rawUrls={block.rawUrls} />

        {/* LLM summary */}
        {block.summary && (
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Verwacht: alle tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/ImportBlockModal.tsx
git commit -m "feat(ui): show EvidencePanel in ImportBlockModal"
```

---

## Task 5: Verify end-to-end in dev

- [ ] **Step 1: Start de app**

```bash
npm run tauri dev
```

- [ ] **Step 2: Importeer een browser history CSV en classificeer een dag**

Controleer dat in de `ImportBlockModal`:
- Het "Wat je deed" paneel zichtbaar is bovenaan
- URLs getoond worden als `domein/pad` (zonder query string)
- Paginatitels zichtbaar zijn naast de URLs
- Het paneel niet verschijnt als een blok geen URLs/titels heeft (bv. kalender-only blok)

- [ ] **Step 3: Controleer dat bestaande functionaliteit ongewijzigd werkt**

- Boeken vanuit de modal werkt nog
- "Boek alle klare" werkt nog
- Cache-blokken (origin: 'cache') tonen geen EvidencePanel (ze hebben geen rawUrls/rawTitles)

---

## Verificatiesamenvatting

Na voltooiing van alle taken:

```bash
npm run test        # alle unit tests groen
npm run typecheck   # geen type fouten
npm run lint        # geen lint fouten
```
