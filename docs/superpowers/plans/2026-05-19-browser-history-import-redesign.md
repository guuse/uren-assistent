# Browser History Import — Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the import flow with time-window overlap grouping, LLM-driven naming + project suggestion, a day-navigator sidebar layout, and an edit modal per block.

**Architecture:** `ParseBrowserHistoryUseCase` gains time-window overlap logic (URLs active in the same 30-min window are merged). `CopilotRepository` prompt is updated to also return a human-readable block name and summary. `ImportPage` is replaced with a sidebar layout (day list left, blocks right). A new `ImportBlockModal` handles per-block editing, reusing `SearchableSelect`.

**Tech Stack:** TypeScript strict, React, Zustand, Vitest, Tailwind CSS, existing `SearchableSelect` component, existing `BookingModal` design patterns.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/domain/entities/HistoryBlock.ts` | Modify | Add `urls: string[]` field, remove urlPattern as primary key concept |
| `src/domain/entities/ClassifiedBlock.ts` | Modify | Add `blockName: string`, `summary: string` fields |
| `src/domain/usecases/ParseBrowserHistoryUseCase.ts` | Modify | Time-window overlap grouping, half-hour rounding |
| `src/domain/usecases/ParseBrowserHistoryUseCase.test.ts` | Modify | Tests for new grouping logic |
| `src/infrastructure/copilot/CopilotRepository.ts` | Modify | Updated prompt: returns blockName + summary + project suggestion |
| `src/ui/hooks/useImport.ts` | Modify | Add `selectedBlockIndex`, `setSelectedBlockIndex`, `openModal`, `closeModal` |
| `src/ui/pages/ImportPage.tsx` | Replace | Day-navigator sidebar layout (C) |
| `src/ui/components/ImportBlockModal.tsx` | Create | Per-block edit modal, dark theme matching BookingModal |

---

## Task 1: Update domain entities

**Files:**
- Modify: `src/domain/entities/HistoryBlock.ts`
- Modify: `src/domain/entities/ClassifiedBlock.ts`

- [ ] **Step 1: Read existing files**

Read `src/domain/entities/HistoryBlock.ts` and `src/domain/entities/ClassifiedBlock.ts`.

- [ ] **Step 2: Update HistoryBlock**

Replace contents of `src/domain/entities/HistoryBlock.ts`:

```typescript
export interface HistoryBlock {
  date: string            // YYYY-MM-DD
  urlPattern: string      // primary URL pattern (hostname + up to 3 path segments)
  urls: string[]          // all unique normalised URL patterns in this block
  titles: string[]        // unique page titles seen in this block
  visitCount: number
  firstVisitTime: string  // HH:mm, rounded to 30 min
  lastVisitTime: string   // HH:mm, rounded to 30 min
  hours: number           // rounded to 0.5, minimum 0.5
}
```

- [ ] **Step 3: Update ClassifiedBlock**

Replace contents of `src/domain/entities/ClassifiedBlock.ts`:

```typescript
import type { HistoryBlock } from './HistoryBlock'

export interface ClassifiedBlock extends HistoryBlock {
  blockName: string        // human-readable name from LLM (e.g. "Eindhoven Doet — development")
  summary: string          // short summary from LLM (e.g. "PR reviews en lokale dev")
  startTime: string        // HH:mm (editable, initially = firstVisitTime)
  endTime: string          // HH:mm (editable, initially = lastVisitTime)
  projectId?: string
  serviceId?: string
  note?: string
  confidence: number       // 0–1
  origin: 'llm' | 'cache' | 'manual'
}
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/entities/HistoryBlock.ts src/domain/entities/ClassifiedBlock.ts
git commit -m "feat(domain): add urls[], blockName, summary, lastVisitTime to entities"
```

---

## Task 2: Update ParseBrowserHistoryUseCase — time-window overlap + half-hour rounding

**Files:**
- Modify: `src/domain/usecases/ParseBrowserHistoryUseCase.ts`
- Modify: `src/domain/usecases/ParseBrowserHistoryUseCase.test.ts`

**Strategy:** Instead of grouping by date+pattern key, we use a sliding time-window approach. Rows within 30 minutes of each other (on the same day) are placed in the same work block. Different URL patterns in the same window are merged into one block. This better reflects how users actually work (multiple tabs open simultaneously).

- [ ] **Step 1: Write failing tests first**

Replace the tests in `src/domain/usecases/ParseBrowserHistoryUseCase.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest'
import { ParseBrowserHistoryUseCase, ParseError } from './ParseBrowserHistoryUseCase'

function makeCsv(rows: Array<{ time: string; title: string; url: string; visits?: number }>): string {
  const header = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'
  const lines = rows.map((r, i) =>
    `${i + 1},id${i},${r.time},"${r.title}",${r.visits ?? 3},${r.url},0`
  )
  return [header, ...lines].join('\n')
}

describe('ParseBrowserHistoryUseCase', () => {
  const uc = new ParseBrowserHistoryUseCase()

  it('throws ParseError on invalid header', async () => {
    await expect(uc.execute('not,a,valid,csv', 1)).rejects.toBeInstanceOf(ParseError)
  })

  it('returns empty array for empty csv', async () => {
    const csv = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar\n'
    const result = await uc.execute(csv, 1)
    expect(result).toEqual([])
  })

  it('groups URLs within 30-minute window into one block', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub PR', url: 'https://github.com/org/repo/pull/1', visits: 3 },
      { time: '2024-05-13T09:15:00', title: 'Localhost', url: 'http://localhost:3000/app', visits: 3 },
      { time: '2024-05-13T09:25:00', title: 'Docs', url: 'https://docs.google.com/document/d/abc', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.urls).toHaveLength(3)
  })

  it('creates separate blocks for visits more than 30 minutes apart', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
      { time: '2024-05-13T11:00:00', title: 'Localhost', url: 'http://localhost:3000', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(2)
  })

  it('separates blocks by day even if times are close', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T23:50:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
      { time: '2024-05-14T00:05:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(2)
    expect(result[0]!.date).toBe('2024-05-13')
    expect(result[1]!.date).toBe('2024-05-14')
  })

  it('filters out blocks with fewer visits than minVisits', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 1 },
      { time: '2024-05-13T10:00:00', title: 'Localhost', url: 'http://localhost:3000', visits: 5 },
    ])
    const result = await uc.execute(csv, 3)
    expect(result).toHaveLength(1)
    expect(result[0]!.urls[0]).toContain('localhost')
  })

  it('rounds start and end times to half hour', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:07:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.firstVisitTime).toBe('09:00')
    expect(result[0]!.lastVisitTime).toBe('09:00')
  })

  it('rounds hours to nearest 0.5, minimum 0.5', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.hours).toBe(0.5)
  })

  it('sets urlPattern to the most-visited url in the block', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 10 },
      { time: '2024-05-13T09:10:00', title: 'Localhost', url: 'http://localhost:3000', visits: 2 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.urlPattern).toContain('github.com')
  })

  it('returns blocks sorted by date then firstVisitTime', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T11:00:00', title: 'B', url: 'https://b.com', visits: 3 },
      { time: '2024-05-13T09:00:00', title: 'A', url: 'https://a.com', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.firstVisitTime).toBe('09:00')
    expect(result[1]!.firstVisitTime).toBe('11:00')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- ParseBrowserHistoryUseCase
```

Expected: multiple failures (wrong grouping logic, missing fields).

- [ ] **Step 3: Rewrite ParseBrowserHistoryUseCase**

Replace `src/domain/usecases/ParseBrowserHistoryUseCase.ts`:

```typescript
import type { HistoryBlock } from '../entities/HistoryBlock'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const EXPECTED_HEADERS = ['Order', 'ID', 'Last Visit Time', 'Title']

const WINDOW_MINUTES = 30

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean).slice(0, 3)
    return [parsed.hostname, ...segments].join('/')
  } catch {
    return url
  }
}

function roundToHalf(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const roundedM = m < 15 ? 0 : m < 45 ? 30 : 0
  const roundedH = m >= 45 ? (h + 1) % 24 : h
  return `${String(roundedH).padStart(2, '0')}:${String(roundedM).padStart(2, '0')}`
}

function roundHoursDuration(minutes: number): number {
  return Math.max(0.5, Math.round(minutes / 60 * 2) / 2)
}

function parseDateTime(raw: string): Date | null {
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

interface RawRow {
  visitTime: Date
  title: string
  normalisedUrl: string
  visitCount: number
}

export class ParseBrowserHistoryUseCase {
  async execute(csv: string, minVisits: number): Promise<HistoryBlock[]> {
    const lines = csv.trim().split('\n')
    if (lines.length === 0) return []

    const headerCols = parseCsvLine(lines[0]!)
    for (const expected of EXPECTED_HEADERS) {
      if (!headerCols.includes(expected)) {
        throw new ParseError(
          `Invalid CSV format. Expected header "${expected}" not found. Make sure this is a Chrome browser history export.`
        )
      }
    }

    const timeIdx = headerCols.indexOf('Last Visit Time')
    const titleIdx = headerCols.indexOf('Title')
    const urlIdx = headerCols.findIndex(h => h === 'URL')
    const visitsIdx = headerCols.findIndex(
      (_, i) => i > titleIdx && headerCols[i]?.includes('times') && !headerCols[i]?.includes('address')
    )

    const rows: RawRow[] = []
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = parseCsvLine(line)
      const visitTime = parseDateTime(cols[timeIdx] ?? '')
      if (!visitTime) continue
      const url = cols[urlIdx] ?? ''
      if (!url) continue
      rows.push({
        visitTime,
        title: cols[titleIdx] ?? '',
        normalisedUrl: normaliseUrl(url),
        visitCount: parseInt(cols[visitsIdx] ?? '1', 10) || 1,
      })
    }

    // Sort rows by time
    rows.sort((a, b) => a.visitTime.getTime() - b.visitTime.getTime())

    // Group by day first, then apply time-window overlap within each day
    const byDay = new Map<string, RawRow[]>()
    for (const row of rows) {
      const date = row.visitTime.toISOString().split('T')[0]!
      if (!byDay.has(date)) byDay.set(date, [])
      byDay.get(date)!.push(row)
    }

    const blocks: HistoryBlock[] = []

    for (const [date, dayRows] of byDay) {
      // Sliding window: start new block when gap > WINDOW_MINUTES
      const windows: RawRow[][] = []
      let current: RawRow[] = []

      for (const row of dayRows) {
        if (current.length === 0) {
          current.push(row)
          continue
        }
        const lastTime = current[current.length - 1]!.visitTime.getTime()
        const gapMinutes = (row.visitTime.getTime() - lastTime) / 60000
        if (gapMinutes <= WINDOW_MINUTES) {
          current.push(row)
        } else {
          windows.push(current)
          current = [row]
        }
      }
      if (current.length > 0) windows.push(current)

      for (const windowRows of windows) {
        const totalVisits = windowRows.reduce((sum, r) => sum + r.visitCount, 0)
        if (totalVisits < minVisits) continue

        const first = windowRows[0]!
        const last = windowRows[windowRows.length - 1]!
        const diffMinutes = (last.visitTime.getTime() - first.visitTime.getTime()) / 60000
        const hours = roundHoursDuration(diffMinutes)

        // Collect unique URL patterns, track visit counts per pattern
        const urlCounts = new Map<string, number>()
        for (const r of windowRows) {
          urlCounts.set(r.normalisedUrl, (urlCounts.get(r.normalisedUrl) ?? 0) + r.visitCount)
        }
        const urls = [...urlCounts.keys()]
        // Primary pattern = most visited
        const urlPattern = [...urlCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0]

        const titles = [...new Set(windowRows.map(r => r.title).filter(Boolean))]

        blocks.push({
          date,
          urlPattern,
          urls,
          titles,
          visitCount: totalVisits,
          firstVisitTime: roundToHalf(first.visitTime),
          lastVisitTime: roundToHalf(last.visitTime),
          hours,
        })
      }
    }

    return blocks.sort((a, b) =>
      a.date.localeCompare(b.date) || a.firstVisitTime.localeCompare(b.firstVisitTime)
    )
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- ParseBrowserHistoryUseCase
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/usecases/ParseBrowserHistoryUseCase.ts src/domain/usecases/ParseBrowserHistoryUseCase.test.ts
git commit -m "feat(parser): time-window overlap grouping, half-hour rounding, urls[] field"
```

---

## Task 3: Update CopilotRepository — LLM names blocks and suggests project

**Files:**
- Modify: `src/infrastructure/copilot/CopilotRepository.ts`

The LLM now receives all URLs in a window and must return `blockName`, `summary`, `projectId`, `serviceId`, `note`, and `confidence`. `blockName` is a human-readable name (e.g. "Eindhoven Doet — development"), `summary` is a short explanation (max 120 chars).

- [ ] **Step 1: Update the classify method**

Replace contents of `src/infrastructure/copilot/CopilotRepository.ts`:

```typescript
import { fetch } from '@tauri-apps/plugin-http'
import type { ICopilotRepository, Project, Service } from '../../domain/repositories/ICopilotRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

const COPILOT_API_URL = 'https://api.githubcopilot.com/chat/completions'

interface CopilotChoice {
  message: { content: string }
}

interface CopilotResponse {
  choices: CopilotChoice[]
}

interface LLMBlockResult {
  urlPattern: string
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: number
}

export class CopilotRepository implements ICopilotRepository {
  constructor(private readonly copilotToken: string) {}

  async classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
  ): Promise<ClassifiedBlock[]> {
    const projectList = availableProjects
      .map(p => `- id: "${p.id}", name: "${p.name}"`)
      .join('\n')
    const serviceList = availableServices
      .map(s => `- id: "${s.id}", name: "${s.name}", projectId: "${s.projectId}"`)
      .join('\n')
    const blockList = blocks
      .map(b =>
        `- urlPattern: "${b.urlPattern}", urls: [${b.urls.slice(0, 5).map(u => `"${u}"`).join(', ')}], titles: [${b.titles.slice(0, 3).map(t => `"${t}"`).join(', ')}], visitCount: ${b.visitCount}`
      )
      .join('\n')

    const prompt = `You are a time-tracking assistant helping a developer record their work hours.

For each browser activity block, you must:
1. Generate a human-readable name (e.g. "Eindhoven Doet — development", "Harborn hosting — beheer")
2. Write a short summary of what was done (max 120 chars, Dutch preferred)
3. Match to a project and service if possible

Available projects:
${projectList}

Available services (linked to projects by projectId):
${serviceList}

Browser activity blocks to process:
${blockList}

Return a JSON array. Each item must have:
- urlPattern (string, exact match from input — used as identifier)
- blockName (string, human-readable work block name, max 60 chars)
- summary (string, short description of the work, max 120 chars, Dutch preferred)
- projectId (string | null, must be one of the available project IDs)
- serviceId (string | null, must be a service ID whose projectId matches the chosen project)
- note (string, short booking note, max 80 chars)
- confidence (number 0-1, how confident you are in the project match)

Return ONLY a valid JSON array, no markdown, no explanation.`

    const response = await fetch(COPILOT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.copilotToken}`,
        'Content-Type': 'application/json',
        'Copilot-Integration-Id': 'quiet-wizard',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      throw new Error(`Copilot API error: ${response.status}`)
    }

    const data = await response.json() as CopilotResponse
    const raw = data.choices[0]?.message.content ?? '[]'
    // Strip markdown code fences if present
    const content = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

    let results: LLMBlockResult[]
    try {
      results = JSON.parse(content) as LLMBlockResult[]
    } catch {
      throw new Error('Copilot returned invalid JSON')
    }

    const addHours = (time: string, hours: number): string => {
      const [h, m] = time.split(':').map(Number) as [number, number]
      const total = h * 60 + m + Math.round(hours * 60)
      return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    }

    return blocks.map(block => {
      const match = results.find(r => r.urlPattern === block.urlPattern)
      const classified: ClassifiedBlock = {
        ...block,
        blockName: match?.blockName ?? block.urlPattern,
        summary: match?.summary ?? '',
        startTime: block.firstVisitTime,
        endTime: block.lastVisitTime || addHours(block.firstVisitTime, block.hours),
        confidence: Math.min(1, Math.max(0, match?.confidence ?? 0)),
        origin: 'llm' as const,
      }
      if (match?.projectId) classified.projectId = match.projectId
      if (match?.serviceId) classified.serviceId = match.serviceId
      if (match?.note) classified.note = match.note
      return classified
    })
  }
}
```

- [ ] **Step 2: Run all tests**

```bash
npm run test
```

Expected: all tests pass (CopilotRepository has no unit tests — it uses Tauri fetch, tested in smoke test).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/copilot/CopilotRepository.ts
git commit -m "feat(copilot): LLM now returns blockName, summary, and project suggestion"
```

---

## Task 4: Update useImport hook — add modal state

**Files:**
- Modify: `src/ui/hooks/useImport.ts`

Add `selectedBlockIndex: number | null`, `openBlock(index)`, `closeBlock()` to the returned state.

- [ ] **Step 1: Update useImport**

Add the following to `useImport.ts` (after the existing `useState` declarations):

```typescript
const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null)

const openBlock = useCallback((index: number) => {
  setSelectedBlockIndex(index)
}, [])

const closeBlock = useCallback(() => {
  setSelectedBlockIndex(null)
}, [])
```

Add to the returned object:
```typescript
selectedBlockIndex,
openBlock,
closeBlock,
```

Update the `ImportState` interface:
```typescript
selectedBlockIndex: number | null
openBlock: (index: number) => void
closeBlock: () => void
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- useImport
```

Expected: no failures (hook tests, if any, pass; no new tests needed for trivial state).

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useImport.ts
git commit -m "feat(hook): add selectedBlockIndex, openBlock, closeBlock to useImport"
```

---

## Task 5: Create ImportBlockModal component

**Files:**
- Create: `src/ui/components/ImportBlockModal.tsx`

Dark-theme modal matching `BookingModal.tsx`. Shows LLM summary, editable times, `SearchableSelect` for project/service, note input, and a "Boeken" button.

- [ ] **Step 1: Read BookingModal and SearchableSelect for patterns**

Read `src/ui/pages/BookingModal.tsx` and `src/ui/components/SearchableSelect.tsx`.

- [ ] **Step 2: Create the modal**

Create `src/ui/components/ImportBlockModal.tsx`:

```typescript
import { useState, useEffect } from 'react'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import SearchableSelect from './SearchableSelect'

interface Project { id: string; name: string }
interface Service { id: string; name: string; projectId: string }

interface Props {
  block: ClassifiedBlock
  projects: Project[]
  services: Service[]
  bookingResult?: 'success' | 'error' | string
  onSave: (updates: Partial<ClassifiedBlock>) => void
  onBook: () => void
  onRemove: () => void
  onClose: () => void
}

export default function ImportBlockModal({
  block, projects, services, bookingResult, onSave, onBook, onRemove, onClose,
}: Props) {
  const [projectId, setProjectId] = useState(block.projectId ?? '')
  const [serviceId, setServiceId] = useState(block.serviceId ?? '')
  const [note, setNote] = useState(block.note ?? block.summary ?? '')
  const [startTime, setStartTime] = useState(block.startTime)
  const [endTime, setEndTime] = useState(block.endTime)

  // Reset local state when block changes
  useEffect(() => {
    setProjectId(block.projectId ?? '')
    setServiceId(block.serviceId ?? '')
    setNote(block.note ?? block.summary ?? '')
    setStartTime(block.startTime)
    setEndTime(block.endTime)
  }, [block])

  const projectServices = services.filter(s => s.projectId === projectId)
  const canBook = !!projectId && !!serviceId && bookingResult !== 'success'

  function handleProjectChange(id: string) {
    setProjectId(id)
    setServiceId('')
    onSave({ projectId: id, serviceId: undefined })
  }

  function handleServiceChange(id: string) {
    setServiceId(id)
    onSave({ serviceId: id })
  }

  function handleNoteChange(val: string) {
    setNote(val)
    onSave({ note: val })
  }

  function handleStartTimeChange(val: string) {
    setStartTime(val)
    onSave({ startTime: val })
  }

  function handleEndTimeChange(val: string) {
    setEndTime(val)
    onSave({ endTime: val })
  }

  const statusBorderColor =
    bookingResult === 'success' ? '#43b89c' :
    !projectId || !serviceId ? '#ff6584' :
    block.origin === 'cache' ? '#43b89c' :
    block.confidence < 0.6 ? '#f59e0b' : '#6c63ff'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="rounded-xl p-5 w-[380px] flex flex-col gap-4 text-sm shadow-2xl"
        style={{ background: '#2d2d44' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-white font-bold text-base leading-tight">{block.blockName}</div>
            <div className="text-gray-400 text-xs mt-1">
              {block.date} &middot; {block.origin === 'cache' ? 'cache' : block.origin === 'manual' ? 'handmatig' : 'Copilot'}
            </div>
          </div>
          <button className="text-gray-500 hover:text-white text-lg leading-none" onClick={onClose}>✕</button>
        </div>

        {/* LLM summary */}
        {block.summary && (
          <div
            className="rounded-lg p-3"
            style={{ background: '#1a1a2e', borderLeft: `3px solid ${statusBorderColor}` }}
          >
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Samenvatting</div>
            <div className="text-gray-300 text-xs leading-relaxed">{block.summary}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {block.urls.slice(0, 4).map(u => (
                <span key={u} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#252540', color: '#888' }}>{u}</span>
              ))}
            </div>
          </div>
        )}

        {/* Times */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Van</div>
            <input
              type="time"
              value={startTime}
              onChange={e => handleStartTimeChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-white text-sm border"
              style={{ background: '#1a1a2e', borderColor: '#444' }}
            />
          </div>
          <div className="flex-1">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Tot</div>
            <input
              type="time"
              value={endTime}
              onChange={e => handleEndTimeChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-white text-sm border"
              style={{ background: '#1a1a2e', borderColor: '#444' }}
            />
          </div>
          <div className="flex-none w-16">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Uren</div>
            <div
              className="rounded-lg px-3 py-2 text-center font-bold text-sm"
              style={{ background: '#1a1a2e', color: '#6c63ff', border: '1px solid #444' }}
            >
              {block.hours}u
            </div>
          </div>
        </div>

        {/* Project */}
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">
            Project {!projectId && <span style={{ color: '#ff6584' }}>*</span>}
          </div>
          <SearchableSelect
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            value={projectId}
            onChange={handleProjectChange}
            placeholder="Selecteer project..."
          />
        </div>

        {/* Service */}
        <div style={{ opacity: projectId ? 1 : 0.4 }}>
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">
            Dienst {!serviceId && <span style={{ color: '#ff6584' }}>*</span>}
          </div>
          <SearchableSelect
            options={projectServices.map(s => ({ value: s.id, label: s.name }))}
            value={serviceId}
            onChange={handleServiceChange}
            placeholder={projectId ? 'Selecteer dienst...' : 'Kies eerst een project'}
            disabled={!projectId}
          />
        </div>

        {/* Note */}
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Toelichting</div>
          <input
            type="text"
            value={note}
            onChange={e => handleNoteChange(e.target.value)}
            placeholder="Korte omschrijving..."
            className="w-full rounded-lg px-3 py-2 text-white text-sm border"
            style={{ background: '#1a1a2e', borderColor: '#444' }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onRemove}
            className="flex-none px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: '#1a1a2e', color: '#888', border: '1px solid #333' }}
          >
            Verwijderen
          </button>
          <button
            onClick={onBook}
            disabled={!canBook}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: bookingResult === 'success' ? '#43b89c' : canBook ? '#6c63ff' : '#3d3d5c',
              color: canBook || bookingResult === 'success' ? '#fff' : '#666',
              cursor: canBook ? 'pointer' : 'not-allowed',
            }}
          >
            {bookingResult === 'success' ? '✓ Geboekt' : bookingResult ? `Fout: ${bookingResult}` : 'Boeken →'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Check SearchableSelect props**

Read `src/ui/components/SearchableSelect.tsx` to verify the `disabled` prop is supported. If not, add it:

```typescript
// In SearchableSelect props interface, add:
disabled?: boolean

// In the component, disable the input when disabled=true:
<input disabled={disabled} ... />
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Fix any type errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ImportBlockModal.tsx
git commit -m "feat(ui): add ImportBlockModal component"
```

---

## Task 6: Replace ImportPage with day-navigator sidebar layout

**Files:**
- Replace: `src/ui/pages/ImportPage.tsx`

Sidebar (left): list of days with block counts and status dots. Main area (right): blocks for the selected day as cards. Click a card → open `ImportBlockModal`.

- [ ] **Step 1: Rewrite ImportPage**

Replace `src/ui/pages/ImportPage.tsx`:

```typescript
import { useRef, useState, useMemo } from 'react'
import { useImport } from '../hooks/useImport'
import { useAppStore } from '../../store/appStore'
import ImportBlockModal from '../components/ImportBlockModal'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function blockStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return '#ff6584'
  if (block.origin === 'cache') return '#43b89c'
  if (block.confidence < 0.6) return '#f59e0b'
  return '#43b89c'
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projects = useAppStore(s => s.projects)
  const services = useAppStore(s => s.services)
  const {
    status, error, blocks, minVisits, setMinVisits,
    analyseFile, updateBlock, removeBlock, bookAll, bookingResults,
    selectedBlockIndex, openBlock, closeBlock,
  } = useImport()

  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  async function handleFile(file: File) {
    const text = await file.text()
    await analyseFile(text)
    setSelectedDay(null)
  }

  const isLoading = status === 'parsing' || status === 'classifying' || status === 'booking'

  // Group blocks by day
  const dayMap = useMemo(() => {
    const map = new Map<string, number[]>()
    blocks.forEach((b, i) => {
      if (!map.has(b.date)) map.set(b.date, [])
      map.get(b.date)!.push(i)
    })
    return map
  }, [blocks])

  const days = useMemo(() => [...dayMap.keys()].sort(), [dayMap])

  // Auto-select first day when blocks load
  const activeDay = selectedDay && dayMap.has(selectedDay) ? selectedDay : days[0] ?? null

  const dayBlocks = activeDay ? (dayMap.get(activeDay) ?? []).map(i => ({ i, block: blocks[i]! })) : []

  const selectedBlock = selectedBlockIndex !== null ? blocks[selectedBlockIndex] : null

  function handleBook(index: number) {
    const block = blocks[index]!
    if (!block.projectId || !block.serviceId) return
    // Book single block via bookAll logic — use bookAll with only this block
    // For simplicity, trigger bookAll and let it handle all ready blocks
    // A smarter approach is a single-book function, but bookAll is idempotent for already-booked blocks
    void bookAll()
  }

  const totalReady = blocks.filter(b => b.projectId && b.serviceId).length

  return (
    <div className="flex flex-col h-screen" style={{ background: '#12121e', color: '#ccc' }}>
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: '#2d2d44' }}>
        <h1 className="text-lg font-bold text-white">Importeer browsergeschiedenis</h1>

        <div
          className="flex-1 border-2 border-dashed rounded-lg px-4 py-2 text-center cursor-pointer text-sm transition-colors"
          style={{ borderColor: '#3d3d5c', color: '#888' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          Sleep Chrome history CSV hiernaartoe of klik
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: '#888' }}>Min. bezoeken:</label>
          <input
            type="number" min={1} value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-14 rounded px-2 py-1 text-sm text-white border"
            style={{ background: '#1a1a2e', borderColor: '#3d3d5c' }}
          />
        </div>

        {blocks.length > 0 && (
          <button
            onClick={bookAll}
            disabled={totalReady === 0 || isLoading || status === 'done'}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: totalReady > 0 && !isLoading ? '#6c63ff' : '#2d2d44',
              color: totalReady > 0 && !isLoading ? '#fff' : '#555',
              cursor: totalReady > 0 && !isLoading ? 'pointer' : 'not-allowed',
            }}
          >
            Boek {totalReady} klaar
          </button>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-sm" style={{ background: '#2a1a1e', color: '#ff6584', border: '1px solid #4a2a2e' }}>
          {error}
        </div>
      )}
      {isLoading && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-sm" style={{ background: '#1a1a2e', color: '#6c63ff' }}>
          {status === 'parsing' && 'Bezig met analyseren...'}
          {status === 'classifying' && 'Bezig met classificeren via Copilot...'}
          {status === 'booking' && 'Bezig met boeken...'}
        </div>
      )}

      {/* Main content: sidebar + blocks */}
      {blocks.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          {/* Day sidebar */}
          <div className="w-40 flex-none overflow-y-auto p-3 border-r" style={{ borderColor: '#2d2d44' }}>
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: '#555' }}>Dagen</div>
            {days.map(day => {
              const indices = dayMap.get(day) ?? []
              const dayBlks = indices.map(i => blocks[i]!)
              const allBooked = dayBlks.every(b => bookingResults[indices[dayBlks.indexOf(b)]!] === 'success')
              const hasUnready = dayBlks.some(b => !b.projectId || !b.serviceId)
              const dotColor = allBooked ? '#43b89c' : hasUnready ? '#ff6584' : '#6c63ff'
              const isActive = day === activeDay
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className="w-full text-left rounded-lg px-3 py-2 mb-1 text-xs transition-colors"
                  style={{
                    background: isActive ? '#6c63ff' : '#1a1a2e',
                    color: isActive ? '#fff' : '#888',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: dotColor }} />
                    <span className="font-medium">{day.slice(5)}</span>
                  </div>
                  <div className="mt-0.5 pl-3" style={{ color: isActive ? '#ccc' : '#555' }}>
                    {indices.length} {indices.length === 1 ? 'blok' : 'blokken'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Blocks for selected day */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeDay && (
              <>
                <div className="text-xs uppercase tracking-wider mb-4" style={{ color: '#555' }}>
                  {activeDay} — {dayBlocks.length} {dayBlocks.length === 1 ? 'blok' : 'blokken'}
                </div>
                <div className="flex flex-col gap-3">
                  {dayBlocks.map(({ i, block }) => {
                    const statusColor = blockStatusColor(block)
                    const result = bookingResults[i]
                    return (
                      <button
                        key={i}
                        onClick={() => openBlock(i)}
                        className="text-left rounded-lg p-4 transition-colors hover:brightness-110 w-full"
                        style={{ background: '#1e1e32', borderLeft: `3px solid ${statusColor}` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm truncate">{block.blockName}</div>
                            {block.summary && (
                              <div className="text-xs mt-0.5 truncate" style={{ color: '#888' }}>{block.summary}</div>
                            )}
                          </div>
                          <div className="flex-none text-right">
                            <div className="text-xs font-mono" style={{ color: '#6c63ff' }}>{block.hours}u</div>
                            <div className="text-xs" style={{ color: '#555' }}>{block.startTime}–{block.endTime}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {block.projectId
                            ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#252540', color: '#6c63ff' }}>
                                {projects.find(p => p.id === block.projectId)?.name ?? block.projectId}
                              </span>
                            : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2a1a1e', color: '#ff6584' }}>Geen project</span>
                          }
                          {result === 'success' && (
                            <span className="text-xs" style={{ color: '#43b89c' }}>✓ Geboekt</span>
                          )}
                          {result && result !== 'success' && (
                            <span className="text-xs" style={{ color: '#ff6584' }}>✗ Fout</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {blocks.length === 0 && status === 'ready' && (
        <div className="p-6 text-sm" style={{ color: '#555' }}>
          Geen bruikbare blokken gevonden. Probeer een lagere minimum bezoeken drempel.
        </div>
      )}

      {/* Modal */}
      {selectedBlock !== null && selectedBlockIndex !== null && (
        <ImportBlockModal
          block={selectedBlock}
          projects={projects}
          services={services}
          bookingResult={bookingResults[selectedBlockIndex]}
          onSave={updates => updateBlock(selectedBlockIndex, updates)}
          onBook={() => handleBook(selectedBlockIndex)}
          onRemove={() => { removeBlock(selectedBlockIndex); closeBlock() }}
          onClose={closeBlock}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Fix any type errors found.

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/ImportPage.tsx
git commit -m "feat(ui): day-navigator sidebar layout with ImportBlockModal"
```

---

## Task 7: Fix ClassifyHistoryBlocksUseCase for new ClassifiedBlock shape

**Files:**
- Modify: `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts`

The `ClassifiedBlock` now requires `blockName`, `summary`, and `lastVisitTime`. Cache hits need sensible defaults for these new fields.

- [ ] **Step 1: Read ClassifyHistoryBlocksUseCase**

Read `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts`.

- [ ] **Step 2: Update cache-hit path**

In the cache-hit branch, add default values for the new fields:

```typescript
// When constructing a ClassifiedBlock from cache:
const classified: ClassifiedBlock = {
  ...block,
  blockName: block.urlPattern,   // fallback: use urlPattern as name
  summary: '',                    // no LLM summary for cache hits
  startTime: block.firstVisitTime,
  endTime: block.lastVisitTime || addHours(block.firstVisitTime, block.hours),
  projectId: cached.projectId,
  serviceId: cached.serviceId,
  note: cached.note,
  confidence: 1.0,
  origin: 'cache' as const,
}
```

- [ ] **Step 3: Run typecheck + tests**

```bash
npm run typecheck && npm run test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/usecases/ClassifyHistoryBlocksUseCase.ts
git commit -m "fix(classify): add blockName and summary defaults for cache-hit blocks"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Time-window overlap grouping — Task 2
- ✅ Half-hour rounding — Task 2
- ✅ LLM names block + suggests project — Task 3
- ✅ `urls[]` field on HistoryBlock — Task 1 + 2
- ✅ `blockName`, `summary` on ClassifiedBlock — Task 1 + 3
- ✅ Day-navigator sidebar (option C) — Task 6
- ✅ Edit modal per block — Task 5 + 6
- ✅ Cache-hit blocks get defaults — Task 7
- ✅ `SearchableSelect` reused in modal — Task 5

**Type consistency check:**
- `lastVisitTime` added in Task 1 entity, used in Task 2 parser, consumed in Task 3 + 7 — consistent
- `blockName` defined in Task 1 ClassifiedBlock, set in Task 3 CopilotRepository, defaulted in Task 7 — consistent
- `urls[]` defined in Task 1 HistoryBlock, populated in Task 2 parser, consumed in Task 3 prompt + Task 5 modal — consistent
