# Gestarrde Projecten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gebruikers kunnen projecten sterren zodat die bovenaan de BookingModal dropdown staan, persistent opgeslagen in `starred-projects.json`.

**Architecture:** Nieuwe `StarredProjectsStore` (Tauri FS, zelfde patroon als `HistoryStore`) met een `useStarredProjects` hook. `SearchableSelect` krijgt optionele `renderSuffix` prop voor de ster-knop. `useBooking` sorteert projecten op starred-status. Settings krijgt een nieuw tabblad voor projectbeheer.

**Tech Stack:** React 18, TypeScript strict (exactOptionalPropertyTypes), Zustand, Tauri v2 plugin-fs, Vitest

---

### Task 1: Domain interface `IStarredProjectsRepository`

**Files:**
- Create: `src/domain/repositories/IStarredProjectsRepository.ts`
- Test: `src/infrastructure/storage/StarredProjectsStore.test.ts`

- [ ] **Stap 1: Schrijf het domein interface**

Maak `src/domain/repositories/IStarredProjectsRepository.ts`:

```ts
export interface IStarredProjectsRepository {
  load(): Promise<void>
  getStarredIds(): ReadonlySet<string>
  toggle(projectId: string): Promise<void>
}
```

- [ ] **Stap 2: Schrijf de falende test**

Maak `src/infrastructure/storage/StarredProjectsStore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Tauri APIs before importing the store
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
}))

import { StarredProjectsStore } from './StarredProjectsStore'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = readTextFile as ReturnType<typeof vi.fn>
const mockWrite = writeTextFile as ReturnType<typeof vi.fn>

describe('StarredProjectsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWrite.mockResolvedValue(undefined)
  })

  it('laadt lege set als bestand niet bestaat', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const store = new StarredProjectsStore()
    await store.load()
    expect(store.getStarredIds().size).toBe(0)
  })

  it('laadt gestarrde IDs uit bestand', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ starredIds: ['p1', 'p2'] }))
    const store = new StarredProjectsStore()
    await store.load()
    expect(store.getStarredIds().has('p1')).toBe(true)
    expect(store.getStarredIds().has('p2')).toBe(true)
  })

  it('toggle voegt toe als nog niet gestarred', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const store = new StarredProjectsStore()
    await store.load()
    await store.toggle('p1')
    expect(store.getStarredIds().has('p1')).toBe(true)
    expect(mockWrite).toHaveBeenCalledOnce()
  })

  it('toggle verwijdert als al gestarred', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ starredIds: ['p1'] }))
    const store = new StarredProjectsStore()
    await store.load()
    await store.toggle('p1')
    expect(store.getStarredIds().has('p1')).toBe(false)
    expect(mockWrite).toHaveBeenCalledOnce()
  })

  it('schrijft correct JSON-formaat na toggle', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const store = new StarredProjectsStore()
    await store.load()
    await store.toggle('p42')
    const written = JSON.parse((mockWrite as ReturnType<typeof vi.fn>).mock.calls[0][1] as string) as unknown
    expect(written).toEqual({ starredIds: ['p42'] })
  })
})
```

- [ ] **Stap 3: Run test — verwacht FAIL**

```bash
npm run test -- StarredProjectsStore
```

Verwacht: fout "Cannot find module './StarredProjectsStore'"

- [ ] **Stap 4: Implementeer `StarredProjectsStore`**

Maak `src/infrastructure/storage/StarredProjectsStore.ts`:

```ts
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { IStarredProjectsRepository } from '../../domain/repositories/IStarredProjectsRepository'

const FILENAME = 'starred-projects.json'

interface PersistedData {
  starredIds: string[]
}

export class StarredProjectsStore implements IStarredProjectsRepository {
  private ids: Set<string> = new Set()

  private async filePath(): Promise<string> {
    const dir = await appDataDir()
    return `${dir}/${FILENAME}`
  }

  async load(): Promise<void> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      const parsed = JSON.parse(raw) as PersistedData
      this.ids = new Set(parsed.starredIds)
    } catch {
      this.ids = new Set()
    }
  }

  getStarredIds(): ReadonlySet<string> {
    return this.ids
  }

  async toggle(projectId: string): Promise<void> {
    if (this.ids.has(projectId)) {
      this.ids.delete(projectId)
    } else {
      this.ids.add(projectId)
    }
    await this.persist()
  }

  private async persist(): Promise<void> {
    const path = await this.filePath()
    const data: PersistedData = { starredIds: Array.from(this.ids) }
    await writeTextFile(path, JSON.stringify(data))
  }
}
```

- [ ] **Stap 5: Run test — verwacht PASS**

```bash
npm run test -- StarredProjectsStore
```

Verwacht: 5/5 tests groen.

- [ ] **Stap 6: Commit**

```bash
git add src/domain/repositories/IStarredProjectsRepository.ts src/infrastructure/storage/StarredProjectsStore.ts src/infrastructure/storage/StarredProjectsStore.test.ts
git commit -m "feat: IStarredProjectsRepository + StarredProjectsStore"
```

---

### Task 2: Singleton in `container.ts` + `useStarredProjects` hook

**Files:**
- Modify: `src/application/container.ts`
- Create: `src/ui/hooks/useStarredProjects.ts`
- Test: (geen aparte test — gedrag gedekt door integratietest in Task 5)

- [ ] **Stap 1: Voeg singleton toe aan `container.ts`**

Voeg bovenaan toe na de andere imports en na `export const historyStore = new HistoryStore()`:

```ts
import { StarredProjectsStore } from '../infrastructure/storage/StarredProjectsStore'

// bestaande exports blijven staan, voeg toe:
export const starredProjectsStore = new StarredProjectsStore()
```

- [ ] **Stap 2: Maak `useStarredProjects` hook**

Maak `src/ui/hooks/useStarredProjects.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import { starredProjectsStore } from '../../application/container'

export function useStarredProjects() {
  const [starredIds, setStarredIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    void starredProjectsStore.load().then(() => {
      setStarredIds(new Set(starredProjectsStore.getStarredIds()))
    })
  }, [])

  const toggle = useCallback(async (projectId: string) => {
    await starredProjectsStore.toggle(projectId)
    setStarredIds(new Set(starredProjectsStore.getStarredIds()))
  }, [])

  return { starredIds, toggle }
}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 4: Commit**

```bash
git add src/application/container.ts src/ui/hooks/useStarredProjects.ts
git commit -m "feat: starredProjectsStore singleton + useStarredProjects hook"
```

---

### Task 3: `SearchableSelect` uitbreiden met `renderSuffix`

**Files:**
- Modify: `src/ui/components/SearchableSelect.tsx`
- Modify: `src/ui/components/FieldSelector.tsx`

De huidige `SearchableSelect` rendert elk item als een simpele button met alleen `opt.label`. We voegen een optionele `renderSuffix` prop toe waarmee de aanroeper een extra element rechts van het label kan renderen (voor de ster-knop).

- [ ] **Stap 1: Pas `SearchableSelect` aan**

Vervang de `interface Props` en component volledig met:

```ts
import { useState, useRef, useEffect } from 'react'

interface Option {
  id: string
  label: string
}

interface Props {
  label: string
  options: Option[]
  value: string | undefined
  onChange: (id: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  highlight?: boolean
  renderSuffix?: (option: Option) => React.ReactNode
  groupSeparatorAfter?: string   // id van het laatste item in de eerste groep; toont een visuele scheiding erna
}

export function SearchableSelect({ label, options, value, onChange, required, disabled, placeholder = 'Kies...', highlight, renderSuffix, groupSeparatorAfter }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)
  const filtered = query.length > 0
    ? (() => {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
        return options.filter((o) => {
          const lbl = o.label.toLowerCase()
          return terms.every((term) => lbl.includes(term))
        })
      })()
    : options

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-xs uppercase tracking-widest text-[#7a7268]">
        {label}
        {required && !value && <span className="text-[#a07848] ml-1">⚠</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={`w-full bg-[#1e1b18] text-left text-sm rounded-lg px-3 py-2 border focus:outline-none disabled:opacity-50 flex items-center justify-between gap-2 ${highlight ? 'border-[#a07848] focus:border-[#a07848]' : 'border-[#2e2a26] focus:border-[#5a5248]'}`}
        >
          <span className={selected ? 'text-[#e8e2d9]' : 'text-[#4a4540]'}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && (
              <span
                onClick={handleClear}
                className="text-[#4a4540] hover:text-[#e8e2d9] text-xs px-1 cursor-pointer"
                role="button"
              >
                ✕
              </span>
            )}
            <span className="text-[#4a4540] text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </button>

        {open && (
          <div className="absolute z-50 top-full mt-1 w-full bg-[#1e1b18] border border-[#2e2a26] rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[#2e2a26]">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoeken..."
                className="w-full bg-[#252220] text-[#e8e2d9] text-sm rounded px-2 py-1.5 border border-[#3e3a36] focus:border-[#5a5248] focus:outline-none placeholder-[#4a4540]"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#4a4540]">Geen resultaten</div>
              ) : (
                filtered.map((opt, idx) => (
                  <div key={opt.id}>
                    {groupSeparatorAfter && opt.id === groupSeparatorAfter && idx < filtered.length - 1 && (
                      <div className="border-t border-[#2e2a26] mx-2 my-1" />
                    )}
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSelect(opt.id)}
                        className={`flex-1 text-left px-3 py-2 text-sm hover:bg-[#252220] transition-colors ${
                          opt.id === value ? 'text-[#e8e2d9] font-medium' : 'text-[#7a7268]'
                        }`}
                      >
                        {opt.label}
                      </button>
                      {renderSuffix && (
                        <div className="pr-2 flex-shrink-0">
                          {renderSuffix(opt)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: Pas `FieldSelector` aan** zodat `renderSuffix` en `groupSeparatorAfter` worden doorgegeven:

```ts
import { SearchableSelect } from './SearchableSelect'

interface Option {
  id: string
  label: string
}

interface Props {
  label: string
  options: Option[]
  value: string | undefined
  onChange: (id: string) => void
  required?: boolean
  disabled?: boolean
  highlight?: boolean
  renderSuffix?: (option: Option) => React.ReactNode
  groupSeparatorAfter?: string
}

export function FieldSelector({ label, options, value, onChange, required, disabled, highlight, renderSuffix, groupSeparatorAfter }: Props) {
  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      {...(required !== undefined && { required })}
      {...(disabled !== undefined && { disabled })}
      {...(highlight !== undefined && { highlight })}
      {...(renderSuffix !== undefined && { renderSuffix })}
      {...(groupSeparatorAfter !== undefined && { groupSeparatorAfter })}
    />
  )
}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 4: Run alle tests**

```bash
npm run test
```

Verwacht: alle bestaande tests groen.

- [ ] **Stap 5: Commit**

```bash
git add src/ui/components/SearchableSelect.tsx src/ui/components/FieldSelector.tsx
git commit -m "feat: SearchableSelect renderSuffix + groupSeparatorAfter props"
```

---

### Task 4: `useBooking` — gesorteerde projecten + star toggle

**Files:**
- Modify: `src/ui/hooks/useBooking.ts`

- [ ] **Stap 1: Voeg `useStarredProjects` toe en sorteer projecten**

Vervang de bestaande imports en het begin van `useBooking`:

```ts
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import { useStarredProjects } from './useStarredProjects'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { SimplicateProject } from '../../domain/repositories/ISimplicateRepository'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error'

function sortProjects(projects: SimplicateProject[], starredIds: ReadonlySet<string>): { sorted: SimplicateProject[]; lastStarredId: string | undefined } {
  const starred = projects
    .filter(p => starredIds.has(p.id))
    .sort((a, b) => `${a.organizationName} — ${a.name}`.localeCompare(`${b.organizationName} — ${b.name}`))
  const rest = projects
    .filter(p => !starredIds.has(p.id))
    .sort((a, b) => `${a.organizationName} — ${a.name}`.localeCompare(`${b.organizationName} — ${b.name}`))
  const lastStarredId = starred.length > 0 ? starred[starred.length - 1]!.id : undefined
  return { sorted: [...starred, ...rest], lastStarredId }
}
```

- [ ] **Stap 2: Gebruik de gesorteerde projecten in de hook body**

In de body van `useBooking`, voeg toe na `const projects = useAppStore((s) => s.projects)`:

```ts
  const { starredIds, toggle: toggleStar } = useStarredProjects()
  const { sorted: sortedProjects, lastStarredId } = sortProjects(projects, starredIds)
```

- [ ] **Stap 3: Geef `sortedProjects`, `starredIds`, `toggleStar`, `lastStarredId` terug**

Vervang de return-waarde `projects` door `projects: sortedProjects` en voeg de nieuwe waarden toe:

```ts
  return {
    projectId, setProjectId: handleProjectChange,
    serviceId, setServiceId: handleServiceChange,
    hourTypeId, setHourTypeId,
    note, setNote,
    startTime, setStartTime,
    endTime, setEndTime,
    date, setDate,
    services,
    status,
    errorMessage,
    missingFields,
    canBook: missingFields.length === 0,
    projects: sortedProjects,
    starredIds,
    toggleStar,
    lastStarredId,
    hourTypes,
    book,
  }
```

- [ ] **Stap 4: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 5: Commit**

```bash
git add src/ui/hooks/useBooking.ts
git commit -m "feat: useBooking sorteert projecten op starred-status"
```

---

### Task 5: `BookingModal` — ster-knop in project dropdown

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Stap 1: Voeg ster-knop toe aan de project `FieldSelector`**

In `BookingModal.tsx`, zoek de `FieldSelector` voor het project (label="Project") en vervang die sectie:

```tsx
<FieldSelector
  label="Project"
  value={booking.projectId}
  options={booking.projects.map((p) => ({ id: p.id, label: `${p.organizationName} — ${p.name}` }))}
  onChange={booking.setProjectId}
  highlight={!booking.projectId}
  groupSeparatorAfter={booking.lastStarredId}
  renderSuffix={(opt) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); void booking.toggleStar(opt.id) }}
      className="p-1 text-[0.875rem] leading-none hover:opacity-100 transition-opacity"
      style={{ color: booking.starredIds.has(opt.id) ? '#f59e0b' : '#3a3530', opacity: booking.starredIds.has(opt.id) ? 1 : 0.5 }}
      title={booking.starredIds.has(opt.id) ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
    >
      {booking.starredIds.has(opt.id) ? '★' : '☆'}
    </button>
  )}
/>
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Run alle tests**

```bash
npm run test
```

Verwacht: alle tests groen.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "feat: ster-knop in project dropdown BookingModal"
```

---

### Task 6: `AccountSettings` — sectie "Favoriete projecten"

**Files:**
- Modify: `src/ui/pages/Settings/AccountSettings.tsx`

- [ ] **Stap 1: Voeg `useStarredProjects` en projectenlijst toe**

Voeg bovenaan de imports toe:

```ts
import { useStarredProjects } from '../../hooks/useStarredProjects'
```

Voeg bovenaan in de component body toe (na de bestaande hooks):

```ts
  const projects = useAppStore((s) => s.projects)
  const { starredIds, toggle: toggleStar } = useStarredProjects()

  const sortedProjects = [...projects].sort((a, b) =>
    `${a.organizationName} — ${a.name}`.localeCompare(`${b.organizationName} — ${b.name}`)
  )
  const starredProjects = sortedProjects.filter(p => starredIds.has(p.id))
  const otherProjects = sortedProjects.filter(p => !starredIds.has(p.id))
```

- [ ] **Stap 2: Voeg de sectie toe onderaan de JSX, vóór de sluitende `</div>`**

Voeg toe als laatste sectie in de return JSX (zoek de plek vlak voor de laatste sluitende `</div>` van de component):

```tsx
{projects.length > 0 && (
  <div className="mt-8">
    <div className="text-[0.625rem] uppercase tracking-widest text-[#7a7268] mb-3">Favoriete projecten</div>
    <div className="flex flex-col gap-1">
      {starredProjects.map(p => (
        <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-[#1e2418] border border-[#2e3a26] rounded-lg">
          <div>
            <div className="text-[#e8e2d9] text-[0.75rem] font-medium">{p.name}</div>
            <div className="text-[#5a8a6a] text-[0.625rem]">{p.organizationName}</div>
          </div>
          <button
            type="button"
            onClick={() => void toggleStar(p.id)}
            className="text-[#f59e0b] text-[1rem] hover:opacity-70 transition-opacity"
            title="Verwijder uit favorieten"
          >
            ★
          </button>
        </div>
      ))}
      {otherProjects.map(p => (
        <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-[#1c1917] border border-[#2e2a26] rounded-lg opacity-60 hover:opacity-100 transition-opacity">
          <div>
            <div className="text-[#e8e2d9] text-[0.75rem]">{p.name}</div>
            <div className="text-[#4a4540] text-[0.625rem]">{p.organizationName}</div>
          </div>
          <button
            type="button"
            onClick={() => void toggleStar(p.id)}
            className="text-[#3a3530] hover:text-[#f59e0b] text-[1rem] transition-colors"
            title="Voeg toe aan favorieten"
          >
            ☆
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 4: Run alle tests**

```bash
npm run test
```

Verwacht: alle tests groen.

- [ ] **Stap 5: Commit**

```bash
git add src/ui/pages/Settings/AccountSettings.tsx
git commit -m "feat: sectie favoriete projecten in AccountSettings"
```
