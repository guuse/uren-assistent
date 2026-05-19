# Browser History Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an import page that parses a Chrome browser history CSV, groups URLs into time blocks per day per project, classifies them via GitHub Copilot API (with local mapping cache), and lets the user review and book entries to Simplicate.

**Architecture:** Clean Architecture — domain entities and use cases first, then infrastructure implementations, then UI. All new code follows the existing patterns in this codebase: interfaces in `src/domain/repositories/`, implementations in `src/infrastructure/`, use cases in `src/domain/usecases/`, UI in `src/ui/`.

**Tech Stack:** TypeScript strict, Vitest, React, Zustand, Tauri (filesystem + fetch), GitHub Copilot API (chat completions endpoint)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/domain/entities/HistoryBlock.ts` | Create | `HistoryBlock` type |
| `src/domain/entities/ClassifiedBlock.ts` | Create | `ClassifiedBlock` type + `ClassificationOrigin` |
| `src/domain/repositories/ICopilotRepository.ts` | Create | Interface for LLM classification |
| `src/domain/repositories/IMappingCacheRepository.ts` | Create | Interface for persistent URL→project mapping |
| `src/domain/usecases/ParseBrowserHistoryUseCase.ts` | Create | CSV parse + URL normalization + block grouping |
| `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts` | Create | Cache-first, LLM fallback classification |
| `src/infrastructure/copilot/CopilotRepository.ts` | Create | GitHub Copilot API implementation |
| `src/infrastructure/storage/MappingCacheRepository.ts` | Create | JSON file persistence via Tauri fs |
| `src/application/container.ts` | Modify | Wire up new repositories and use cases |
| `src/ui/hooks/useImport.ts` | Create | Import page state and orchestration |
| `src/ui/pages/ImportPage.tsx` | Create | Upload + review table + book UI |
| `src/App.tsx` | Modify | Add route/nav entry for ImportPage |
| `tests/unit/domain/HistoryBlock.test.ts` | Create | Type smoke tests |
| `tests/unit/usecases/ParseBrowserHistoryUseCase.test.ts` | Create | Parse + normalize + group tests |
| `tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts` | Create | Cache-hit, LLM-hit, manual fallback tests |
| `tests/unit/infrastructure/MappingCacheRepository.test.ts` | Create | Read/write/corrupt-fallback tests |

---

## Task 1: Domain entities — `HistoryBlock` and `ClassifiedBlock`

**Files:**
- Create: `src/domain/entities/HistoryBlock.ts`
- Create: `src/domain/entities/ClassifiedBlock.ts`
- Create: `tests/unit/domain/HistoryBlock.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/domain/HistoryBlock.test.ts
import { describe, it, expect } from 'vitest'
import type { HistoryBlock } from '../../../src/domain/entities/HistoryBlock'
import type { ClassifiedBlock } from '../../../src/domain/entities/ClassifiedBlock'

describe('HistoryBlock', () => {
  it('has the expected shape', () => {
    const block: HistoryBlock = {
      date: '2026-05-11',
      urlPattern: 'github.com/Harborn-digital/eindhoven-doet',
      titles: ['Eindhoven Doet', 'Pull requests'],
      visitCount: 5,
      firstVisitTime: '08:30',
      hours: 1.5,
    }
    expect(block.date).toBe('2026-05-11')
    expect(block.hours).toBe(1.5)
  })
})

describe('ClassifiedBlock', () => {
  it('extends HistoryBlock with classification fields', () => {
    const block: ClassifiedBlock = {
      date: '2026-05-11',
      urlPattern: 'github.com/Harborn-digital/eindhoven-doet',
      titles: ['Eindhoven Doet'],
      visitCount: 5,
      firstVisitTime: '08:30',
      hours: 1.5,
      startTime: '08:30',
      endTime: '10:00',
      projectId: 'p1',
      serviceId: 's1',
      note: 'Eindhoven Doet development',
      confidence: 0.9,
      origin: 'llm',
    }
    expect(block.origin).toBe('llm')
    expect(block.confidence).toBe(0.9)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/unit/domain/HistoryBlock.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create `HistoryBlock.ts`**

```typescript
// src/domain/entities/HistoryBlock.ts
export interface HistoryBlock {
  date: string           // YYYY-MM-DD
  urlPattern: string     // normalised, e.g. "github.com/Harborn-digital/eindhoven-doet"
  titles: string[]       // unique page titles seen for this pattern on this day
  visitCount: number
  firstVisitTime: string // HH:mm
  hours: number          // rounded to 0.25, minimum 0.25
}
```

- [ ] **Step 4: Create `ClassifiedBlock.ts`**

```typescript
// src/domain/entities/ClassifiedBlock.ts
import type { HistoryBlock } from './HistoryBlock'

export type ClassificationOrigin = 'cache' | 'llm' | 'manual'

export interface ClassifiedBlock extends HistoryBlock {
  startTime: string   // HH:mm — equals firstVisitTime initially
  endTime: string     // HH:mm — startTime + hours
  projectId?: string
  serviceId?: string
  note?: string
  confidence: number  // 0-1; <0.6 = uncertain
  origin: ClassificationOrigin
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -- tests/unit/domain/HistoryBlock.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/HistoryBlock.ts src/domain/entities/ClassifiedBlock.ts tests/unit/domain/HistoryBlock.test.ts
git commit -m "feat: add HistoryBlock and ClassifiedBlock domain entities"
```

---

## Task 2: Repository interfaces

**Files:**
- Create: `src/domain/repositories/ICopilotRepository.ts`
- Create: `src/domain/repositories/IMappingCacheRepository.ts`

- [ ] **Step 1: Create `ICopilotRepository.ts`**

```typescript
// src/domain/repositories/ICopilotRepository.ts
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'

export interface Project {
  id: string
  name: string
}

export interface Service {
  id: string
  name: string
  projectId: string
}

export interface ICopilotRepository {
  classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
  ): Promise<ClassifiedBlock[]>
}
```

- [ ] **Step 2: Create `IMappingCacheRepository.ts`**

```typescript
// src/domain/repositories/IMappingCacheRepository.ts
export interface CachedMapping {
  projectId: string
  serviceId: string
  note: string
}

export interface IMappingCacheRepository {
  get(urlPattern: string): CachedMapping | undefined
  set(urlPattern: string, mapping: CachedMapping): Promise<void>
  getAll(): Record<string, CachedMapping>
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/domain/repositories/ICopilotRepository.ts src/domain/repositories/IMappingCacheRepository.ts
git commit -m "feat: add ICopilotRepository and IMappingCacheRepository interfaces"
```

---

## Task 3: `ParseBrowserHistoryUseCase`

**Files:**
- Create: `src/domain/usecases/ParseBrowserHistoryUseCase.ts`
- Create: `tests/unit/usecases/ParseBrowserHistoryUseCase.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/usecases/ParseBrowserHistoryUseCase.test.ts
import { describe, it, expect } from 'vitest'
import { ParseBrowserHistoryUseCase, ParseError } from '../../../src/domain/usecases/ParseBrowserHistoryUseCase'

const HEADER = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'

function makeRow(order: number, visitTime: string, title: string, url: string, visits = 3): string {
  return `${order},${order + 1000},"${visitTime}","${title}",${visits},"${url}","0"`
}

describe('ParseBrowserHistoryUseCase', () => {
  const useCase = new ParseBrowserHistoryUseCase()

  it('returns empty array for CSV with only header', async () => {
    const result = await useCase.execute(HEADER, 3)
    expect(result).toEqual([])
  })

  it('throws ParseError for wrong headers', async () => {
    await expect(useCase.execute('wrong,headers', 3)).rejects.toThrow(ParseError)
  })

  it('groups visits by day and URL pattern', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'Eindhoven Doet', 'https://github.com/Harborn-digital/eindhoven-doet/pull/1', 5),
      makeRow(2, '2026-05-11 09:30:00', 'Eindhoven Doet PR', 'https://github.com/Harborn-digital/eindhoven-doet/pull/2', 5),
      makeRow(3, '2026-05-11 10:00:00', 'Google', 'https://www.google.com/search?q=test', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    const ghBlock = result.find(b => b.urlPattern === 'github.com/Harborn-digital/eindhoven-doet')
    expect(ghBlock).toBeDefined()
    expect(ghBlock!.date).toBe('2026-05-11')
    expect(ghBlock!.visitCount).toBe(10)
  })

  it('filters blocks with fewer visits than minVisits', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'Something', 'https://example.com/page', 2),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result).toEqual([])
  })

  it('normalises URL: removes protocol, query, fragment, limits to 3 path segments', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'Title', 'https://github.com/org/repo/pull/123?diff=unified#files', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result[0]!.urlPattern).toBe('github.com/org/repo/pull')
  })

  it('calculates hours from first to last visit, rounded to 0.25, minimum 0.25', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'A', 'https://github.com/org/repo/a', 5),
      makeRow(2, '2026-05-11 09:30:00', 'B', 'https://github.com/org/repo/b', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result[0]!.hours).toBe(1.5)
    expect(result[0]!.firstVisitTime).toBe('08:00')
  })

  it('sets minimum 0.25 hours when all visits at same time', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'A', 'https://github.com/org/repo/a', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result[0]!.hours).toBe(0.25)
  })

  it('splits blocks by day', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'A', 'https://github.com/org/repo/a', 5),
      makeRow(2, '2026-05-12 09:00:00', 'A', 'https://github.com/org/repo/a', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result).toHaveLength(2)
    expect(result.map(b => b.date).sort()).toEqual(['2026-05-11', '2026-05-12'])
  })

  it('skips rows with invalid dates', async () => {
    const csv = [
      HEADER,
      `1,1001,"not-a-date","Title",5,"https://github.com/org/repo/a","0"`,
      makeRow(2, '2026-05-11 08:00:00', 'Valid', 'https://github.com/org/repo/b', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result.every(b => b.date === '2026-05-11')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/unit/usecases/ParseBrowserHistoryUseCase.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `ParseBrowserHistoryUseCase.ts`**

```typescript
// src/domain/usecases/ParseBrowserHistoryUseCase.ts
import type { HistoryBlock } from '../entities/HistoryBlock'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const EXPECTED_HEADERS = [
  'Order', 'ID', 'Last Visit Time', 'Title',
]

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean).slice(0, 3)
    return [parsed.hostname, ...segments].join('/')
  } catch {
    return url
  }
}

function roundToQuarter(hours: number): number {
  return Math.max(0.25, Math.round(hours * 4) / 4)
}

function parseDateTime(raw: string): Date | null {
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  url: string
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

    const orderIdx = headerCols.indexOf('Order')
    const timeIdx = headerCols.indexOf('Last Visit Time')
    const titleIdx = headerCols.indexOf('Title')
    const urlIdx = headerCols.findIndex(h => h === 'URL')
    const visitsIdx = headerCols.findIndex((_, i) => i > titleIdx && headerCols[i]?.includes('times') && !headerCols[i]?.includes('address'))

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
        url,
        visitCount: parseInt(cols[visitsIdx] ?? '1', 10) || 1,
      })
    }

    // Group by date + normalised URL pattern
    type Key = string
    const groups = new Map<Key, { rows: RawRow[] }>()

    for (const row of rows) {
      const date = row.visitTime.toISOString().split('T')[0]!
      const pattern = normaliseUrl(row.url)
      const key = `${date}__${pattern}`
      if (!groups.has(key)) groups.set(key, { rows: [] })
      groups.get(key)!.rows.push(row)
    }

    const blocks: HistoryBlock[] = []

    for (const [key, { rows: groupRows }] of groups) {
      const totalVisits = groupRows.reduce((sum, r) => sum + r.visitCount, 0)
      if (totalVisits < minVisits) continue

      const [date, pattern] = key.split('__') as [string, string]
      const sorted = groupRows.slice().sort((a, b) => a.visitTime.getTime() - b.visitTime.getTime())
      const first = sorted[0]!
      const last = sorted[sorted.length - 1]!

      const diffMinutes = (last.visitTime.getTime() - first.visitTime.getTime()) / 60000
      const hours = roundToQuarter(diffMinutes / 60)

      const titles = [...new Set(groupRows.map(r => r.title).filter(Boolean))]

      blocks.push({
        date,
        urlPattern: pattern,
        titles,
        visitCount: totalVisits,
        firstVisitTime: toHHMM(first.visitTime),
        hours,
      })
    }

    return blocks.sort((a, b) => a.date.localeCompare(b.date) || a.firstVisitTime.localeCompare(b.firstVisitTime))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/unit/usecases/ParseBrowserHistoryUseCase.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/usecases/ParseBrowserHistoryUseCase.ts tests/unit/usecases/ParseBrowserHistoryUseCase.test.ts
git commit -m "feat: add ParseBrowserHistoryUseCase"
```

---

## Task 4: `MappingCacheRepository`

**Files:**
- Create: `src/infrastructure/storage/MappingCacheRepository.ts`
- Create: `tests/unit/infrastructure/MappingCacheRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/infrastructure/MappingCacheRepository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MappingCacheRepository } from '../../../src/infrastructure/storage/MappingCacheRepository'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  BaseDirectory: { AppData: 'AppData' },
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app-data'),
}))

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = vi.mocked(readTextFile)
const mockWrite = vi.mocked(writeTextFile)

describe('MappingCacheRepository', () => {
  let repo: MappingCacheRepository

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset singleton state between tests
    repo = new MappingCacheRepository()
  })

  it('returns undefined for unknown pattern when file does not exist', async () => {
    mockRead.mockRejectedValueOnce(new Error('file not found'))
    await repo.load()
    expect(repo.get('github.com/org/repo')).toBeUndefined()
  })

  it('returns cached mapping for known pattern', async () => {
    const cache = {
      'github.com/org/repo': { projectId: 'p1', serviceId: 's1', note: 'Dev work' },
    }
    mockRead.mockResolvedValueOnce(JSON.stringify(cache))
    await repo.load()
    expect(repo.get('github.com/org/repo')).toEqual({ projectId: 'p1', serviceId: 's1', note: 'Dev work' })
  })

  it('returns empty cache for corrupt JSON file', async () => {
    mockRead.mockResolvedValueOnce('not valid json {{{{')
    await repo.load()
    expect(repo.getAll()).toEqual({})
  })

  it('persists new mapping to file', async () => {
    mockRead.mockRejectedValueOnce(new Error('file not found'))
    mockWrite.mockResolvedValueOnce(undefined)
    await repo.load()
    await repo.set('github.com/org/repo', { projectId: 'p1', serviceId: 's1', note: 'Dev' })
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('mapping-cache.json'),
      expect.stringContaining('github.com/org/repo'),
      expect.anything(),
    )
  })

  it('getAll returns all cached entries', async () => {
    const cache = {
      'github.com/org/a': { projectId: 'p1', serviceId: 's1', note: 'A' },
      'github.com/org/b': { projectId: 'p2', serviceId: 's2', note: 'B' },
    }
    mockRead.mockResolvedValueOnce(JSON.stringify(cache))
    await repo.load()
    expect(Object.keys(repo.getAll())).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/unit/infrastructure/MappingCacheRepository.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `MappingCacheRepository.ts`**

```typescript
// src/infrastructure/storage/MappingCacheRepository.ts
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { IMappingCacheRepository, CachedMapping } from '../../domain/repositories/IMappingCacheRepository'

const FILENAME = 'mapping-cache.json'

export class MappingCacheRepository implements IMappingCacheRepository {
  private cache: Record<string, CachedMapping> = {}

  private async filePath(): Promise<string> {
    const dir = await appDataDir()
    return `${dir}/${FILENAME}`
  }

  async load(): Promise<void> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      this.cache = JSON.parse(raw) as Record<string, CachedMapping>
    } catch {
      this.cache = {}
    }
  }

  get(urlPattern: string): CachedMapping | undefined {
    return this.cache[urlPattern]
  }

  getAll(): Record<string, CachedMapping> {
    return { ...this.cache }
  }

  async set(urlPattern: string, mapping: CachedMapping): Promise<void> {
    this.cache[urlPattern] = mapping
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(this.cache, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/unit/infrastructure/MappingCacheRepository.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/storage/MappingCacheRepository.ts tests/unit/infrastructure/MappingCacheRepository.test.ts
git commit -m "feat: add MappingCacheRepository"
```

---

## Task 5: `ClassifyHistoryBlocksUseCase`

**Files:**
- Create: `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts`
- Create: `tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClassifyHistoryBlocksUseCase } from '../../../src/domain/usecases/ClassifyHistoryBlocksUseCase'
import type { HistoryBlock } from '../../../src/domain/entities/HistoryBlock'
import type { ICopilotRepository } from '../../../src/domain/repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../../../src/domain/repositories/IMappingCacheRepository'

const block: HistoryBlock = {
  date: '2026-05-11',
  urlPattern: 'github.com/Harborn-digital/eindhoven-doet',
  titles: ['Eindhoven Doet'],
  visitCount: 8,
  firstVisitTime: '08:30',
  hours: 1.5,
}

function makeBlock(urlPattern: string): HistoryBlock {
  return { ...block, urlPattern }
}

const projects = [{ id: 'p1', name: 'Eindhoven Doet' }]
const services = [{ id: 's1', name: 'Development', projectId: 'p1' }]

describe('ClassifyHistoryBlocksUseCase', () => {
  let mockCopilot: ICopilotRepository
  let mockCache: IMappingCacheRepository
  let useCase: ClassifyHistoryBlocksUseCase

  beforeEach(() => {
    mockCopilot = { classify: vi.fn() }
    mockCache = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({}),
    }
    useCase = new ClassifyHistoryBlocksUseCase(mockCopilot, mockCache)
  })

  it('uses cache for known URL patterns', async () => {
    vi.mocked(mockCache.get).mockReturnValue({ projectId: 'p1', serviceId: 's1', note: 'Dev' })

    const result = await useCase.execute([block], projects, services)

    expect(mockCopilot.classify).not.toHaveBeenCalled()
    expect(result[0]!.origin).toBe('cache')
    expect(result[0]!.confidence).toBe(1.0)
    expect(result[0]!.projectId).toBe('p1')
  })

  it('calls LLM for unknown URL patterns', async () => {
    vi.mocked(mockCache.get).mockReturnValue(undefined)
    vi.mocked(mockCopilot.classify).mockResolvedValue([{
      ...block,
      startTime: '08:30',
      endTime: '10:00',
      projectId: 'p1',
      serviceId: 's1',
      note: 'Eindhoven Doet work',
      confidence: 0.85,
      origin: 'llm',
    }])

    const result = await useCase.execute([block], projects, services)

    expect(mockCopilot.classify).toHaveBeenCalledWith([block], projects, services)
    expect(result[0]!.origin).toBe('llm')
    expect(result[0]!.confidence).toBe(0.85)
  })

  it('marks blocks as manual when LLM fails', async () => {
    vi.mocked(mockCache.get).mockReturnValue(undefined)
    vi.mocked(mockCopilot.classify).mockRejectedValue(new Error('API unreachable'))

    const result = await useCase.execute([block], projects, services)

    expect(result[0]!.origin).toBe('manual')
    expect(result[0]!.confidence).toBe(0)
    expect(result[0]!.projectId).toBeUndefined()
  })

  it('mixes cache hits and LLM calls in one batch', async () => {
    const cachedBlock = makeBlock('github.com/Harborn-digital/eindhoven-doet')
    const unknownBlock = makeBlock('hosting.harborn.com/dashboard')

    vi.mocked(mockCache.get).mockImplementation((pattern) =>
      pattern === 'github.com/Harborn-digital/eindhoven-doet'
        ? { projectId: 'p1', serviceId: 's1', note: 'Dev' }
        : undefined
    )
    vi.mocked(mockCopilot.classify).mockResolvedValue([{
      ...unknownBlock,
      startTime: '09:00',
      endTime: '10:00',
      projectId: 'p1',
      serviceId: 's1',
      note: 'Hosting',
      confidence: 0.7,
      origin: 'llm',
    }])

    const result = await useCase.execute([cachedBlock, unknownBlock], projects, services)

    expect(result).toHaveLength(2)
    expect(result.find(r => r.urlPattern === 'github.com/Harborn-digital/eindhoven-doet')!.origin).toBe('cache')
    expect(result.find(r => r.urlPattern === 'hosting.harborn.com/dashboard')!.origin).toBe('llm')
    expect(mockCopilot.classify).toHaveBeenCalledWith([unknownBlock], projects, services)
  })

  it('sets startTime and endTime from firstVisitTime and hours', async () => {
    vi.mocked(mockCache.get).mockReturnValue({ projectId: 'p1', serviceId: 's1', note: 'Dev' })

    const result = await useCase.execute([block], projects, services)

    expect(result[0]!.startTime).toBe('08:30')
    expect(result[0]!.endTime).toBe('10:00') // 08:30 + 1.5h
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `ClassifyHistoryBlocksUseCase.ts`**

```typescript
// src/domain/usecases/ClassifyHistoryBlocksUseCase.ts
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const totalMinutes = h * 60 + m + Math.round(hours * 60)
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

export class ClassifyHistoryBlocksUseCase {
  constructor(
    private readonly copilotRepo: ICopilotRepository,
    private readonly cacheRepo: IMappingCacheRepository,
  ) {}

  async execute(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
  ): Promise<ClassifiedBlock[]> {
    const cacheHits: ClassifiedBlock[] = []
    const unknownBlocks: HistoryBlock[] = []

    for (const block of blocks) {
      const cached = this.cacheRepo.get(block.urlPattern)
      if (cached) {
        cacheHits.push({
          ...block,
          startTime: block.firstVisitTime,
          endTime: addHoursToTime(block.firstVisitTime, block.hours),
          projectId: cached.projectId,
          serviceId: cached.serviceId,
          note: cached.note,
          confidence: 1.0,
          origin: 'cache',
        })
      } else {
        unknownBlocks.push(block)
      }
    }

    let llmResults: ClassifiedBlock[] = []
    if (unknownBlocks.length > 0) {
      try {
        llmResults = await this.copilotRepo.classify(unknownBlocks, availableProjects, availableServices)
        // Ensure startTime/endTime are set (LLM may not set them)
        llmResults = llmResults.map(r => ({
          ...r,
          startTime: r.startTime ?? r.firstVisitTime,
          endTime: r.endTime ?? addHoursToTime(r.firstVisitTime, r.hours),
        }))
      } catch {
        llmResults = unknownBlocks.map(block => ({
          ...block,
          startTime: block.firstVisitTime,
          endTime: addHoursToTime(block.firstVisitTime, block.hours),
          confidence: 0,
          origin: 'manual' as const,
        }))
      }
    }

    // Preserve original order
    const resultMap = new Map<string, ClassifiedBlock>()
    for (const r of [...cacheHits, ...llmResults]) {
      resultMap.set(`${r.date}__${r.urlPattern}`, r)
    }

    return blocks
      .map(b => resultMap.get(`${b.date}__${b.urlPattern}`))
      .filter((r): r is ClassifiedBlock => r !== undefined)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/usecases/ClassifyHistoryBlocksUseCase.ts tests/unit/usecases/ClassifyHistoryBlocksUseCase.test.ts
git commit -m "feat: add ClassifyHistoryBlocksUseCase"
```

---

## Task 6: `CopilotRepository`

**Files:**
- Create: `src/infrastructure/copilot/CopilotRepository.ts`

Note: No unit test for this — it calls an external API via Tauri fetch. It will be covered by manual testing.

- [ ] **Step 1: Implement `CopilotRepository.ts`**

```typescript
// src/infrastructure/copilot/CopilotRepository.ts
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
  projectId: string
  serviceId: string
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
    const projectList = availableProjects.map(p => `- id: "${p.id}", name: "${p.name}"`).join('\n')
    const serviceList = availableServices.map(s => `- id: "${s.id}", name: "${s.name}", projectId: "${s.projectId}"`).join('\n')
    const blockList = blocks.map(b =>
      `- urlPattern: "${b.urlPattern}", titles: [${b.titles.slice(0, 3).map(t => `"${t}"`).join(', ')}], visitCount: ${b.visitCount}`
    ).join('\n')

    const prompt = `You are a time-tracking assistant. Match browser activity blocks to work projects.

Available projects:
${projectList}

Available services (linked to projects by projectId):
${serviceList}

Browser activity blocks to classify:
${blockList}

For each block, return a JSON array where each item has:
- urlPattern (string, exact match from input)
- projectId (string, must be one of the available project IDs, or null if no match)
- serviceId (string, must be one of the available service IDs for that project, or null)
- note (string, short description of the work, max 80 chars)
- confidence (number 0-1, how confident you are in the match)

Return ONLY valid JSON array, no explanation. Example:
[{"urlPattern":"github.com/org/repo","projectId":"p1","serviceId":"s1","note":"Development work","confidence":0.9}]`

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
    const content = data.choices[0]?.message.content ?? '[]'

    let results: LLMBlockResult[]
    try {
      results = JSON.parse(content) as LLMBlockResult[]
    } catch {
      throw new Error('Copilot returned invalid JSON')
    }

    return blocks.map(block => {
      const match = results.find(r => r.urlPattern === block.urlPattern)
      const addHours = (time: string, hours: number): string => {
        const [h, m] = time.split(':').map(Number) as [number, number]
        const total = h * 60 + m + Math.round(hours * 60)
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
      }
      return {
        ...block,
        startTime: block.firstVisitTime,
        endTime: addHours(block.firstVisitTime, block.hours),
        projectId: match?.projectId ?? undefined,
        serviceId: match?.serviceId ?? undefined,
        note: match?.note ?? undefined,
        confidence: match?.confidence ?? 0,
        origin: 'llm' as const,
      }
    })
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/copilot/CopilotRepository.ts
git commit -m "feat: add CopilotRepository"
```

---

## Task 7: Wire up container

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Step 1: Read current container**

Read `src/application/container.ts` in full before editing.

- [ ] **Step 2: Add new repositories and use cases**

Add these exports to `src/application/container.ts`:

```typescript
// At the top, add imports:
import { MappingCacheRepository } from '../infrastructure/storage/MappingCacheRepository'
import { CopilotRepository } from '../infrastructure/copilot/CopilotRepository'
import { ParseBrowserHistoryUseCase } from '../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../domain/usecases/ClassifyHistoryBlocksUseCase'
import type { ICopilotRepository } from '../domain/repositories/ICopilotRepository'

// After existing repo exports, add:
export const mappingCacheRepo = new MappingCacheRepository()

export function createCopilotRepository(token: string): ICopilotRepository {
  return new CopilotRepository(token)
}
```

Then in `createUseCases`, add the new use cases:

```typescript
export function createUseCases(simplicateRepo: ISimplicateRepository) {
  return {
    saveTemplate: new SaveTemplateUseCase(templateRepo),
    deleteTemplate: new DeleteTemplateUseCase(templateRepo),
    bookTemplate: new BookTemplateUseCase(simplicateRepo),
    fetchSimplicateData: new FetchSimplicateDataUseCase(simplicateRepo),
    parseBrowserHistory: new ParseBrowserHistoryUseCase(),
    classifyHistoryBlocks: (copilotRepo: ICopilotRepository) =>
      new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo),
  }
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/application/container.ts
git commit -m "feat: wire browser history import use cases into container"
```

---

## Task 8: `useImport` hook

**Files:**
- Create: `src/ui/hooks/useImport.ts`

- [ ] **Step 1: Implement the hook**

```typescript
// src/ui/hooks/useImport.ts
import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { mappingCacheRepo, createCopilotRepository } from '../../application/container'
import { ParseBrowserHistoryUseCase, ParseError } from '../../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../../domain/usecases/ClassifyHistoryBlocksUseCase'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { CachedMapping } from '../../domain/repositories/IMappingCacheRepository'

export type ImportStatus = 'idle' | 'parsing' | 'classifying' | 'ready' | 'booking' | 'done'

export interface ImportState {
  status: ImportStatus
  error: string | null
  blocks: ClassifiedBlock[]
  minVisits: number
  setMinVisits: (n: number) => void
  analyseFile: (csvContent: string) => Promise<void>
  updateBlock: (index: number, updates: Partial<ClassifiedBlock>) => void
  removeBlock: (index: number) => void
  confirmBlock: (index: number, mapping: CachedMapping) => Promise<void>
  bookAll: () => Promise<void>
  bookingResults: Record<number, 'success' | 'error' | string>
}

export function useImport(): ImportState {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<ClassifiedBlock[]>([])
  const [minVisits, setMinVisits] = useState(3)
  const [bookingResults, setBookingResults] = useState<Record<number, 'success' | 'error' | string>>({})

  const store = useAppStore()

  const analyseFile = useCallback(async (csvContent: string) => {
    setError(null)
    setStatus('parsing')
    try {
      await mappingCacheRepo.load()

      const parseUseCase = new ParseBrowserHistoryUseCase()
      const historyBlocks = await parseUseCase.execute(csvContent, minVisits)

      if (historyBlocks.length === 0) {
        setBlocks([])
        setStatus('ready')
        return
      }

      setStatus('classifying')

      const projects = store.projects ?? []
      const services = store.services ?? []

      if (projects.length === 0) {
        setError('Laad eerst je projecten via de instellingen.')
        setStatus('idle')
        return
      }

      // Get Copilot token from store (set during auth)
      const copilotToken = store.copilotToken ?? ''
      const copilotRepo = createCopilotRepository(copilotToken)
      const classifyUseCase = new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo)

      const classified = await classifyUseCase.execute(historyBlocks, projects, services)
      setBlocks(classified)
      setStatus('ready')
    } catch (e) {
      if (e instanceof ParseError) {
        setError(e.message)
      } else {
        setError('Er is een onverwachte fout opgetreden.')
      }
      setStatus('idle')
    }
  }, [minVisits, store])

  const updateBlock = useCallback((index: number, updates: Partial<ClassifiedBlock>) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...updates } : b))
  }, [])

  const removeBlock = useCallback((index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index))
  }, [])

  const confirmBlock = useCallback(async (index: number, mapping: CachedMapping) => {
    await mappingCacheRepo.set(blocks[index]!.urlPattern, mapping)
    updateBlock(index, {
      projectId: mapping.projectId,
      serviceId: mapping.serviceId,
      note: mapping.note,
      origin: 'manual',
      confidence: 1.0,
    })
  }, [blocks, updateBlock])

  const bookAll = useCallback(async () => {
    if (!store.useCases || !store.user) return
    setStatus('booking')
    const results: Record<number, 'success' | 'error' | string> = {}

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!
      if (!block.projectId || !block.serviceId) {
        results[i] = 'Ontbrekende project of dienst'
        continue
      }
      try {
        await store.useCases.bookTemplate.execute({
          template: {
            id: `import-${i}`,
            name: block.urlPattern,
            type: 'single',
            color: '#6c63ff',
            projectId: block.projectId,
            serviceId: block.serviceId,
            startTime: block.startTime,
            endTime: block.endTime,
          },
          employeeId: store.user.id,
          note: block.note ?? '',
          weekStartDate: block.date,
        })
        results[i] = 'success'
        // Save confirmed mapping to cache
        await mappingCacheRepo.set(block.urlPattern, {
          projectId: block.projectId,
          serviceId: block.serviceId,
          note: block.note ?? '',
        })
      } catch (e) {
        results[i] = e instanceof Error ? e.message : 'error'
      }
    }

    setBookingResults(results)
    setStatus('done')
  }, [blocks, store])

  return {
    status,
    error,
    blocks,
    minVisits,
    setMinVisits,
    analyseFile,
    updateBlock,
    removeBlock,
    confirmBlock,
    bookAll,
    bookingResults,
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. If there are errors about `store.projects`, `store.services`, `store.copilotToken`, `store.useCases`, or `store.user` — these fields need to exist on the Zustand store (check `src/store/appStore.ts` and add missing fields as needed).

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useImport.ts
git commit -m "feat: add useImport hook"
```

---

## Task 9: `ImportPage` UI

**Files:**
- Create: `src/ui/pages/ImportPage.tsx`

- [ ] **Step 1: Implement `ImportPage.tsx`**

```tsx
// src/ui/pages/ImportPage.tsx
import { useRef } from 'react'
import { useImport } from '../hooks/useImport'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { useAppStore } from '../../store/appStore'

function rowStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return 'border-l-4 border-red-500'
  if (block.origin === 'cache') return 'border-l-4 border-green-500'
  if (block.confidence < 0.6) return 'border-l-4 border-orange-400'
  return 'border-l-4 border-green-400'
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const store = useAppStore()
  const {
    status, error, blocks, minVisits, setMinVisits,
    analyseFile, updateBlock, removeBlock, bookAll, bookingResults,
  } = useImport()

  const projects = store.projects ?? []
  const services = store.services ?? []

  async function handleFile(file: File) {
    const text = await file.text()
    await analyseFile(text)
  }

  const hasUnclassified = blocks.some(b => !b.projectId || !b.serviceId)
  const isLoading = status === 'parsing' || status === 'classifying' || status === 'booking'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Importeer uit browsergeschiedenis</h1>

      {/* Upload section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-gray-500">Sleep een Chrome history CSV hiernaartoe, of klik om te selecteren</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-gray-600">Minimum aantal bezoeken:</label>
          <input
            type="number"
            min={1}
            value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="mt-4 text-sm text-blue-600">
            {status === 'parsing' && 'Bezig met analyseren...'}
            {status === 'classifying' && 'Bezig met classificeren via Copilot...'}
            {status === 'booking' && 'Bezig met boeken...'}
          </div>
        )}
      </div>

      {/* Review table */}
      {blocks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Datum</th>
                  <th className="text-left p-3 font-medium text-gray-600">Tijdblok</th>
                  <th className="text-left p-3 font-medium text-gray-600">Uren</th>
                  <th className="text-left p-3 font-medium text-gray-600">URL-patroon</th>
                  <th className="text-left p-3 font-medium text-gray-600">Project</th>
                  <th className="text-left p-3 font-medium text-gray-600">Dienst</th>
                  <th className="text-left p-3 font-medium text-gray-600">Notitie</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block, i) => {
                  const projectServices = services.filter(s => s.projectId === block.projectId)
                  const bookResult = bookingResults[i]
                  return (
                    <tr key={i} className={`border-b border-gray-100 ${rowStatusColor(block)}`}>
                      <td className="p-3 font-mono text-xs text-gray-600">{block.date}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={block.startTime}
                            onChange={e => updateBlock(i, { startTime: e.target.value })}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                          />
                          <span className="text-gray-400">–</span>
                          <input
                            type="time"
                            value={block.endTime}
                            onChange={e => updateBlock(i, { endTime: e.target.value })}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-gray-600">{block.hours}u</td>
                      <td className="p-3 font-mono text-xs text-gray-500 max-w-[200px] truncate" title={block.urlPattern}>
                        {block.urlPattern}
                      </td>
                      <td className="p-3">
                        <select
                          value={block.projectId ?? ''}
                          onChange={e => updateBlock(i, { projectId: e.target.value, serviceId: undefined })}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-full"
                        >
                          <option value="">Selecteer project</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          value={block.serviceId ?? ''}
                          onChange={e => updateBlock(i, { serviceId: e.target.value })}
                          disabled={!block.projectId}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-full disabled:opacity-50"
                        >
                          <option value="">Selecteer dienst</option>
                          {projectServices.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={block.note ?? ''}
                          onChange={e => updateBlock(i, { note: e.target.value })}
                          placeholder="Notitie..."
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-full"
                        />
                      </td>
                      <td className="p-3">
                        {bookResult === 'success' ? (
                          <span className="text-green-600 text-xs">✓</span>
                        ) : bookResult ? (
                          <span className="text-red-600 text-xs" title={bookResult}>✗</span>
                        ) : (
                          <button
                            onClick={() => removeBlock(i)}
                            className="text-gray-400 hover:text-red-500 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {blocks.length} blokken — {blocks.filter(b => b.projectId && b.serviceId).length} klaar om te boeken
            </p>
            <button
              onClick={bookAll}
              disabled={hasUnclassified || isLoading || status === 'done'}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Boek alle
            </button>
          </div>
        </div>
      )}

      {blocks.length === 0 && status === 'ready' && (
        <p className="text-gray-500 text-sm">Geen bruikbare data gevonden. Probeer een lagere minimum bezoeken drempel.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors (fix any type mismatches that arise from store shape differences)

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/ImportPage.tsx
git commit -m "feat: add ImportPage UI"
```

---

## Task 10: Wire navigation

**Files:**
- Modify: `src/App.tsx` (or wherever routing/navigation lives — check the file first)

- [ ] **Step 1: Check current routing**

Read `src/App.tsx` to understand the current navigation pattern before making changes.

- [ ] **Step 2: Add ImportPage to navigation**

Add a route or nav entry for the ImportPage. Follow the exact same pattern used for other pages in the file. Import the page:

```typescript
import ImportPage from './ui/pages/ImportPage'
```

Add a nav item labelled "Importeer" pointing to the import route/view.

- [ ] **Step 3: Run typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: no errors

- [ ] **Step 4: Run all unit tests**

```bash
npm run test
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Import nav entry and route"
```

---

## Task 11: Manual smoke test

- [ ] **Step 1: Start the app**

```bash
npm run tauri dev
```

- [ ] **Step 2: Verify the following manually**
  1. Navigate to "Importeer" in the nav
  2. Upload `history.csv` from the project root
  3. Verify the review table appears with grouped blocks
  4. Verify green/orange/red row indicators are correct
  5. Change a project/dienst dropdown — verify dienst dropdown filters on the selected project
  6. Click "Boek alle" on a couple of confirmed rows — verify success indicators appear
  7. Upload the same CSV again — verify previously confirmed rows now show green (cache hit)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: browser history import feature complete"
```
