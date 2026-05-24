# CSV upload zonder automatische classificatie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV upload slaat alleen raw browser history op — geen automatische LLM-classificatie meer. Verwerking start pas als de gebruiker expliciet "Verwerk week/dag" klikt.

**Architecture:** `analyseFile` in `useImport.ts` wordt gesplitst: alleen parsing + opslaan in `HistoryStore`. De `useEffect` die blocks opsloeg na classificatie verdwijnt uit `WeekPage`. Een nieuwe `uploadCsv` handler in `WeekPage` regelt opslaan, toast, en optionele auto-start na warning modal.

**Tech Stack:** TypeScript strict, React 18, Tailwind CSS, Vitest, Tauri v2

---

## File map

| Bestand | Actie |
|---|---|
| `src/ui/hooks/useImport.ts` | Wijzig — verwijder classificatie uit `analyseFile`, voeg `uploadResult` toe |
| `src/ui/pages/WeekPage.tsx` | Wijzig — nieuwe `handleUploadCsv`, toast state, pending scope ref, verwijder `useEffect` |

---

## Task 1: Verwijder classificatie uit `analyseFile` in `useImport.ts`

**Files:**
- Modify: `src/ui/hooks/useImport.ts`

De huidige `analyseFile` doet: parse → calendar ophalen → LLM classificeren → `setBlocks(classified)`.

Het nieuwe gedrag: parse → `setBlocks(rawBlocks)`. Geen calendar, geen LLM, geen `classifying` status.

`analyseFile` geeft ook het uploadresultaat terug zodat de caller er iets mee kan doen.

- [ ] **Stap 1: Voeg `UploadResult` interface toe aan `useImport.ts`**

Voeg toe na de `ImportStatus` type definitie (regel 20):

```typescript
export interface UploadResult {
  dateCount: number        // aantal unieke datums in de CSV
  dateFrom: string         // vroegste datum, format YYYY-MM-DD
  dateTo: string           // laatste datum, format YYYY-MM-DD
  blocks: ClassifiedBlock[] // de geparseerde (raw) blocks
}
```

- [ ] **Stap 2: Update de `ImportState` interface**

Vervang de `analyseFile` signatuur (regel 28):

```typescript
analyseFile: (csvContent: string) => Promise<UploadResult | null>
```

- [ ] **Stap 3: Vervang de `analyseFile` implementatie (regels 70–154)**

Vervang de volledige `analyseFile` callback met:

```typescript
const analyseFile = useCallback(async (csvContent: string): Promise<UploadResult | null> => {
  setError(null)
  setStatus('parsing')
  try {
    const parseUseCase = new ParseBrowserHistoryUseCase()
    const rawBlocks = await parseUseCase.execute(csvContent, minVisits)

    if (rawBlocks.length === 0) {
      setBlocks([])
      setStatus('ready')
      return null
    }

    setBlocks(rawBlocks)
    setStatus('ready')

    const dates = [...new Set(rawBlocks.map(b => b.date))].sort()
    return {
      dateCount: dates.length,
      dateFrom: dates[0]!,
      dateTo: dates[dates.length - 1]!,
      blocks: rawBlocks,
    }
  } catch (e) {
    if (e instanceof ParseError) {
      setError(e.message)
    } else {
      setError(e instanceof Error ? e.message : String(e))
    }
    setStatus('idle')
    return null
  }
}, [minVisits])
```

- [ ] **Stap 4: Verwijder de imports die alleen voor classificatie nodig waren**

Verwijder uit de import-statement bovenaan (regel 10–12):
- `createCopilotRepository`
- `createCalendarRepository`
- `createFetchCalendarEventsUseCase`
- `createGroupAndClassifyDayUseCase`

Verwijder ook de `CalendarEvent` type import als die alleen voor classificatie gebruikt werd.

Laat staan: `mappingCacheRepo`, `keychainRepo`, `createSimplicateRepository` (die worden nog gebruikt door `confirmBlock` en `bookAll`).

- [ ] **Stap 5: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten (of alleen fouten in `WeekPage.tsx` omdat de caller verwacht `Promise<void>` — die fixen we in Task 2).

- [ ] **Stap 6: Run tests**

```bash
npm run test
```

Verwacht: alle tests pass.

- [ ] **Stap 7: Commit**

```bash
git add src/ui/hooks/useImport.ts
git commit -m "refactor: analyseFile only parses CSV, no LLM classification"
```

---

## Task 2: `WeekPage` — nieuwe upload handler, toast, pending scope

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

Dit zijn de wijzigingen in `WeekPage.tsx`:

1. Verwijder de `useEffect` die blocks opsloeg na classificatie
2. Vervang `handleUploadCsv` met een versie die: blocks opslaat in HistoryStore, toast toont, en optioneel verwerking start
3. Voeg toast state toe
4. Voeg `pendingScopeRef` toe voor de warning modal flow
5. Update `handleWarningUpload` om de scope op te slaan in de ref
6. Update `isClassifying` (verwijder de `classifying` status check)

- [ ] **Stap 1: Voeg toast state toe**

Na de `csvInputRef` declaratie (na regel 81), voeg toe:

```typescript
// Upload toast
const [uploadToast, setUploadToast] = useState<string | null>(null)
```

- [ ] **Stap 2: Voeg `pendingScopeRef` toe**

Direct daarna:

```typescript
// Pending warning scope na upload (voor auto-start verwerking)
type WarningScope = { kind: 'week' } | { kind: 'day'; date: string } | null
const pendingScopeRef = useRef<WarningScope>(null)
```

Let op: de `WarningScope` type is al gedeclareerd op regel 77 in de component. Verwijder de duplicate declaratie — gebruik de bestaande. De `pendingScopeRef` aangifte wordt dan:

```typescript
const pendingScopeRef = useRef<{ kind: 'week' } | { kind: 'day'; date: string } | null>(null)
```

- [ ] **Stap 3: Verwijder de `useEffect` die blocks opsloeg (regels 137–147)**

Verwijder dit blok volledig:

```typescript
useEffect(() => {
  if (importState.status !== 'ready' || importState.blocks.length === 0) return
  const byDate: Record<string, ClassifiedBlock[]> = {}
  for (const block of importState.blocks) {
    if (!byDate[block.date]) byDate[block.date] = []
    byDate[block.date]!.push(block)
  }
  for (const [date, blocks] of Object.entries(byDate)) {
    void saveBlocksForDate(date, blocks)
  }
}, [importState.status, importState.blocks, saveBlocksForDate])
```

- [ ] **Stap 4: Vervang `handleUploadCsv` (regels 131–133)**

Vervang:

```typescript
const handleUploadCsv = useCallback(async (csvContent: string) => {
  await importState.analyseFile(csvContent)
}, [importState])
```

Met:

```typescript
const handleUploadCsv = useCallback(async (csvContent: string) => {
  const result = await importState.analyseFile(csvContent)
  if (!result) return

  // Sla alle blocks op per datum in HistoryStore
  const byDate: Record<string, ClassifiedBlock[]> = {}
  for (const block of result.blocks) {
    if (!byDate[block.date]) byDate[block.date] = []
    byDate[block.date]!.push(block)
  }
  for (const [date, blocks] of Object.entries(byDate)) {
    void saveBlocksForDate(date, blocks)
  }

  // Toon toast
  const fromLabel = result.dateFrom.slice(8) + '-' + result.dateFrom.slice(5, 7)  // DD-MM
  const toLabel = result.dateTo.slice(8) + '-' + result.dateTo.slice(5, 7)
  const msg = result.dateFrom === result.dateTo
    ? `Geschiedenis geüpload voor ${fromLabel}`
    : `Geschiedenis geüpload voor ${result.dateCount} dagen (${fromLabel} t/m ${toLabel})`
  setUploadToast(msg)
  setTimeout(() => setUploadToast(null), 3000)

  // Als er een pending warning scope was, start verwerking voor die scope
  const pending = pendingScopeRef.current
  pendingScopeRef.current = null
  if (pending) {
    if (pending.kind === 'week') {
      void handleProcessWeek()
    } else {
      void runProcessDay(pending.date)
    }
  } else {
    void week.refresh()
  }
}, [importState, saveBlocksForDate, week])
```

- [ ] **Stap 5: Update `handleWarningUpload` om pending scope op te slaan**

Vervang de huidige `handleWarningUpload` functie:

```typescript
function handleWarningUpload() {
  pendingScopeRef.current = warningScope  // ← sla scope op voor na upload
  setWarningScope(null)
  csvInputRef.current?.click()
}
```

- [ ] **Stap 6: Update `isClassifying`**

Vervang (huidige regel 322):

```typescript
const isClassifying = importState.status === 'classifying' || importState.status === 'parsing'
```

Met:

```typescript
const isClassifying = importState.status === 'parsing'
```

`'classifying'` wordt nooit meer gezet door `analyseFile`, dus dat deel verdwijnt.

- [ ] **Stap 7: Voeg de toast toe aan de JSX**

Voeg toe direct vóór de `{warningScope && ...}` block (vlak voor de sluitende root `</div>`):

```tsx
{/* Upload toast */}
{uploadToast && (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1e1b18] border border-[#3e3a36] rounded-lg px-4 py-2.5 text-[#e8e2d9] text-[0.75rem] shadow-lg pointer-events-none">
    {uploadToast}
  </div>
)}
```

- [ ] **Stap 8: Run typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 9: Run alle tests**

```bash
npm run test
```

Verwacht: alle tests pass.

- [ ] **Stap 10: Commit**

```bash
git add src/ui/hooks/useImport.ts src/ui/pages/WeekPage.tsx
git commit -m "feat: CSV upload stores raw history only, toast feedback, auto-process after warning modal upload"
```

---

## Noot

`useImport` wordt alleen gebruikt door `WeekPage.tsx` — geen andere callers.
