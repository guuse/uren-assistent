# Unified Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Samenvoegen van de agenda-flow en de import-flow tot één centrale agenda-view waarbij LLM-voorstellen als klikbare concept-blokken op de tijdlijn staan.

**Architecture:** `WeekPage` wordt de enige home. Browser history (CSV) wordt opgeslagen in een nieuwe `HistoryStore` (JSON via Tauri fs). `DayTimeline` toont geboekte entries én concept-blokken gemixed op dezelfde tijdlijn. `ImportPage` en `ImportBlockCard` vervallen.

**Tech Stack:** React 18, TypeScript strict, Zustand, Tauri v2 (`@tauri-apps/plugin-fs`), Vitest, Tailwind CSS

---

## Bestandsoverzicht

| Actie | Pad |
|---|---|
| Create | `src/domain/repositories/IHistoryStore.ts` |
| Create | `src/infrastructure/storage/HistoryStore.ts` |
| Create | `src/ui/hooks/useHistoryStore.ts` |
| Modify | `src/ui/components/DayTimeline.helpers.ts` |
| Modify | `src/ui/components/DayTimeline.tsx` |
| Modify | `src/ui/components/WeekDayList.tsx` |
| Modify | `src/ui/pages/BookingModal.tsx` |
| Modify | `src/ui/pages/WeekPage.tsx` |
| Modify | `src/ui/components/Sidebar.tsx` |
| Modify | `src/App.tsx` |
| Delete | `src/ui/pages/ImportPage.tsx` |
| Delete | `src/ui/components/ImportBlockCard.tsx` |
| Create | `tests/unit/usecases/HistoryStore.test.ts` |
| Create | `tests/unit/usecases/mergeConceptsIntoTimeline.test.ts` |

---

## Task 1: Definieer `IHistoryStore` interface

**Files:**
- Create: `src/domain/repositories/IHistoryStore.ts`

- [ ] **Stap 1: Schrijf het interface-bestand**

```ts
// src/domain/repositories/IHistoryStore.ts
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'

export interface IHistoryStore {
  load(): Promise<void>
  getBlocksForDate(date: string): Promise<ClassifiedBlock[]>
  setBlocksForDate(date: string, blocks: ClassifiedBlock[]): Promise<void>
  removeBlock(date: string, urlPattern: string): Promise<void>
  hasDataForDate(date: string): Promise<boolean>
}
```

- [ ] **Stap 2: Commit**

```bash
git add src/domain/repositories/IHistoryStore.ts
git commit -m "feat: add IHistoryStore domain interface"
```

---

## Task 2: Implementeer `HistoryStore`

**Files:**
- Create: `src/infrastructure/storage/HistoryStore.ts`
- Create: `tests/unit/usecases/HistoryStore.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

```ts
// tests/unit/usecases/HistoryStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  BaseDirectory: { AppData: 'AppData' },
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app'),
}))

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { HistoryStore } from '../../../src/infrastructure/storage/HistoryStore'
import type { ClassifiedBlock } from '../../../src/domain/entities/ClassifiedBlock'

function makeBlock(urlPattern: string, date: string): ClassifiedBlock {
  return {
    date,
    urlPattern,
    urls: [],
    titles: [],
    visitCount: 1,
    firstVisitTime: new Date(),
    lastVisitTime: new Date(),
    hours: 1,
    blockName: 'Test',
    summary: 'test',
    startTime: '09:00',
    endTime: '10:00',
    confidence: 0.9,
    origin: 'llm',
  }
}

describe('HistoryStore', () => {
  beforeEach(() => {
    vi.mocked(readTextFile).mockRejectedValue(new Error('not found'))
    vi.mocked(writeTextFile).mockResolvedValue(undefined)
  })

  it('geeft lege array terug voor onbekende datum', async () => {
    const store = new HistoryStore()
    await store.load()
    const blocks = await store.getBlocksForDate('2026-05-21')
    expect(blocks).toEqual([])
  })

  it('slaat blokken op en haalt ze terug', async () => {
    const store = new HistoryStore()
    await store.load()
    const block = makeBlock('github.com', '2026-05-21')
    await store.setBlocksForDate('2026-05-21', [block])
    const blocks = await store.getBlocksForDate('2026-05-21')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.urlPattern).toBe('github.com')
  })

  it('mergt nieuwe blokken met bestaande op basis van urlPattern', async () => {
    const store = new HistoryStore()
    await store.load()
    const block1 = makeBlock('github.com', '2026-05-21')
    const block2 = makeBlock('figma.com', '2026-05-21')
    await store.setBlocksForDate('2026-05-21', [block1])
    await store.setBlocksForDate('2026-05-21', [block2])
    const blocks = await store.getBlocksForDate('2026-05-21')
    expect(blocks).toHaveLength(2)
  })

  it('verwijdert een blok op urlPattern', async () => {
    const store = new HistoryStore()
    await store.load()
    const block = makeBlock('github.com', '2026-05-21')
    await store.setBlocksForDate('2026-05-21', [block])
    await store.removeBlock('2026-05-21', 'github.com')
    const blocks = await store.getBlocksForDate('2026-05-21')
    expect(blocks).toHaveLength(0)
  })

  it('hasDataForDate geeft false terug voor lege datum', async () => {
    const store = new HistoryStore()
    await store.load()
    expect(await store.hasDataForDate('2026-05-21')).toBe(false)
  })

  it('hasDataForDate geeft true terug na setBlocksForDate', async () => {
    const store = new HistoryStore()
    await store.load()
    await store.setBlocksForDate('2026-05-21', [makeBlock('github.com', '2026-05-21')])
    expect(await store.hasDataForDate('2026-05-21')).toBe(true)
  })

  it('laadt bestaande data uit JSON-bestand', async () => {
    const block = makeBlock('github.com', '2026-05-21')
    const stored = { '2026-05-21': [block] }
    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(stored))
    const store = new HistoryStore()
    await store.load()
    expect(await store.hasDataForDate('2026-05-21')).toBe(true)
  })
})
```

- [ ] **Stap 2: Voer test uit — verwacht FAIL**

```bash
npm run test -- tests/unit/usecases/HistoryStore.test.ts
```

Verwacht: `Cannot find module '../../../src/infrastructure/storage/HistoryStore'`

- [ ] **Stap 3: Implementeer `HistoryStore`**

```ts
// src/infrastructure/storage/HistoryStore.ts
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { IHistoryStore } from '../../domain/repositories/IHistoryStore'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

const FILENAME = 'history-store.json'

export class HistoryStore implements IHistoryStore {
  private data: Record<string, ClassifiedBlock[]> = {}

  private async filePath(): Promise<string> {
    const dir = await appDataDir()
    return `${dir}/${FILENAME}`
  }

  async load(): Promise<void> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      this.data = JSON.parse(raw) as Record<string, ClassifiedBlock[]>
    } catch {
      this.data = {}
    }
  }

  private async persist(): Promise<void> {
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(this.data, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
  }

  async getBlocksForDate(date: string): Promise<ClassifiedBlock[]> {
    return this.data[date] ?? []
  }

  async setBlocksForDate(date: string, blocks: ClassifiedBlock[]): Promise<void> {
    const existing = this.data[date] ?? []
    const merged = [...existing]
    for (const block of blocks) {
      const idx = merged.findIndex(b => b.urlPattern === block.urlPattern)
      if (idx !== -1) {
        merged[idx] = block
      } else {
        merged.push(block)
      }
    }
    this.data[date] = merged
    await this.persist()
  }

  async removeBlock(date: string, urlPattern: string): Promise<void> {
    if (!this.data[date]) return
    this.data[date] = this.data[date]!.filter(b => b.urlPattern !== urlPattern)
    if (this.data[date]!.length === 0) delete this.data[date]
    await this.persist()
  }

  async hasDataForDate(date: string): Promise<boolean> {
    return (this.data[date]?.length ?? 0) > 0
  }
}
```

- [ ] **Stap 4: Voer test uit — verwacht PASS**

```bash
npm run test -- tests/unit/usecases/HistoryStore.test.ts
```

Verwacht: alle 7 tests groen.

- [ ] **Stap 5: Commit**

```bash
git add src/infrastructure/storage/HistoryStore.ts tests/unit/usecases/HistoryStore.test.ts
git commit -m "feat: add HistoryStore infrastructure + tests"
```

---

## Task 3: Registreer `HistoryStore` als singleton in `container.ts`

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Stap 1: Voeg export toe**

Voeg onderaan de bestaande singleton-exports toe (na `mappingCacheRepo`):

```ts
// src/application/container.ts — voeg toe na regel: export const mappingCacheRepo = new MappingCacheRepository()
import { HistoryStore } from '../infrastructure/storage/HistoryStore'

export const historyStore = new HistoryStore()
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/application/container.ts
git commit -m "feat: register historyStore singleton in container"
```

---

## Task 4: `mergeConceptsIntoTimeline` helper

**Files:**
- Modify: `src/ui/components/DayTimeline.helpers.ts`
- Create: `tests/unit/usecases/mergeConceptsIntoTimeline.test.ts`

- [ ] **Stap 1: Schrijf de falende test**

```ts
// tests/unit/usecases/mergeConceptsIntoTimeline.test.ts
import { describe, it, expect } from 'vitest'
import { mergeConceptsIntoTimeline } from '../../../src/ui/components/DayTimeline.helpers'
import type { HourEntry } from '../../../src/domain/entities/HourEntry'
import type { ClassifiedBlock } from '../../../src/domain/entities/ClassifiedBlock'

function makeEntry(startTime: string, endTime: string): HourEntry {
  return {
    employeeId: 'e1', projectId: 'p1', projectServiceId: 's1',
    hourTypeId: 'ht1', hours: 1, startDate: '2026-05-21',
    startTime, endTime, note: '',
  }
}

function makeConcept(startTime: string, endTime: string, urlPattern = 'github.com'): ClassifiedBlock {
  return {
    date: '2026-05-21', urlPattern, urls: [], titles: [],
    visitCount: 1, firstVisitTime: new Date(), lastVisitTime: new Date(), hours: 1,
    blockName: 'Test', summary: 'test', startTime, endTime,
    confidence: 0.9, origin: 'llm',
  }
}

describe('mergeConceptsIntoTimeline', () => {
  it('geeft alleen gaten terug bij lege inputs', () => {
    const blocks = mergeConceptsIntoTimeline([], [], '08:00', '10:00')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('gap')
  })

  it('plaatst een concept-blok op de juiste plek', () => {
    const concept = makeConcept('09:00', '10:00')
    const blocks = mergeConceptsIntoTimeline([], [concept], '08:00', '11:00')
    const types = blocks.map(b => b.type)
    expect(types).toEqual(['gap', 'concept', 'gap'])
  })

  it('plaatst een entry en een concept naast elkaar', () => {
    const entry = makeEntry('08:00', '09:00')
    const concept = makeConcept('09:00', '10:00')
    const blocks = mergeConceptsIntoTimeline([entry], [concept], '08:00', '11:00')
    const types = blocks.map(b => b.type)
    expect(types).toEqual(['entry', 'concept', 'gap'])
  })

  it('sorteert op startTime ongeacht invoervolgorde', () => {
    const entry = makeEntry('10:00', '11:00')
    const concept = makeConcept('08:00', '09:00')
    const blocks = mergeConceptsIntoTimeline([entry], [concept], '08:00', '12:00')
    expect(blocks[0]!.type).toBe('concept')
    expect(blocks[1]!.type).toBe('gap')
    expect(blocks[2]!.type).toBe('entry')
    expect(blocks[3]!.type).toBe('gap')
  })

  it('een concept-blok heeft type "concept" en bevat het block-object', () => {
    const concept = makeConcept('09:00', '10:00')
    const blocks = mergeConceptsIntoTimeline([], [concept], '08:00', '11:00')
    const conceptBlock = blocks.find(b => b.type === 'concept')!
    expect(conceptBlock.type).toBe('concept')
    if (conceptBlock.type === 'concept') {
      expect(conceptBlock.block.urlPattern).toBe('github.com')
    }
  })
})
```

- [ ] **Stap 2: Voer test uit — verwacht FAIL**

```bash
npm run test -- tests/unit/usecases/mergeConceptsIntoTimeline.test.ts
```

Verwacht: `mergeConceptsIntoTimeline is not a function`

- [ ] **Stap 3: Voeg type en functie toe aan `DayTimeline.helpers.ts`**

Open `src/ui/components/DayTimeline.helpers.ts`. Voeg toe **na** de bestaande `TimelineBlock` type-definitie en **na** de helper functies, maar vóór `computeTimelineBlocks`:

```ts
// Voeg toe aan bestaand TimelineBlock union type — vervang de hele type-definitie:
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

export type TimelineBlock =
  | { type: 'entry'; startTime: string; endTime: string; entry: HourEntry; suggestion?: never; block?: never }
  | { type: 'gap'; startTime: string; endTime: string; entry?: never; suggestion?: HourEntrySuggestion; block?: never }
  | { type: 'concept'; startTime: string; endTime: string; entry?: never; suggestion?: never; block: ClassifiedBlock }
```

Voeg daarna de nieuwe functie toe **na** `computeTimelineBlocks`:

```ts
export function mergeConceptsIntoTimeline(
  entries: HourEntry[],
  concepts: ClassifiedBlock[],
  dayStart: string,
  dayEnd: string,
): TimelineBlock[] {
  type Item =
    | { kind: 'entry'; startTime: string; endTime: string; entry: HourEntry }
    | { kind: 'concept'; startTime: string; endTime: string; block: ClassifiedBlock }

  const items: Item[] = [
    ...entries.map(e => ({ kind: 'entry' as const, startTime: e.startTime, endTime: e.endTime, entry: e })),
    ...concepts.map(c => ({ kind: 'concept' as const, startTime: c.startTime, endTime: c.endTime, block: c })),
  ].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

  const blocks: TimelineBlock[] = []
  let cursor = timeToMinutes(dayStart)
  const end = timeToMinutes(dayEnd)

  for (const item of items) {
    const itemStart = timeToMinutes(item.startTime)
    const itemEnd = timeToMinutes(item.endTime)
    if (itemStart > cursor) {
      blocks.push({ type: 'gap', startTime: minutesToTime(cursor), endTime: minutesToTime(itemStart) })
    }
    if (item.kind === 'entry') {
      blocks.push({ type: 'entry', startTime: item.startTime, endTime: item.endTime, entry: item.entry })
    } else {
      blocks.push({ type: 'concept', startTime: item.startTime, endTime: item.endTime, block: item.block })
    }
    cursor = Math.max(cursor, itemEnd)
  }

  if (cursor < end) {
    blocks.push({ type: 'gap', startTime: minutesToTime(cursor), endTime: minutesToTime(end) })
  }

  return blocks
}
```

- [ ] **Stap 4: Voer test uit — verwacht PASS**

```bash
npm run test -- tests/unit/usecases/mergeConceptsIntoTimeline.test.ts
```

Verwacht: alle 5 tests groen.

- [ ] **Stap 5: Voer alle tests uit — verwacht geen regressie**

```bash
npm run test
```

- [ ] **Stap 6: Commit**

```bash
git add src/ui/components/DayTimeline.helpers.ts tests/unit/usecases/mergeConceptsIntoTimeline.test.ts
git commit -m "feat: add mergeConceptsIntoTimeline + concept TimelineBlock type"
```

---

## Task 5: `useHistoryStore` hook

**Files:**
- Create: `src/ui/hooks/useHistoryStore.ts`

- [ ] **Stap 1: Schrijf de hook**

```ts
// src/ui/hooks/useHistoryStore.ts
import { useState, useEffect, useCallback } from 'react'
import { historyStore } from '../../application/container'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

export function useHistoryStore(selectedDate: string) {
  const [blocksForDate, setBlocksForDate] = useState<ClassifiedBlock[]>([])
  const [hasData, setHasData] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const reload = useCallback(async (date: string) => {
    await historyStore.load()
    const blocks = await historyStore.getBlocksForDate(date)
    const has = await historyStore.hasDataForDate(date)
    setBlocksForDate(blocks)
    setHasData(has)
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    void reload(selectedDate)
  }, [selectedDate, reload])

  const saveBlocksForDate = useCallback(async (date: string, blocks: ClassifiedBlock[]) => {
    await historyStore.setBlocksForDate(date, blocks)
    void reload(date)
  }, [reload])

  const removeBlock = useCallback(async (date: string, urlPattern: string) => {
    await historyStore.removeBlock(date, urlPattern)
    void reload(date)
  }, [reload])

  const conceptCountForDate = useCallback(async (date: string): Promise<number> => {
    const blocks = await historyStore.getBlocksForDate(date)
    return blocks.length
  }, [])

  return {
    blocksForDate,
    hasData,
    isLoaded,
    saveBlocksForDate,
    removeBlock,
    conceptCountForDate,
  }
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/ui/hooks/useHistoryStore.ts
git commit -m "feat: add useHistoryStore hook"
```

---

## Task 6: Pas `WeekDayList` aan — concept-badge

**Files:**
- Modify: `src/ui/components/WeekDayList.tsx`

- [ ] **Stap 1: Voeg `conceptCountForDate` prop toe**

Vervang de `Props` interface en de component-definitie. Voeg de badge toe onder de `ProgressBar`:

```tsx
// src/ui/components/WeekDayList.tsx — volledige nieuwe versie

const DAY_LABELS: Record<string, string> = {
  '1': 'MA', '2': 'DI', '3': 'WO', '4': 'DO', '5': 'VR',
}

interface Props {
  weekDays: string[]
  selectedDate: string
  hoursForDate: (date: string) => number
  conceptCountForDate?: (date: string) => number
  onSelectDate: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  weekLabel: string
}

const TARGET_HOURS = 8

function ProgressBar({ hours }: { hours: number }) {
  const pct = Math.min(100, (hours / TARGET_HOURS) * 100)
  const color = hours >= TARGET_HOURS ? 'bg-green-500' : hours > 0 ? 'bg-amber-500' : 'bg-transparent'
  return (
    <div className="h-[3px] bg-[#2e2a26] rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function WeekDayList({
  weekDays,
  selectedDate,
  hoursForDate,
  conceptCountForDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  weekLabel,
}: Props) {
  return (
    <div className="w-[130px] flex-shrink-0 bg-[#171512] border-r border-[#2e2a26] flex flex-col py-3 px-2">
      <div className="text-[#4a4540] text-[9px] uppercase tracking-widest mb-2 px-1">{weekLabel}</div>

      <div className="flex flex-col gap-1 flex-1">
        {weekDays.map((date) => {
          const dayNum = new Date(date).getDay().toString()
          const label = DAY_LABELS[dayNum] ?? ''
          const dayOfMonth = new Date(date).getDate()
          const hours = hoursForDate(date)
          const conceptCount = conceptCountForDate?.(date) ?? 0
          const isSelected = date === selectedDate
          const isFull = hours >= TARGET_HOURS

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`text-left px-2 py-2 rounded-lg transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#252220] border border-[#6366f1]'
                  : 'hover:bg-[#252220] border border-transparent'
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`text-[10px] font-semibold ${
                    isSelected ? 'text-[#a5b4fc]' : isFull ? 'text-[#94a3b8]' : 'text-[#64748b]'
                  }`}
                >
                  {label} {dayOfMonth}
                </span>
                {isFull && <span className="text-green-500 text-[9px]">✓</span>}
                {!isFull && hours > 0 && <span className="text-amber-500 text-[9px]">●</span>}
              </div>
              <ProgressBar hours={hours} />
              <div className="text-[8px] text-[#475569] mt-1">
                {hours > 0 ? `${hours} / ${TARGET_HOURS}u` : `0 / ${TARGET_HOURS}u`}
              </div>
              {conceptCount > 0 && !isFull && (
                <div className="mt-1">
                  <span className="bg-[#2a2010] text-[#a07848] text-[8px] px-[5px] py-[1px] rounded">
                    {conceptCount} concept{conceptCount !== 1 ? 'en' : ''}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex justify-between items-center px-1 mt-2">
        <button
          onClick={onPrevWeek}
          className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
        >
          ‹
        </button>
        <span className="text-[#4a4540] text-[8px]">{weekLabel}</span>
        <button
          onClick={onNextWeek}
          className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
        >
          ›
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/WeekDayList.tsx
git commit -m "feat: add concept count badge to WeekDayList"
```

---

## Task 7: Pas `DayTimeline` aan — concept-blokken + CTA

**Files:**
- Modify: `src/ui/components/DayTimeline.tsx`

- [ ] **Stap 1: Vervang `DayTimeline.tsx` volledig**

```tsx
// src/ui/components/DayTimeline.tsx
import { useRef } from 'react'
import { mergeConceptsIntoTimeline, computeTimelineBlocks } from './DayTimeline.helpers'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { useAppStore } from '../../store/appStore'

const DAY_START = '08:00'
const DAY_END = '18:00'
const HOUR_HEIGHT_PX = 48

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function blockHeight(startTime: string, endTime: string): number {
  const mins = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max(24, (mins / 60) * HOUR_HEIGHT_PX)
}

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

interface Props {
  date: string
  entries: HourEntry[]
  suggestions: HourEntrySuggestion[]
  conceptBlocks?: ClassifiedBlock[]
  onBookSuggestion: (suggestion: HourEntrySuggestion) => void
  onEditEntry: (entry: HourEntry) => void
  onConceptClick?: (block: ClassifiedBlock) => void
  onUploadCsv?: (csvContent: string) => void
  isClassifying?: boolean
}

export function DayTimeline({
  date,
  entries,
  suggestions,
  conceptBlocks = [],
  onBookSuggestion,
  onEditEntry,
  onConceptClick,
  onUploadCsv,
  isClassifying = false,
}: Props) {
  const projects = useAppStore((s) => s.projects)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasConcepts = conceptBlocks.length > 0
  const hasEntries = entries.length > 0
  const showCta = !hasConcepts && !hasEntries && !isClassifying

  const blocks = hasConcepts || hasEntries
    ? mergeConceptsIntoTimeline(entries, conceptBlocks, DAY_START, DAY_END)
    : computeTimelineBlocks(entries, suggestions, DAY_START, DAY_END)

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const pct = Math.min(100, (totalHours / 8) * 100)
  const progressColor = totalHours >= 8 ? 'bg-green-500' : totalHours > 0 ? 'bg-amber-500' : 'bg-[#374151]'

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  function projectName(projectId: string): string {
    return projects.find((p) => p.id === projectId)?.name ?? projectId
  }

  function suggestionLabel(s: HourEntrySuggestion): string {
    const name = projectName(s.projectId)
    const reason = s.reason === 'last-week' ? 'vorige week' : 'patroon'
    const time = s.startTime ? ` · ${s.startTime}–${s.endTime}` : ''
    return `${name}${time} (${reason})`
  }

  async function handleFileDrop(file: File) {
    const text = await file.text()
    onUploadCsv?.(text)
  }

  const pendingCount = conceptBlocks.filter(b => !b.projectId || !b.serviceId).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2e2a26] flex items-center gap-4 flex-shrink-0">
        <div>
          <div className="text-[#e8e2d9] font-bold capitalize">{dateLabel}</div>
          {hasConcepts ? (
            <div className="text-[#a07848] text-[11px] mt-0.5">
              {totalHours}u geboekt · {pendingCount > 0 ? `${pendingCount} concept${pendingCount !== 1 ? 'en' : ''} te bevestigen` : 'alle concepten compleet'}
            </div>
          ) : (
            <div className={`text-[11px] mt-0.5 ${totalHours >= 8 ? 'text-green-400' : 'text-amber-400'}`}>
              {totalHours}u geboekt · {Math.max(0, 8 - totalHours)}u te gaan
            </div>
          )}
        </div>
        <div className="flex-1 h-[5px] bg-[#2e2a26] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${pct}%` }} />
        </div>
        {(hasConcepts || hasEntries) && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#252220] border border-[#2e2a26] text-[#7a7268] rounded px-[10px] py-[4px] text-[10px] hover:border-[#3e3a36] transition-colors cursor-pointer flex-shrink-0"
          >
            ↑ Nieuwe CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) void handleFileDrop(f)
                e.target.value = ''
              }}
            />
          </button>
        )}
      </div>

      {/* Classifying spinner */}
      {isClassifying && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#7a7268] text-[12px]">Bezig met classificeren...</div>
        </div>
      )}

      {/* CTA — geen history */}
      {showCta && (
        <div
          className="flex-1 flex items-center justify-center px-4"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) void handleFileDrop(file)
          }}
        >
          <div className="border-2 border-dashed border-[#3a5a2a] rounded-xl px-8 py-10 flex flex-col items-center gap-3 w-full max-w-sm bg-[#1e2418]">
            <div className="w-12 h-12 bg-[#2a3a20] rounded-full flex items-center justify-center text-[#6aaa4a] text-2xl">↑</div>
            <div className="text-[#e8e2d9] text-[13px] font-bold text-center">Geen browsergeschiedenis voor deze dag</div>
            <div className="text-[#7a7268] text-[10px] text-center leading-relaxed">
              Upload een Chrome history CSV om deze dag automatisch<br/>te laten invullen via de LLM.
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#e8e2d9] text-[#1c1917] border-none rounded-lg px-5 py-2 text-[11px] font-bold cursor-pointer hover:bg-[#d5cfc6] transition-colors"
            >
              + Chrome history uploaden
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) void handleFileDrop(f)
                  e.target.value = ''
                }}
              />
            </button>
            <div className="text-[#4a4540] text-[9px]">of sleep een .csv bestand hiernaartoe</div>
          </div>
        </div>
      )}

      {/* Tijdlijn */}
      {!showCta && !isClassifying && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex gap-3">
            {/* Uurlabels */}
            <div className="flex flex-col flex-shrink-0 w-8">
              {Array.from({ length: 10 }, (_, i) => i + 8).map((hour) => (
                <div
                  key={hour}
                  className="text-[#475569] text-[9px] flex items-start"
                  style={{ height: HOUR_HEIGHT_PX }}
                >
                  {hour.toString().padStart(2, '0')}
                </div>
              ))}
            </div>

            {/* Blokken */}
            <div className="flex-1 flex flex-col gap-[1px]">
              {blocks.map((block, i) => {
                const height = blockHeight(block.startTime, block.endTime)

                if (block.type === 'entry') {
                  return (
                    <button
                      key={i}
                      onClick={() => onEditEntry(block.entry)}
                      style={{ height }}
                      className="w-full text-left bg-indigo-950 border-l-[3px] border-indigo-500 rounded-r px-3 py-1 hover:bg-indigo-900 transition-colors cursor-pointer flex flex-col justify-center"
                    >
                      <div className="text-[#e8e2d9] text-[11px] font-semibold truncate">
                        {projectName(block.entry.projectId)}
                      </div>
                      <div className="text-indigo-300 text-[9px]">
                        {block.entry.startTime}–{block.entry.endTime} · {block.entry.hours}u
                      </div>
                      {block.entry.note && (
                        <div className="text-[#64748b] text-[9px] truncate">{block.entry.note}</div>
                      )}
                    </button>
                  )
                }

                if (block.type === 'concept') {
                  const status = conceptStatus(block.block)
                  const s = CONCEPT_STYLES[status]
                  const badgeLabel = block.block.origin === 'cache'
                    ? 'Cache'
                    : `${Math.round(block.block.confidence * 100)}% zeker`
                  return (
                    <button
                      key={i}
                      onClick={() => onConceptClick?.(block.block)}
                      style={{ height }}
                      className={`relative w-full text-left ${s.bg} ${s.border} rounded px-3 py-1 hover:brightness-110 transition-all cursor-pointer flex flex-col justify-center`}
                    >
                      <span className={`absolute right-2 top-1.5 text-[9px] px-[6px] py-[2px] rounded ${s.badge}`}>
                        {badgeLabel}
                      </span>
                      <div className="text-[#e8e2d9] text-[11px] font-semibold truncate pr-16">
                        {block.block.blockName}
                      </div>
                      <div className={`text-[9px] ${s.sub}`}>
                        {block.block.startTime}–{block.block.endTime}
                        {block.block.projectId ? ` · ${projectName(block.block.projectId)}` : ''}
                      </div>
                      {(!block.block.projectId || !block.block.serviceId) && (
                        <div className="text-[#7a7268] text-[9px]">⚠ Project ontbreekt — klik om in te vullen</div>
                      )}
                    </button>
                  )
                }

                // gap
                if (block.suggestion) {
                  return (
                    <div
                      key={i}
                      style={{ height }}
                      className="w-full bg-[#1a2332] border border-dashed border-indigo-800 rounded px-3 py-1 flex items-center justify-between"
                    >
                      <div className="text-indigo-400 text-[10px] truncate flex-1 mr-2">
                        → {suggestionLabel(block.suggestion)}
                      </div>
                      <button
                        onClick={() => onBookSuggestion(block.suggestion!)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] px-2 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
                      >
                        + Boek
                      </button>
                    </div>
                  )
                }

                return (
                  <div
                    key={i}
                    style={{ height }}
                    className="w-full bg-[#16213e] rounded border border-[#1e293b]"
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/DayTimeline.tsx
git commit -m "feat: DayTimeline supports concept blocks and CSV upload CTA"
```

---

## Task 8: Pas `BookingModal` aan — evidence-strip + concept pre-fill

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Stap 1: Vervang `BookingModal.tsx` volledig**

```tsx
// src/ui/pages/BookingModal.tsx
import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { TimeSelect } from '../components/TimeSelect'
import EvidencePanel from '../components/EvidencePanel'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

interface Props {
  initialEntry?: Partial<HourEntry>
  title?: string
  evidenceBlock?: ClassifiedBlock
  onClose: () => void
  onBooked?: () => void
}

export function BookingModal({ initialEntry = {}, title = 'Uren boeken', evidenceBlock, onClose, onBooked }: Props) {
  const booking = useBooking(initialEntry)

  if (booking.status === 'success') {
    onBooked?.()
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#252220] rounded-xl p-6 w-80 text-center flex flex-col gap-4">
          <div className="text-[#5a8a6a] text-4xl">✓</div>
          <div className="text-[#e8e2d9] font-semibold">Uren geboekt!</div>
          <button
            onClick={onClose}
            className="bg-[#e8e2d9] text-[#1c1917] py-2 rounded-lg text-sm font-medium hover:bg-[#d5cfc6] transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#252220] rounded-xl p-6 w-96 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="text-[#e8e2d9] font-bold">{title}</div>
          <button onClick={onClose} className="text-[#4a4540] hover:text-[#e8e2d9] text-lg">✕</button>
        </div>

        {evidenceBlock && (
          <EvidencePanel
            rawUrls={evidenceBlock.rawUrls}
            rawTitles={evidenceBlock.rawTitles}
          />
        )}

        {/* Datum */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Datum</label>
          <input
            type="date"
            value={booking.date}
            onChange={(e) => booking.setDate(e.target.value)}
            className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          />
        </div>

        {/* Tijden */}
        <div className="flex gap-3">
          <TimeSelect label="Van" value={booking.startTime} onChange={(time) => {
            booking.setStartTime(time)
            if (booking.endTime <= time) {
              const [h, m] = time.split(':').map(Number)
              const next = h! * 60 + m! + 30
              booking.setEndTime(
                `${Math.floor(next / 60).toString().padStart(2, '0')}:${(next % 60).toString().padStart(2, '0')}`
              )
            }
          }} />
          <TimeSelect label="Tot" value={booking.endTime} onChange={booking.setEndTime} />
        </div>

        {/* Project / dienst / urensoort */}
        <FieldSelector
          label="Project"
          value={booking.projectId}
          options={booking.projects.map((p) => ({ id: p.id, label: `${p.organizationName} — ${p.name}` }))}
          onChange={booking.setProjectId}
          highlight={!booking.projectId}
        />
        {booking.projectId && (
          <FieldSelector
            label="Dienst"
            value={booking.serviceId}
            options={booking.services.map((s) => ({ id: s.id, label: s.name }))}
            onChange={booking.setServiceId}
            highlight={!booking.serviceId}
          />
        )}
        {booking.serviceId && (
          <FieldSelector
            label="Urensoort"
            value={booking.hourTypeId}
            options={booking.hourTypes.map((ht) => ({ id: ht.id, label: ht.label }))}
            onChange={booking.setHourTypeId}
          />
        )}

        {/* Notitie */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Toelichting</label>
          <input
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value)}
            placeholder="Optioneel"
            className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          />
        </div>

        {booking.status === 'error' && (
          <div className="text-red-400 text-sm">{booking.errorMessage}</div>
        )}

        <button
          onClick={booking.book}
          disabled={!booking.canBook || booking.status === 'loading'}
          className="bg-[#e8e2d9] text-[#1c1917] py-2 rounded-lg text-sm font-medium hover:bg-[#d5cfc6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {booking.status === 'loading' ? 'Bezig...' : 'Boeken →'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: Voeg `highlight` prop toe aan `FieldSelector`**

Open `src/ui/components/FieldSelector.tsx`. Voeg `highlight?: boolean` toe aan de Props en pas de border-stijl aan:

```tsx
// Zoek de Props interface en voeg highlight toe:
interface Props {
  label: string
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
  highlight?: boolean
}

// Pas de select className aan — voeg conditionele border toe:
// Vervang de bestaande border-klasse door:
className={`bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border focus:outline-none w-full ${
  highlight ? 'border-[#a07848] focus:border-[#c09858]' : 'border-[#2e2a26] focus:border-[#5a5248]'
}`}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Stap 4: Commit**

```bash
git add src/ui/pages/BookingModal.tsx src/ui/components/FieldSelector.tsx
git commit -m "feat: BookingModal shows evidence strip and highlights missing fields"
```

---

## Task 9: Pas `WeekPage` aan — koppel alles samen

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`

- [ ] **Stap 1: Vervang `WeekPage.tsx` volledig**

```tsx
// src/ui/pages/WeekPage.tsx
import { useState, useCallback, useEffect } from 'react'
import { useWeek } from '../hooks/useWeek'
import { useSuggestions } from '../hooks/useSuggestions'
import { useImport } from '../hooks/useImport'
import { useHistoryStore } from '../hooks/useHistoryStore'
import { WeekDayList } from '../components/WeekDayList'
import { DayTimeline } from '../components/DayTimeline'
import { BookingModal } from './BookingModal'
import { mappingCacheRepo, keychainRepo, createSimplicateRepository } from '../../application/container'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
}

function weekLabel(weekStart: string): string {
  const thisMonday = (() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().split('T')[0]!
  })()
  if (weekStart === thisMonday) return 'deze week'
  const wn = getWeekNumber(weekStart)
  return `week ${wn}`
}

export function WeekPage() {
  const week = useWeek()
  const { suggestions } = useSuggestions(week.selectedDate)
  const importState = useImport()
  const historyStore = useHistoryStore(week.selectedDate)

  const [bookingEntry, setBookingEntry] = useState<Partial<HourEntry> | null>(null)
  const [bookingConcept, setBookingConcept] = useState<ClassifiedBlock | null>(null)

  // Concept-count per datum voor de WeekDayList badge (synchronous approximation via in-memory)
  const [conceptCountCache, setConceptCountCache] = useState<Record<string, number>>({})

  function conceptCountForDate(date: string): number {
    return conceptCountCache[date] ?? 0
  }

  // Sync concept-count badge-cache wanneer blokken voor geselecteerde datum wijzigen
  useEffect(() => {
    setConceptCountCache(prev => ({
      ...prev,
      [week.selectedDate]: historyStore.blocksForDate.length,
    }))
  }, [week.selectedDate, historyStore.blocksForDate.length])

  function handleBookSuggestion(suggestion: HourEntrySuggestion) {
    const entry: Partial<HourEntry> = {
      projectId: suggestion.projectId,
      projectServiceId: suggestion.projectServiceId,
      hourTypeId: suggestion.hourTypeId,
      startDate: week.selectedDate,
    }
    if (suggestion.startTime !== undefined) entry.startTime = suggestion.startTime
    if (suggestion.endTime !== undefined) entry.endTime = suggestion.endTime
    setBookingConcept(null)
    setBookingEntry(entry)
  }

  function handleEditEntry(entry: HourEntry) {
    setBookingConcept(null)
    setBookingEntry({ ...entry, startDate: entry.startDate })
  }

  function handleConceptClick(block: ClassifiedBlock) {
    setBookingEntry({
      startDate: block.date,
      startTime: block.startTime,
      endTime: block.endTime,
      projectId: block.projectId,
      projectServiceId: block.serviceId,
      note: block.note ?? block.summary,
    })
    setBookingConcept(block)
  }

  const handleUploadCsv = useCallback(async (csvContent: string) => {
    await mappingCacheRepo.load()
    await importState.analyseFile(csvContent)
  }, [importState])

  // Na classificatie: sla blokken op in historyStore
  useEffect(() => {
    if (importState.status !== 'ready' || importState.blocks.length === 0) return
    const byDate: Record<string, ClassifiedBlock[]> = {}
    for (const block of importState.blocks) {
      if (!byDate[block.date]) byDate[block.date] = []
      byDate[block.date]!.push(block)
    }
    for (const [date, blocks] of Object.entries(byDate)) {
      void historyStore.saveBlocksForDate(date, blocks)
    }
  }, [importState.status, importState.blocks, historyStore])

  async function handleBooked() {
    setBookingEntry(null)
    if (bookingConcept) {
      await historyStore.removeBlock(week.selectedDate, bookingConcept.urlPattern)
      // Persist mapping cache
      if (bookingConcept.projectId && bookingConcept.serviceId) {
        await mappingCacheRepo.set(bookingConcept.urlPattern, {
          projectId: bookingConcept.projectId,
          serviceId: bookingConcept.serviceId,
          note: bookingConcept.note ?? '',
          blockName: bookingConcept.blockName,
          summary: bookingConcept.summary,
        })
      }
      setBookingConcept(null)
    }
    void week.refresh()
  }

  const selectedEntries = week.entriesByDate[week.selectedDate] ?? []
  const isClassifying = importState.status === 'classifying' || importState.status === 'parsing'

  return (
    <div className="h-full flex bg-[#1c1917] text-[#e8e2d9]">
      <WeekDayList
        weekDays={week.weekDays}
        selectedDate={week.selectedDate}
        hoursForDate={week.hoursForDate}
        conceptCountForDate={conceptCountForDate}
        onSelectDate={week.selectDate}
        onPrevWeek={week.prevWeek}
        onNextWeek={week.nextWeek}
        weekLabel={weekLabel(week.selectedWeekStart)}
      />

      {week.isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[#4a4540] text-sm">
          Laden...
        </div>
      ) : week.error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-red-400 text-sm">{week.error}</div>
          <button
            onClick={week.refresh}
            className="text-[#7a7268] hover:text-[#e8e2d9] text-sm underline cursor-pointer"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : (
        <DayTimeline
          date={week.selectedDate}
          entries={selectedEntries}
          suggestions={suggestions}
          conceptBlocks={historyStore.blocksForDate}
          onBookSuggestion={handleBookSuggestion}
          onEditEntry={handleEditEntry}
          onConceptClick={handleConceptClick}
          onUploadCsv={handleUploadCsv}
          isClassifying={isClassifying}
        />
      )}

      {bookingEntry && (
        <BookingModal
          initialEntry={bookingEntry}
          title={bookingConcept?.blockName ?? 'Uren boeken'}
          evidenceBlock={bookingConcept ?? undefined}
          onClose={() => { setBookingEntry(null); setBookingConcept(null) }}
          onBooked={() => void handleBooked()}
        />
      )}
    </div>
  )
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Los eventuele typefouten op.

- [ ] **Stap 3: Commit**

```bash
git add src/ui/pages/WeekPage.tsx
git commit -m "feat: WeekPage integrates history upload, concept blocks and booking flow"
```

---

## Task 10: Verwijder `ImportPage`, `ImportBlockCard` en de import-navigatie

**Files:**
- Modify: `src/ui/components/Sidebar.tsx`
- Modify: `src/App.tsx`
- Delete: `src/ui/pages/ImportPage.tsx`
- Delete: `src/ui/components/ImportBlockCard.tsx`

- [ ] **Stap 1: Pas `Sidebar.tsx` aan**

```tsx
// src/ui/components/Sidebar.tsx — volledige nieuwe versie
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '../../store/appStore'

interface Props {
  onSettings: () => void
}

export function Sidebar({ onSettings }: Props) {
  const user = useAppStore((s) => s.user)
  const initials = user?.name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="w-[52px] flex-shrink-0 bg-[#171512] border-r border-[#2e2a26] flex flex-col items-center py-3 gap-[6px]">
      {/* Logo mark */}
      <div className="w-[30px] h-[30px] bg-[#e8e2d9] rounded-lg mb-[10px]" />

      <div className="flex-1" />

      <button
        title="Instellingen"
        onClick={onSettings}
        className="w-[34px] h-[34px] rounded-lg flex items-center justify-center hover:bg-[#252220] transition-colors cursor-pointer"
      >
        <Cog6ToothIcon className="w-[15px] h-[15px] stroke-[#4a4540]" strokeWidth={1.5} />
      </button>

      {/* Avatar */}
      <div className="w-[26px] h-[26px] bg-[#2e2a26] rounded-full flex items-center justify-center mt-1">
        <span className="text-[#e8e2d9] text-[10px] font-semibold">{initials}</span>
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: Pas `App.tsx` aan**

```tsx
// src/App.tsx — volledige nieuwe versie
import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { useAppInit } from './ui/hooks/useAppInit'
import { useSimplicateData } from './ui/hooks/useSimplicateData'
import { LoginPage } from './ui/pages/LoginPage'
import { WeekPage } from './ui/pages/WeekPage'
import { Sidebar } from './ui/components/Sidebar'
import { SettingsPage } from './ui/pages/Settings/SettingsPage'

function App() {
  useAppInit()
  useSimplicateData()
  const user = useAppStore((s) => s.user)
  const [showSettings, setShowSettings] = useState(false)

  if (!user) return <LoginPage />

  if (showSettings) {
    return (
      <div className="h-screen flex overflow-hidden bg-[#1c1917]">
        <Sidebar onSettings={() => setShowSettings(true)} />
        <div className="flex-1 overflow-hidden">
          <SettingsPage onBack={() => setShowSettings(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#1c1917]">
      <Sidebar onSettings={() => setShowSettings(true)} />
      <div className="flex-1 overflow-hidden">
        <WeekPage />
      </div>
    </div>
  )
}

export default App
```

- [ ] **Stap 3: Verwijder bestanden**

```bash
rm src/ui/pages/ImportPage.tsx
rm src/ui/components/ImportBlockCard.tsx
```

- [ ] **Stap 4: Typecheck + alle tests**

```bash
npm run typecheck && npm run test
```

Verwacht: geen fouten, alle tests groen.

- [ ] **Stap 5: Commit**

```bash
git add src/ui/components/Sidebar.tsx src/App.tsx
git rm src/ui/pages/ImportPage.tsx src/ui/components/ImportBlockCard.tsx
git commit -m "feat: remove ImportPage and import nav, WeekPage is now the single home"
```

---

## Task 11: Eindverificatie

- [ ] **Stap 1: Volledige typecheck**

```bash
npm run typecheck
```

Verwacht: 0 errors.

- [ ] **Stap 2: Alle unit tests**

```bash
npm run test
```

Verwacht: alle tests groen.

- [ ] **Stap 3: Lint**

```bash
npm run lint
```

Los eventuele warnings op.

- [ ] **Stap 4: Draai de app**

```bash
npm run tauri dev
```

Controleer handmatig:
- [ ] Week-view toont bij een dag zonder history de CTA-card
- [ ] CSV upload werkt vanuit de CTA-card (drag-drop én knop)
- [ ] Na classificatie verschijnen concept-blokken op de tijdlijn
- [ ] Concept-blokken hebben de juiste kleur (groen/amber/rood)
- [ ] Klik op concept opent `BookingModal` met evidence-strip en pre-filled velden
- [ ] Ontbrekend project is amber gemarkeerd in de modal
- [ ] Na boeken verdwijnt het concept, geboekte entry verschijnt in indigo
- [ ] "Nieuwe CSV" knop verschijnt als er al blokken/entries zijn
- [ ] WeekDayList toont concept-badge bij dagen met onbevestigde blokken
- [ ] Import-nav-item is verdwenen uit de sidebar
- [ ] Navigeren naar een andere dag en terug behoudt de concepten (HistoryStore)

- [ ] **Stap 5: Commit**

```bash
git add -A
git commit -m "feat: unified flow complete — cleanup and verification"
```
