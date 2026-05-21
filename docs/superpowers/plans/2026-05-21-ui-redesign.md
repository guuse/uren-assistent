# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the app UI — icon sidebar, warm cream palette, focused card import flow — touching only UI layer files.

**Architecture:** Pure UI changes. Zero domain/application/infrastructure modifications. New `Sidebar` component drives navigation. `ImportPage` rewrites its own layout; `ImportBlockModal` is deleted. All color tokens applied as inline Tailwind arbitrary values matching the spec.

**Tech Stack:** React, TypeScript, Tailwind CSS, Heroicons (`@heroicons/react/24/outline`)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/App.tsx` | Modify | Remove `<nav>`, add `<Sidebar>`, update wrapper |
| `src/ui/components/Sidebar.tsx` | Create | New icon sidebar component |
| `src/ui/pages/Home.tsx` | Modify | New tokens, new header/status bar |
| `src/ui/components/TemplateCard.tsx` | Modify | New card styles, dot instead of left border |
| `src/ui/pages/ImportPage.tsx` | Rewrite | Focused card flow, no modal |
| `src/ui/components/ImportBlockCard.tsx` | Create | The focused block review card |
| `src/ui/components/EvidencePanel.tsx` | Modify | Restyle to new tokens |
| `src/ui/components/ImportBlockModal.tsx` | Delete | Absorbed into ImportBlockCard |
| `src/ui/pages/LoginPage.tsx` | Modify | New tokens |
| `src/ui/pages/Settings/SettingsPage.tsx` | Modify | New tokens |
| `src/ui/pages/BookingModal.tsx` | Modify | New tokens |

---

## Task 1: Sidebar component

**Files:**
- Create: `src/ui/components/Sidebar.tsx`

- [ ] **Create `Sidebar.tsx`**

```tsx
import { HomeIcon, ArrowDownTrayIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '../../store/appStore'

type Page = 'home' | 'import'

interface Props {
  current: Page
  onNavigate: (page: Page) => void
  onSettings: () => void
}

export function Sidebar({ current, onNavigate, onSettings }: Props) {
  const user = useAppStore((s) => s.user)
  const initials = user?.name?.charAt(0).toUpperCase() ?? '?'

  function navItem(page: Page, Icon: React.ElementType, label: string) {
    const active = current === page
    return (
      <button
        title={label}
        onClick={() => onNavigate(page)}
        className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
          active ? 'bg-[#3a353012]' : 'hover:bg-[#3a35300a]'
        }`}
      >
        <Icon
          className={`w-[15px] h-[15px] ${active ? 'stroke-[#3a3530]' : 'stroke-[#c8c0b8]'}`}
          strokeWidth={active ? 2 : 1.5}
        />
      </button>
    )
  }

  return (
    <div className="w-[52px] flex-shrink-0 bg-[#f2ede6] border-r border-[#e8e2d9] flex flex-col items-center py-3 gap-[6px]">
      {/* Logo mark */}
      <div className="w-[30px] h-[30px] bg-[#3a3530] rounded-lg mb-[10px]" />

      {navItem('home', HomeIcon, 'Home')}
      {navItem('import', ArrowDownTrayIcon, 'Importeer')}

      <div className="flex-1" />

      <button
        title="Instellingen"
        onClick={onSettings}
        className="w-[34px] h-[34px] rounded-lg flex items-center justify-center hover:bg-[#3a35300a] transition-colors cursor-pointer"
      >
        <Cog6ToothIcon className="w-[15px] h-[15px] stroke-[#c8c0b8]" strokeWidth={1.5} />
      </button>

      {/* Avatar */}
      <div className="w-[26px] h-[26px] bg-[#e8e2d9] rounded-full flex items-center justify-center mt-1">
        <span className="text-[#3a3530] text-[10px] font-semibold">{initials}</span>
      </div>
    </div>
  )
}
```

- [ ] **Verify Heroicons is installed**

```bash
npm ls @heroicons/react
```

If missing: `npm install @heroicons/react`

- [ ] **Commit**

```bash
git add src/ui/components/Sidebar.tsx
git commit -m "feat: add Sidebar component (icon rail, warm cream)"
```

---

## Task 2: Update App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Rewrite `App.tsx`**

```tsx
import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { useAppInit } from './ui/hooks/useAppInit'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import ImportPage from './ui/pages/ImportPage'
import { Sidebar } from './ui/components/Sidebar'
import { SettingsPage } from './ui/pages/Settings/SettingsPage'

type Page = 'home' | 'import'

function App() {
  useAppInit()
  const user = useAppStore((s) => s.user)
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [showSettings, setShowSettings] = useState(false)

  if (!user) return <LoginPage />

  if (showSettings) {
    return (
      <div className="h-screen flex overflow-hidden bg-[#faf8f4]">
        <Sidebar current={currentPage} onNavigate={setCurrentPage} onSettings={() => setShowSettings(true)} />
        <div className="flex-1 overflow-hidden">
          <SettingsPage onBack={() => setShowSettings(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#faf8f4]">
      <Sidebar current={currentPage} onNavigate={setCurrentPage} onSettings={() => setShowSettings(true)} />
      <div className="flex-1 overflow-hidden">
        {currentPage === 'home' && <HomePage onOpenSettings={() => setShowSettings(true)} />}
        {currentPage === 'import' && <ImportPage />}
      </div>
    </div>
  )
}

export default App
```

- [ ] **Run typecheck**

```bash
npm run typecheck
```

Expected: errors only about `onOpenSettings` prop not existing on `HomePage` yet — fix in next task.

- [ ] **Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace top nav with Sidebar in App.tsx"
```

---

## Task 3: Redesign Home page

**Files:**
- Modify: `src/ui/pages/Home.tsx`

- [ ] **Rewrite `Home.tsx`**

```tsx
import { useState } from 'react'
import { useTemplates } from '../hooks/useTemplates'
import { TemplateCard } from '../components/TemplateCard'
import { BookingModal } from './BookingModal'
import { useAuth } from '../hooks/useAuth'
import { useSimplicateData } from '../hooks/useSimplicateData'
import { useAppStore } from '../../store/appStore'
import type { Template } from '../../domain/entities/Template'
import type { SingleTemplate } from '../../domain/entities/Template'

const QUICK_BOOK_TEMPLATE: SingleTemplate = {
  id: '__quick__',
  name: 'Vrij boeken',
  type: 'single',
  color: '#3a3530',
  startTime: '09:00',
  endTime: '09:30',
}

interface Props {
  onOpenSettings: () => void
}

export function HomePage({ onOpenSettings }: Props) {
  const { templates, isLoading, reload } = useTemplates()
  const { logout } = useAuth()
  const user = useAppStore((s) => s.user)
  const projects = useAppStore((s) => s.projects)
  const { isSyncing, syncError, sync } = useSimplicateData()
  const [bookingTemplate, setBookingTemplate] = useState<Template | null>(null)

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="h-full bg-[#faf8f4] flex flex-col overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex-1 overflow-y-auto flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[#3a3530] text-[15px] font-bold tracking-tight">Uren schrijven</div>
            <div className="text-[#a09890] text-[11px] mt-0.5 capitalize">{today}</div>
          </div>
          <button
            onClick={() => setBookingTemplate(QUICK_BOOK_TEMPLATE)}
            className="bg-[#3a3530] text-[#faf8f4] rounded-md px-[14px] py-[7px] text-[11px] font-semibold hover:bg-[#2e2b26] transition-colors cursor-pointer"
          >
            + Boeken
          </button>
        </div>

        {/* Sync/error messages */}
        {syncError && !isSyncing && (
          <div className="text-[11px] text-[#d97757] bg-[#fff8f5] border border-[#f0ddd5] rounded-lg px-3 py-2">
            Sync mislukt — {syncError}
          </div>
        )}

        {/* Template grid */}
        {isLoading ? (
          <div className="text-[#a09890] text-[11px]">Laden...</div>
        ) : (
          <div className="grid grid-cols-2 gap-[10px]">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onBook={setBookingTemplate}
                onEdit={onOpenSettings}
              />
            ))}
            <button
              onClick={onOpenSettings}
              className="border border-dashed border-[#e0d9d0] rounded-[10px] p-[14px] flex items-center justify-center text-[#c8c0b8] text-[11px] hover:border-[#d0c9c0] hover:text-[#b0a898] transition-colors cursor-pointer"
            >
              + Template toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-6 py-[10px] border-t border-[#e8e2d9] flex items-center justify-between">
        <span className="text-[#c0b8b0] text-[10px]">Ingelogd als {user?.name}</span>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => { void sync() }}
            disabled={isSyncing}
            className="text-[#c0b8b0] text-[10px] hover:text-[#a09890] disabled:opacity-40 cursor-pointer transition-colors"
          >
            {isSyncing ? 'Synchroniseren...' : `↻ Sync${projects.length > 0 ? ` (${projects.length})` : ''}`}
          </button>
          <button onClick={logout} className="text-[#c0b8b0] text-[10px] hover:text-[#a09890] cursor-pointer transition-colors">
            Uitloggen
          </button>
        </div>
      </div>

      {bookingTemplate && (
        <BookingModal
          template={bookingTemplate}
          onClose={() => setBookingTemplate(null)}
          isQuickBook={bookingTemplate.id === '__quick__'}
        />
      )}
    </div>
  )
}
```

Note: `TemplateCard`'s `onEdit` signature currently takes `(template: Template) => void`. The new call passes `onOpenSettings` which takes no args. Update the `onEdit` prop type in `TemplateCard` to `() => void` in the next task.

- [ ] **Run typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/ui/pages/Home.tsx
git commit -m "feat: redesign Home page with warm cream tokens"
```

---

## Task 4: Restyle TemplateCard

**Files:**
- Modify: `src/ui/components/TemplateCard.tsx`

- [ ] **Rewrite `TemplateCard.tsx`**

```tsx
import type { Template } from '../../domain/entities/Template'
import { isRecurringTemplate, isWeeklyBlockTemplate } from '../../domain/entities/Template'

interface Props {
  template: Template
  onBook: (template: Template) => void
  onEdit: () => void
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Ma', tue: 'Di', wed: 'Wo', thu: 'Do', fri: 'Vr', sat: 'Za', sun: 'Zo',
}

function templateSubtitle(template: Template): string {
  if (isRecurringTemplate(template)) {
    return `${template.days.map((d) => DAY_LABELS[d] ?? d).join('–')} · ${template.startTime}–${template.endTime}`
  }
  if (isWeeklyBlockTemplate(template)) {
    return `Elke ${DAY_LABELS[template.day] ?? template.day} · ${template.startTime}–${template.endTime}`
  }
  return `${template.startTime}–${template.endTime}`
}

function actionLabel(template: Template): string {
  if (isRecurringTemplate(template)) return 'Week invullen'
  if (isWeeklyBlockTemplate(template)) return 'Vandaag boeken'
  return 'Nu boeken'
}

export function TemplateCard({ template, onBook, onEdit }: Props) {
  return (
    <div
      className="bg-white border border-[#e8e2d9] rounded-[10px] p-[14px] flex flex-col gap-2 cursor-pointer group hover:border-[#d0c9c0] transition-colors"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: template.color }}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="text-[#c8c0b8] hover:text-[#a09890] opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
          title="Bewerken"
        >
          ✏
        </button>
      </div>
      <div className="text-[#3a3530] text-[12px] font-semibold leading-tight">{template.name}</div>
      <div className="text-[#a09890] text-[11px]">{templateSubtitle(template)}</div>
      {!(template.projectId ?? template.serviceId) && (
        <div className="text-[#c4956a] text-[10px]">Velden ontbreken</div>
      )}
      <button
        onClick={() => onBook(template)}
        className="mt-1 text-[#faf8f4] text-[10px] font-semibold py-[5px] px-[10px] rounded-md self-start transition-opacity hover:opacity-80 cursor-pointer"
        style={{ backgroundColor: template.color }}
      >
        {actionLabel(template)}
      </button>
    </div>
  )
}
```

- [ ] **Run typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/ui/components/TemplateCard.tsx
git commit -m "feat: restyle TemplateCard with dot, warm cream tokens"
```

---

## Task 5: Restyle EvidencePanel

**Files:**
- Modify: `src/ui/components/EvidencePanel.tsx`

- [ ] **Rewrite `EvidencePanel.tsx`**

```tsx
interface Props {
  rawTitles?: string[] | undefined
  rawUrls?: string[] | undefined
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.host + u.pathname
  } catch {
    return url
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function EvidencePanel({ rawTitles, rawUrls }: Props) {
  const hasUrls = rawUrls && rawUrls.length > 0
  const hasTitles = rawTitles && rawTitles.length > 0

  if (!hasUrls && !hasTitles) return null

  const items = hasUrls ? rawUrls!.slice(0, 5) : rawTitles!.slice(0, 5)

  return (
    <div className="bg-[#faf8f4] border border-[#e8e2d9] rounded-lg px-3 py-2.5">
      <div className="text-[#c0b8b0] text-[9px] font-semibold uppercase tracking-[0.07em] mb-1.5">
        Wat je deed
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={item} className="flex items-center gap-1.5 min-w-0">
            <span className="w-[3px] h-[3px] rounded-full bg-[#c0b8b0] flex-shrink-0" />
            <span className="text-[#a09890] text-[10px] truncate">
              {hasUrls ? displayUrl(item) : truncate(item, 80)}
              {hasUrls && hasTitles && rawTitles![i] && (
                <span className="text-[#c0b8b0]"> — {truncate(rawTitles![i]!, 50)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Run tests**

```bash
npm run test -- EvidencePanel
```

- [ ] **Commit**

```bash
git add src/ui/components/EvidencePanel.tsx
git commit -m "feat: restyle EvidencePanel with warm cream tokens"
```

---

## Task 6: Create ImportBlockCard

**Files:**
- Create: `src/ui/components/ImportBlockCard.tsx`

This is the focused card that replaces `ImportBlockModal`. It renders inline in `ImportPage`, not as a modal overlay.

- [ ] **Create `ImportBlockCard.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { SearchableSelect } from './SearchableSelect'
import EvidencePanel from './EvidencePanel'

interface Project { id: string; name: string }
interface Service { id: string; name: string }

interface Props {
  block: ClassifiedBlock
  blockIndex: number
  totalBlocks: number
  projects: Project[]
  fetchServices: (projectId: string) => Promise<Service[]>
  bookingResult?: 'success' | 'error' | string
  onSave: (updates: Partial<ClassifiedBlock>) => void
  onPrevious: () => void
  onSkip: () => void
  onConfirm: () => void
}

function formatBlockTime(block: ClassifiedBlock): string {
  return `${block.date ? new Date(block.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' : ''}${block.startTime} – ${block.endTime}`
}

function formatDuration(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh! * 60 + em!) - (sh! * 60 + sm!)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? ` · ${h}u${m}` : ` · ${h}u`) : ` · ${m}m`
}

export default function ImportBlockCard({
  block, blockIndex, totalBlocks, projects, fetchServices,
  bookingResult, onSave, onPrevious, onSkip, onConfirm,
}: Props) {
  const [projectId, setProjectId] = useState(block.projectId ?? '')
  const [serviceId, setServiceId] = useState(block.serviceId ?? '')
  const [projectServices, setProjectServices] = useState<Service[]>([])

  useEffect(() => {
    setProjectId(block.projectId ?? '')
    setServiceId(block.serviceId ?? '')
  }, [block])

  useEffect(() => {
    if (!projectId) { setProjectServices([]); return }
    void fetchServices(projectId).then(setProjectServices)
  }, [projectId, fetchServices])

  function handleProjectChange(id: string) {
    setProjectId(id)
    setServiceId('')
    onSave({ projectId: id, serviceId: undefined })
  }

  function handleServiceChange(id: string) {
    setServiceId(id)
    onSave({ serviceId: id })
  }

  const canConfirm = !!projectId && !!serviceId && bookingResult !== 'success'

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') onPrevious()
    if (e.key === 'ArrowRight' && canConfirm) onConfirm()
  }, [onPrevious, onConfirm, canConfirm])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const confidencePct = Math.round((block.confidence ?? 0) * 100)
  const blockTitle = [block.projectName, block.serviceName].filter(Boolean).join(' — ') || block.summary || 'Onbekend blok'

  return (
    <div className="bg-white border border-[#e8e2d9] rounded-[12px] p-[18px] flex flex-col gap-3 flex-1 min-h-0">
      {/* Block header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[#3a3530] text-[14px] font-bold tracking-tight leading-snug truncate">
            {blockTitle}
          </div>
          <div className="text-[#a09890] text-[11px] mt-1">
            {formatBlockTime(block)}{formatDuration(block.startTime, block.endTime)}
          </div>
        </div>
        {confidencePct > 0 && (
          <div className="bg-[#f2ede6] text-[#a09890] rounded text-[10px] px-[9px] py-[3px] whitespace-nowrap flex-shrink-0">
            {confidencePct}% zeker
          </div>
        )}
      </div>

      {/* Evidence panel */}
      <EvidencePanel rawTitles={block.rawTitles} rawUrls={block.rawUrls} />

      {/* Project / service selectors */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <div className="text-[#c0b8b0] text-[9px] font-semibold uppercase tracking-[0.07em] mb-1">Project</div>
          <SearchableSelect
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            value={projectId}
            onChange={handleProjectChange}
            placeholder="Selecteer..."
          />
        </div>
        <div>
          <div className="text-[#c0b8b0] text-[9px] font-semibold uppercase tracking-[0.07em] mb-1">Dienst</div>
          <SearchableSelect
            options={projectServices.map(s => ({ value: s.id, label: s.name }))}
            value={serviceId}
            onChange={handleServiceChange}
            placeholder="Selecteer..."
            disabled={!projectId}
          />
        </div>
      </div>

      {bookingResult === 'success' && (
        <div className="text-[#6a9e80] text-[11px]">Geboekt</div>
      )}
      {bookingResult === 'error' && (
        <div className="text-[#d97757] text-[11px]">Boeken mislukt — probeer opnieuw</div>
      )}

      {/* Spacer to push actions to bottom */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPrevious}
          disabled={blockIndex === 0}
          className="bg-[#faf8f4] border border-[#e8e2d9] text-[#a09890] rounded-[7px] px-[14px] py-[8px] text-[11px] disabled:opacity-40 hover:border-[#d0c9c0] transition-colors cursor-pointer"
        >
          ← Vorige
        </button>
        <button
          onClick={onSkip}
          className="bg-[#faf8f4] border border-[#e8e2d9] text-[#a09890] rounded-[7px] px-[14px] py-[8px] text-[11px] hover:border-[#d0c9c0] transition-colors cursor-pointer"
        >
          Overslaan
        </button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-1 bg-[#3a3530] text-[#faf8f4] rounded-[7px] py-[8px] text-[11px] font-semibold disabled:opacity-40 hover:bg-[#2e2b26] transition-colors cursor-pointer"
        >
          Bevestig →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Check `SearchableSelect` accepts a `disabled` prop**

```bash
grep -n "disabled" src/ui/components/SearchableSelect.tsx
```

If `disabled` is not in the props interface, add it:

Open `src/ui/components/SearchableSelect.tsx`, find the props interface and add `disabled?: boolean`. Pass it to the underlying `<select>` or input element.

- [ ] **Run typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/ui/components/ImportBlockCard.tsx
git commit -m "feat: add ImportBlockCard (focused inline review card)"
```

---

## Task 7: Rewrite ImportPage

**Files:**
- Modify: `src/ui/pages/ImportPage.tsx`
- Delete: `src/ui/components/ImportBlockModal.tsx`

- [ ] **Rewrite `ImportPage.tsx`**

```tsx
import { useRef, useState, useMemo } from 'react'
import { useImport } from '../hooks/useImport'
import { useAppStore } from '../../store/appStore'
import ImportBlockCard from '../components/ImportBlockCard'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function blockStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return '#c4956a'
  if (block.origin === 'cache') return '#6a9e80'
  if (block.confidence < 0.6) return '#c4956a'
  return '#6a9e80'
}

const MAX_DOTS = 9

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projects = useAppStore(s => s.projects)
  const {
    status, error, blocks, minVisits, setMinVisits,
    analyseFile, updateBlock, bookAll, bookingResults,
    fetchServices,
  } = useImport()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set())

  const isLoading = status === 'parsing' || status === 'classifying' || status === 'booking'
  const isDone = blocks.length > 0 && (confirmed.size + skipped.size) >= blocks.length

  async function handleFile(file: File) {
    const text = await file.text()
    setCurrentIndex(0)
    setSkipped(new Set())
    setConfirmed(new Set())
    await analyseFile(text)
  }

  function handlePrevious() {
    setCurrentIndex(i => Math.max(0, i - 1))
  }

  function handleSkip() {
    setSkipped(s => new Set(s).add(currentIndex))
    setCurrentIndex(i => Math.min(blocks.length - 1, i + 1))
  }

  function handleConfirm() {
    setConfirmed(s => new Set(s).add(currentIndex))
    if (currentIndex < blocks.length - 1) {
      setCurrentIndex(i => i + 1)
    }
  }

  // Dot progress: sliding window of MAX_DOTS centered on current
  const dotIndices = useMemo(() => {
    if (blocks.length <= MAX_DOTS) return blocks.map((_, i) => i)
    const half = Math.floor(MAX_DOTS / 2)
    let start = Math.max(0, currentIndex - half)
    const end = Math.min(blocks.length - 1, start + MAX_DOTS - 1)
    start = Math.max(0, end - MAX_DOTS + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [blocks.length, currentIndex])

  const currentBlock = blocks[currentIndex] ?? null
  const totalReady = [...confirmed].filter(i => {
    const b = blocks[i]
    return b?.projectId && b.serviceId
  }).length

  return (
    <div className="h-full bg-[#faf8f4] flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#e8e2d9] flex-shrink-0">
        <div className="text-[#3a3530] text-[13px] font-bold">Browsergeschiedenis importeren</div>

        {blocks.length > 0 && (
          <>
            <div className="flex-1 h-[3px] bg-[#e8e2d9] rounded overflow-hidden">
              <div
                className="h-full bg-[#3a3530] rounded transition-all duration-300"
                style={{ width: `${((confirmed.size + skipped.size) / blocks.length) * 100}%` }}
              />
            </div>
            <div className="text-[#a09890] text-[10px] whitespace-nowrap">
              {confirmed.size + skipped.size} / {blocks.length}
            </div>
          </>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-white border border-[#e8e2d9] text-[#a09890] rounded px-[10px] py-[4px] text-[10px] hover:border-[#d0c9c0] transition-colors cursor-pointer flex-shrink-0"
        >
          + CSV
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
          />
        </button>

        <div className="flex items-center gap-1.5">
          <label className="text-[#c0b8b0] text-[10px]">Min. bezoeken:</label>
          <input
            type="number"
            min={1}
            value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-12 rounded px-2 py-1 text-[11px] text-[#3a3530] border border-[#e8e2d9] bg-white focus:outline-none focus:border-[#a09890]"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-[11px] text-[#d97757] bg-[#fff8f5] border border-[#f0ddd5] flex-shrink-0">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-3">

        {/* Empty state */}
        {blocks.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="w-full max-w-sm border-2 border-dashed border-[#e0d9d0] rounded-xl px-8 py-10 flex flex-col items-center gap-3 cursor-pointer hover:border-[#d0c9c0] transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) void handleFile(file)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-[#c0b8b0] text-[12px] text-center leading-relaxed">
                Sleep Chrome history CSV hiernaartoe<br />of klik om te kiezen
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[#a09890] text-[12px]">
              {status === 'parsing' && 'Bezig met analyseren...'}
              {status === 'classifying' && 'Bezig met classificeren...'}
              {status === 'booking' && 'Bezig met boeken...'}
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="text-[#3a3530] text-[14px] font-semibold">Klaar</div>
            <div className="text-[#a09890] text-[12px]">
              {confirmed.size} bevestigd, {skipped.size} overgeslagen
            </div>
            {totalReady > 0 && (
              <button
                onClick={() => void bookAll()}
                className="bg-[#3a3530] text-[#faf8f4] rounded-lg px-6 py-2.5 text-[12px] font-semibold hover:bg-[#2e2b26] transition-colors cursor-pointer"
              >
                Boek {totalReady} blokken
              </button>
            )}
          </div>
        )}

        {/* Review state: focused card */}
        {blocks.length > 0 && !isDone && !isLoading && currentBlock && (
          <ImportBlockCard
            block={currentBlock}
            blockIndex={currentIndex}
            totalBlocks={blocks.length}
            projects={projects}
            fetchServices={fetchServices}
            bookingResult={bookingResults[currentIndex]}
            onSave={updates => updateBlock(currentIndex, updates)}
            onPrevious={handlePrevious}
            onSkip={handleSkip}
            onConfirm={handleConfirm}
          />
        )}
      </div>

      {/* Dot progress */}
      {blocks.length > 0 && !isDone && !isLoading && (
        <div className="flex justify-center items-center gap-1.5 pb-4 flex-shrink-0">
          {dotIndices.map(i => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className="rounded-full transition-all cursor-pointer"
              style={{
                width: i === currentIndex ? 7 : 5,
                height: i === currentIndex ? 7 : 5,
                backgroundColor: confirmed.has(i) ? '#6a9e80' : skipped.has(i) ? '#c0b8b0' : blockStatusColor(blocks[i]!),
                opacity: i === currentIndex ? 1 : 0.5,
              }}
              title={`Blok ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Check `useImport` exports `fetchServices`**

```bash
grep -n "fetchServices" src/ui/hooks/useImport.ts
```

If it's named differently, adjust the destructuring in `ImportPage.tsx` accordingly.

- [ ] **Delete `ImportBlockModal.tsx`**

```bash
git rm src/ui/components/ImportBlockModal.tsx
```

- [ ] **Run typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/ui/pages/ImportPage.tsx
git commit -m "feat: rewrite ImportPage with focused card review flow"
```

---

## Task 8: Restyle LoginPage

**Files:**
- Modify: `src/ui/pages/LoginPage.tsx`

- [ ] **Rewrite `LoginPage.tsx`**

```tsx
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'

export function LoginPage() {
  const { loginWithGoogle } = useAuth()
  const isLoading = useAppStore((s) => s.isLoading)
  const error = useAppStore((s) => s.error)

  return (
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center">
      <div className="bg-white border border-[#e8e2d9] rounded-2xl p-10 flex flex-col items-center gap-5 w-80">
        <div className="w-10 h-10 bg-[#3a3530] rounded-xl" />
        <div>
          <div className="text-[#3a3530] text-[17px] font-bold text-center">Uren schrijven</div>
          <div className="text-[#a09890] text-[12px] text-center mt-1.5 leading-relaxed">
            Log in met je Google account om uren te schrijven naar Simplicate.
          </div>
        </div>
        {error && (
          <div className="text-[#d97757] text-[11px] bg-[#fff8f5] border border-[#f0ddd5] rounded-lg px-4 py-2 w-full text-center">
            {error}
          </div>
        )}
        <button
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full bg-[#3a3530] hover:bg-[#2e2b26] disabled:opacity-50 text-[#faf8f4] font-semibold py-3 rounded-lg text-[13px] transition-colors cursor-pointer"
        >
          {isLoading ? 'Bezig met inloggen...' : 'Login met Google'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/ui/pages/LoginPage.tsx
git commit -m "feat: restyle LoginPage with warm cream tokens"
```

---

## Task 9: Restyle SettingsPage

**Files:**
- Modify: `src/ui/pages/Settings/SettingsPage.tsx`

- [ ] **Apply tokens to `SettingsPage.tsx`**

Replace the class names in the existing structure — do not change any logic:

- `min-h-screen bg-[#1a1a2e] text-white flex flex-col` → `h-full bg-[#faf8f4] text-[#3a3530] flex flex-col`
- `p-6 flex items-center gap-4 border-b border-gray-800` → `px-6 py-4 flex items-center gap-4 border-b border-[#e8e2d9]`
- `text-gray-400 hover:text-white text-sm` (back button) → `text-[#a09890] hover:text-[#3a3530] text-[12px] transition-colors cursor-pointer`
- `font-bold` (title) → `text-[#3a3530] font-bold text-[14px]`
- Tab button active: `bg-[#2d2d44] text-white` → `bg-white border border-[#e8e2d9] text-[#3a3530]`
- Tab button inactive: `text-gray-400 hover:text-white` → `text-[#a09890] hover:text-[#3a3530]`
- `p-6 flex-1 overflow-y-auto` (content area) → `px-6 py-4 flex-1 overflow-y-auto`

- [ ] **Run typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/ui/pages/Settings/SettingsPage.tsx
git commit -m "feat: apply warm cream tokens to SettingsPage"
```

---

## Task 10: Restyle BookingModal

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Read current BookingModal to understand structure**

```bash
# Read the file before editing
```

Open `src/ui/pages/BookingModal.tsx` and apply these token replacements throughout:
- Background `#1a1a2e` / `#2d2d44` / `#12121e` → `#faf8f4` / `white` / `#f2ede6`
- Text `white` / `gray-*` → `#3a3530` / `#a09890` / `#c0b8b0`
- Borders `gray-700` / `gray-800` → `#e8e2d9`
- Primary button `#6c63ff` → `#3a3530`
- Error/warning colors → `#d97757` / `#c4956a`
- Modal overlay: `bg-black/60` stays (overlay is fine dark)

- [ ] **Run typecheck**

```bash
npm run typecheck
```

- [ ] **Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "feat: apply warm cream tokens to BookingModal"
```

---

## Task 11: Final smoke test

- [ ] **Run all checks**

```bash
npm run typecheck && npm run lint && npm run test
```

Expected: no errors, no test failures.

- [ ] **Start the app and manually verify**

```bash
npm run tauri dev
```

Check:
1. Login page shows cream background, dark logo mark, no purple
2. Home page: sidebar visible, template grid renders, status bar at bottom
3. Sidebar active state changes when navigating
4. Import page: CSV drop zone visible, after upload focused card appears, navigation works
5. Settings reachable via sidebar gear icon
6. No layout whitespace gaps anywhere

- [ ] **Commit if any small fixes were needed**

```bash
git add -A
git commit -m "fix: post-redesign smoke test fixes"
```
