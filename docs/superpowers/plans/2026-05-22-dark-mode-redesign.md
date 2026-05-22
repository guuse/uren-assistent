# Dark Mode Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the warm cream palette for a warm dark (espresso/charcoal) palette across all 14 UI files — pure token swap, zero logic changes.

**Architecture:** Every change is a className string replacement. No new files, no new components, no logic, no layout changes. Domain/application/infrastructure layers untouched.

**Tech Stack:** React, Tailwind CSS (inline arbitrary values), TypeScript strict mode.

---

## Token Reference

| Old value | New value | Notes |
|---|---|---|
| `bg-[#faf8f4]` | `bg-[#1c1917]` | Page bg |
| `bg-[#f2ede6]` | `bg-[#171512]` | Sidebar bg / input bg in modal |
| `bg-white` | `bg-[#252220]` | Card / modal surfaces |
| `bg-[#fff8f5]` | `bg-[#221e1b]` | Error bg tint |
| `bg-[#1a1a2e]` | `bg-[#1e1b18]` | Old dark input bg |
| `bg-[#2d2d44]` | `bg-[#252220]` | Old dark dropdown bg |
| `bg-[#12121e]` | `bg-[#171512]` | Old darkest bg |
| `text-[#3a3530]` | `text-[#e8e2d9]` | Primary text |
| `text-[#a09890]` | `text-[#7a7268]` | Muted text |
| `text-[#c0b8b0]` | `text-[#4a4540]` | Faint text |
| `text-[#c8c0b8]` | `text-[#4a4540]` | Faint text (icon/label variant) |
| `text-white` | `text-[#e8e2d9]` | Old forced white |
| `text-gray-400` | `text-[#7a7268]` | Old gray label |
| `text-gray-500` | `text-[#4a4540]` | Old gray placeholder |
| `text-gray-300` | `text-[#a09890]` | Old gray secondary |
| `border-[#e8e2d9]` | `border-[#2e2a26]` | Default border |
| `border-[#e0d9d0]` | `border-[#2e2a26]` | Default border (alt) |
| `border-[#d0c9c0]` | `border-[#3e3a36]` | Hover border |
| `border-[#f0ddd5]` | `border-[#3a2e2a]` | Error border tint |
| `border-gray-700` | `border-[#2e2a26]` | Old dark border |
| `border-gray-800` | `border-[#252220]` | Old darkest border |
| `border-gray-600` | `border-[#3e3a36]` | Old hover border |
| `bg-[#3a3530]` (button) | `bg-[#e8e2d9]` | Primary CTA bg |
| `text-[#faf8f4]` (button text) | `text-[#1c1917]` | Primary CTA text |
| `hover:bg-[#2e2b26]` | `hover:bg-[#d5cfc6]` | CTA hover |
| `bg-[#6c63ff]` | `bg-[#e8e2d9]` + add `text-[#1c1917]` | Old purple CTA |
| `hover:bg-[#5a52e0]` | `hover:bg-[#d5cfc6]` | Old purple hover |
| `text-[#6a9e80]` | `text-[#5a8a6a]` | Success text |
| `text-[#d97757]` | `text-[#b85a3a]` | Error text |
| `text-[#c4956a]` | `text-[#a07848]` | Warning text |
| `bg-green-900/40 text-green-300` | `bg-[#1e2e22] text-[#5a8a6a]` | Success banner |
| `bg-red-900/40 text-red-300` | `bg-[#2e1e1a] text-[#b85a3a]` | Error banner |
| `text-red-400 hover:text-red-300` | `text-[#b85a3a] hover:text-[#c86a4a]` | Destructive text btn |
| `focus:border-[#a09890]` | `focus:border-[#5a5248]` | Focus ring |
| `focus:border-[#6c63ff]` | `focus:border-[#5a5248]` | Old purple focus |
| `bg-[#3a353012]` | `bg-[#2e2a26]` | Active nav bg |
| `hover:bg-[#3a35300a]` | `hover:bg-[#252220]` | Nav hover bg |
| `stroke-[#3a3530]` | `stroke-[#e8e2d9]` | Active icon stroke |
| `stroke-[#c8c0b8]` | `stroke-[#4a4540]` | Inactive icon stroke |
| `bg-[#6c63ff] text-white` (toggle active) | `bg-[#e8e2d9] text-[#1c1917]` | Active toggle |
| `bg-[#1a1a2e] text-gray-400 hover:text-white` (toggle inactive) | `bg-[#1e1b18] text-[#7a7268] hover:text-[#e8e2d9]` | Inactive toggle |
| `bg-[#e8e2d9]` (avatar bg) | `bg-[#2e2a26]` | Avatar bg |
| `text-[#3a3530]` (avatar text) | `text-[#e8e2d9]` | Avatar initials |
| `text-amber-400` | `text-[#a07848]` | Required warning icon |
| `text-green-400` | `text-[#5a8a6a]` | Success checkmark |

---

## Task 1: Sidebar.tsx

**Files:**
- Modify: `src/ui/components/Sidebar.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

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
          active ? 'bg-[#2e2a26]' : 'hover:bg-[#252220]'
        }`}
      >
        <Icon
          className={`w-[15px] h-[15px] ${active ? 'stroke-[#e8e2d9]' : 'stroke-[#4a4540]'}`}
          strokeWidth={active ? 2 : 1.5}
        />
      </button>
    )
  }

  return (
    <div className="w-[52px] flex-shrink-0 bg-[#171512] border-r border-[#2e2a26] flex flex-col items-center py-3 gap-[6px]">
      {/* Logo mark */}
      <div className="w-[30px] h-[30px] bg-[#e8e2d9] rounded-lg mb-[10px]" />

      {navItem('home', HomeIcon, 'Home')}
      {navItem('import', ArrowDownTrayIcon, 'Importeer')}

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

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `Sidebar.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/Sidebar.tsx
git commit -m "style: dark mode token swap — Sidebar"
```

---

## Task 2: Home.tsx

**Files:**
- Modify: `src/ui/pages/Home.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

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
  color: '#e8e2d9',
  startTime: '09:00',
  endTime: '09:30',
}

interface Props {
  onOpenSettings: () => void
}

export function HomePage({ onOpenSettings }: Props) {
  const { templates, isLoading } = useTemplates()
  const { logout } = useAuth()
  const user = useAppStore((s) => s.user)
  const projects = useAppStore((s) => s.projects)
  const { isSyncing, syncError, sync } = useSimplicateData()
  const [bookingTemplate, setBookingTemplate] = useState<Template | null>(null)

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="h-full bg-[#1c1917] flex flex-col overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex-1 overflow-y-auto flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[#e8e2d9] text-[15px] font-bold tracking-tight">Uren schrijven</div>
            <div className="text-[#7a7268] text-[11px] mt-0.5 capitalize">{today}</div>
          </div>
          <button
            onClick={() => setBookingTemplate(QUICK_BOOK_TEMPLATE)}
            className="bg-[#e8e2d9] text-[#1c1917] rounded-md px-[14px] py-[7px] text-[11px] font-semibold hover:bg-[#d5cfc6] transition-colors cursor-pointer"
          >
            + Boeken
          </button>
        </div>

        {/* Sync/error messages */}
        {syncError && !isSyncing && (
          <div className="text-[11px] text-[#b85a3a] bg-[#221e1b] border border-[#3a2e2a] rounded-lg px-3 py-2">
            Sync mislukt — {syncError}
          </div>
        )}

        {/* Template grid */}
        {isLoading ? (
          <div className="text-[#7a7268] text-[11px]">Laden...</div>
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
              className="border border-dashed border-[#2e2a26] rounded-[10px] p-[14px] flex items-center justify-center text-[#4a4540] text-[11px] hover:border-[#3e3a36] hover:text-[#7a7268] transition-colors cursor-pointer"
            >
              + Template toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-6 py-[10px] border-t border-[#2e2a26] flex items-center justify-between">
        <span className="text-[#4a4540] text-[10px]">Ingelogd als {user?.name}</span>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => { void sync() }}
            disabled={isSyncing}
            className="text-[#4a4540] text-[10px] hover:text-[#7a7268] disabled:opacity-40 cursor-pointer transition-colors"
          >
            {isSyncing ? 'Synchroniseren...' : `↻ Sync${projects.length > 0 ? ` (${projects.length})` : ''}`}
          </button>
          <button onClick={logout} className="text-[#4a4540] text-[10px] hover:text-[#7a7268] cursor-pointer transition-colors">
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

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `Home.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Home.tsx
git commit -m "style: dark mode token swap — Home"
```

---

## Task 3: TemplateCard.tsx

**Files:**
- Modify: `src/ui/components/TemplateCard.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

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
      className="bg-[#252220] border border-[#2e2a26] rounded-[10px] p-[14px] flex flex-col gap-2 cursor-pointer group hover:border-[#3e3a36] transition-colors"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: template.color }}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="text-[#4a4540] hover:text-[#7a7268] opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
          title="Bewerken"
        >
          ✏
        </button>
      </div>
      <div className="text-[#e8e2d9] text-[12px] font-semibold leading-tight">{template.name}</div>
      <div className="text-[#7a7268] text-[11px]">{templateSubtitle(template)}</div>
      {!(template.projectId ?? template.serviceId) && (
        <div className="text-[#a07848] text-[10px]">Velden ontbreken</div>
      )}
      <button
        onClick={() => onBook(template)}
        className="mt-1 text-[#1c1917] text-[10px] font-semibold py-[5px] px-[10px] rounded-md self-start transition-opacity hover:opacity-80 cursor-pointer"
        style={{ backgroundColor: template.color }}
      >
        {actionLabel(template)}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `TemplateCard.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/TemplateCard.tsx
git commit -m "style: dark mode token swap — TemplateCard"
```

---

## Task 4: EvidencePanel.tsx

**Files:**
- Modify: `src/ui/components/EvidencePanel.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

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
    <div className="bg-[#2a2622] border border-[#2e2a26] rounded-lg px-3 py-2.5">
      <div className="text-[#4a4540] text-[9px] font-semibold uppercase tracking-[0.07em] mb-1.5">
        Wat je deed
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={item} className="flex items-center gap-1.5 min-w-0">
            <span className="w-[3px] h-[3px] rounded-full bg-[#4a4540] flex-shrink-0" />
            <span className="text-[#7a7268] text-[10px] truncate">
              {hasUrls ? displayUrl(item) : truncate(item, 80)}
              {hasUrls && hasTitles && rawTitles![i] && (
                <span className="text-[#4a4540]"> — {truncate(rawTitles![i]!, 50)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `EvidencePanel.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/EvidencePanel.tsx
git commit -m "style: dark mode token swap — EvidencePanel"
```

---

## Task 5: ImportBlockCard.tsx

**Files:**
- Modify: `src/ui/components/ImportBlockCard.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

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
  block, blockIndex, projects, fetchServices,
  bookingResult, onSave, onPrevious, onSkip, onConfirm,
}: Props) {
  const [projectId, setProjectId] = useState(block.projectId ?? '')
  const [serviceId, setServiceId] = useState(block.serviceId ?? '')
  const [projectServices, setProjectServices] = useState<Service[]>([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectId(block.projectId ?? '')
    setServiceId(block.serviceId ?? '')
  }, [block])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!projectId) { setProjectServices([]); return }
    void fetchServices(projectId).then(setProjectServices)
  }, [projectId, fetchServices])

  function handleProjectChange(id: string) {
    setProjectId(id)
    setServiceId('')
    onSave({ projectId: id })
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
  const blockTitle = block.summary || block.blockName || 'Onbekend blok'

  return (
    <div className="bg-[#252220] border border-[#2e2a26] rounded-[12px] p-[18px] flex flex-col gap-3 flex-1 min-h-0">
      {/* Block header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[#e8e2d9] text-[14px] font-bold tracking-tight leading-snug truncate">
            {blockTitle}
          </div>
          <div className="text-[#7a7268] text-[11px] mt-1">
            {formatBlockTime(block)}{formatDuration(block.startTime, block.endTime)}
          </div>
        </div>
        {confidencePct > 0 && (
          <div className="bg-[#2e2a26] text-[#7a7268] rounded text-[10px] px-[9px] py-[3px] whitespace-nowrap flex-shrink-0">
            {confidencePct}% zeker
          </div>
        )}
      </div>

      {/* Evidence panel */}
      <EvidencePanel rawTitles={block.rawTitles} rawUrls={block.rawUrls} />

      {/* Project / service selectors */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <SearchableSelect
            label="Project"
            options={projects.map(p => ({ id: p.id, label: p.name }))}
            value={projectId}
            onChange={handleProjectChange}
            placeholder="Selecteer..."
          />
        </div>
        <div>
          <SearchableSelect
            label="Dienst"
            options={projectServices.map(s => ({ id: s.id, label: s.name }))}
            value={serviceId}
            onChange={handleServiceChange}
            placeholder="Selecteer..."
            disabled={!projectId}
          />
        </div>
      </div>

      {bookingResult === 'success' && (
        <div className="text-[#5a8a6a] text-[11px]">Geboekt</div>
      )}
      {bookingResult === 'error' && (
        <div className="text-[#b85a3a] text-[11px]">Boeken mislukt — probeer opnieuw</div>
      )}

      {/* Spacer to push actions to bottom */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPrevious}
          disabled={blockIndex === 0}
          className="bg-[#1c1917] border border-[#2e2a26] text-[#7a7268] rounded-[7px] px-[14px] py-[8px] text-[11px] disabled:opacity-40 hover:border-[#3e3a36] transition-colors cursor-pointer"
        >
          ← Vorige
        </button>
        <button
          onClick={onSkip}
          className="bg-[#1c1917] border border-[#2e2a26] text-[#7a7268] rounded-[7px] px-[14px] py-[8px] text-[11px] hover:border-[#3e3a36] transition-colors cursor-pointer"
        >
          Overslaan
        </button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-1 bg-[#e8e2d9] text-[#1c1917] rounded-[7px] py-[8px] text-[11px] font-semibold disabled:opacity-40 hover:bg-[#d5cfc6] transition-colors cursor-pointer"
        >
          Bevestig →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `ImportBlockCard.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/ImportBlockCard.tsx
git commit -m "style: dark mode token swap — ImportBlockCard"
```

---

## Task 6: ImportPage.tsx

**Files:**
- Modify: `src/ui/pages/ImportPage.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
import { useRef, useState, useMemo } from 'react'
import { useImport } from '../hooks/useImport'
import { useAppStore } from '../../store/appStore'
import ImportBlockCard from '../components/ImportBlockCard'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function blockStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return '#a07848'
  if (block.origin === 'cache') return '#5a8a6a'
  if (block.confidence < 0.6) return '#a07848'
  return '#5a8a6a'
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
  }, [blocks, currentIndex])

  const currentBlock = blocks[currentIndex] ?? null
  const totalReady = [...confirmed].filter(i => {
    const b = blocks[i]
    return b?.projectId && b.serviceId
  }).length

  return (
    <div className="h-full bg-[#1c1917] flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#2e2a26] flex-shrink-0">
        <div className="text-[#e8e2d9] text-[13px] font-bold">Browsergeschiedenis importeren</div>

        {blocks.length > 0 && (
          <>
            <div className="flex-1 h-[3px] bg-[#2e2a26] rounded overflow-hidden">
              <div
                className="h-full bg-[#e8e2d9] rounded transition-all duration-300"
                style={{ width: `${((confirmed.size + skipped.size) / blocks.length) * 100}%` }}
              />
            </div>
            <div className="text-[#7a7268] text-[10px] whitespace-nowrap">
              {confirmed.size + skipped.size} / {blocks.length}
            </div>
          </>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-[#252220] border border-[#2e2a26] text-[#7a7268] rounded px-[10px] py-[4px] text-[10px] hover:border-[#3e3a36] transition-colors cursor-pointer flex-shrink-0"
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
          <label className="text-[#4a4540] text-[10px]">Min. bezoeken:</label>
          <input
            type="number"
            min={1}
            value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-12 rounded px-2 py-1 text-[11px] text-[#e8e2d9] border border-[#2e2a26] bg-[#1e1b18] focus:outline-none focus:border-[#5a5248]"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-[11px] text-[#b85a3a] bg-[#221e1b] border border-[#3a2e2a] flex-shrink-0">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-3">

        {/* Empty state */}
        {blocks.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="w-full max-w-sm border-2 border-dashed border-[#2e2a26] rounded-xl px-8 py-10 flex flex-col items-center gap-3 cursor-pointer hover:border-[#3e3a36] transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) void handleFile(file)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-[#4a4540] text-[12px] text-center leading-relaxed">
                Sleep Chrome history CSV hiernaartoe<br />of klik om te kiezen
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[#7a7268] text-[12px]">
              {status === 'parsing' && 'Bezig met analyseren...'}
              {status === 'classifying' && 'Bezig met classificeren...'}
              {status === 'booking' && 'Bezig met boeken...'}
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="text-[#e8e2d9] text-[14px] font-semibold">Klaar</div>
            <div className="text-[#7a7268] text-[12px]">
              {confirmed.size} bevestigd, {skipped.size} overgeslagen
            </div>
            {totalReady > 0 && (
              <button
                onClick={() => void bookAll()}
                className="bg-[#e8e2d9] text-[#1c1917] rounded-lg px-6 py-2.5 text-[12px] font-semibold hover:bg-[#d5cfc6] transition-colors cursor-pointer"
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
            bookingResult={bookingResults[currentIndex] ?? ''}
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
                backgroundColor: confirmed.has(i) ? '#5a8a6a' : skipped.has(i) ? '#3e3a36' : blockStatusColor(blocks[i]!),
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

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `ImportPage.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/ImportPage.tsx
git commit -m "style: dark mode token swap — ImportPage"
```

---

## Task 7: LoginPage.tsx

**Files:**
- Modify: `src/ui/pages/LoginPage.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'

export function LoginPage() {
  const { loginWithGoogle } = useAuth()
  const isLoading = useAppStore((s) => s.isLoading)
  const error = useAppStore((s) => s.error)

  return (
    <div className="min-h-screen bg-[#1c1917] flex items-center justify-center">
      <div className="bg-[#252220] border border-[#2e2a26] rounded-2xl p-10 flex flex-col items-center gap-5 w-80">
        <div className="w-10 h-10 bg-[#e8e2d9] rounded-xl" />
        <div>
          <div className="text-[#e8e2d9] text-[17px] font-bold text-center">Uren schrijven</div>
          <div className="text-[#7a7268] text-[12px] text-center mt-1.5 leading-relaxed">
            Log in met je Google account om uren te schrijven naar Simplicate.
          </div>
        </div>
        {error && (
          <div className="text-[#b85a3a] text-[11px] bg-[#221e1b] border border-[#3a2e2a] rounded-lg px-4 py-2 w-full text-center">
            {error}
          </div>
        )}
        <button
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full bg-[#e8e2d9] hover:bg-[#d5cfc6] disabled:opacity-50 text-[#1c1917] font-semibold py-3 rounded-lg text-[13px] transition-colors cursor-pointer"
        >
          {isLoading ? 'Bezig met inloggen...' : 'Login met Google'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `LoginPage.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/LoginPage.tsx
git commit -m "style: dark mode token swap — LoginPage"
```

---

## Task 8: SettingsPage.tsx

**Files:**
- Modify: `src/ui/pages/Settings/SettingsPage.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
import { useState } from 'react'
import { useTemplates } from '../../hooks/useTemplates'
import { TemplateForm } from './TemplateForm'
import { AccountSettings } from './AccountSettings'
import type { Template } from '../../../domain/entities/Template'

type Tab = 'templates' | 'account'

interface Props {
  onBack: () => void
  initialTab?: Tab
}

export function SettingsPage({ onBack, initialTab = 'templates' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [editing, setEditing] = useState<Template | null | 'new'>(null)
  const { templates, remove } = useTemplates()

  return (
    <div className="h-full bg-[#1c1917] text-[#e8e2d9] flex flex-col">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-[#2e2a26]">
        <button onClick={onBack} className="text-[#7a7268] hover:text-[#e8e2d9] text-[12px] transition-colors cursor-pointer">← Terug</button>
        <div className="text-[#e8e2d9] font-bold text-[14px]">Instellingen</div>
      </div>

      <div className="flex gap-1 px-6 pt-4">
        {(['templates', 'account'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-[#252220] border border-[#2e2a26] text-[#e8e2d9]' : 'text-[#7a7268] hover:text-[#e8e2d9]'
            }`}>
            {t === 'templates' ? 'Templates' : 'Account'}
          </button>
        ))}
      </div>

      <div className="px-6 py-4 flex-1 overflow-y-auto">
        {tab === 'templates' && editing === null && (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-[#252220] rounded-xl p-4 flex justify-between items-center border border-[#2e2a26]"
                style={{ borderLeft: `3px solid ${t.color}` }}>
                <div>
                  <div className="text-[#e8e2d9] text-sm font-medium">{t.name}</div>
                  <div className="text-[#7a7268] text-xs">{t.type}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(t)} className="text-[#7a7268] hover:text-[#e8e2d9] text-xs">Bewerken</button>
                  <button onClick={() => remove(t.id)} className="text-[#b85a3a] hover:text-[#c86a4a] text-xs">Verwijderen</button>
                </div>
              </div>
            ))}
            <button onClick={() => setEditing('new')}
              className="border border-dashed border-[#2e2a26] rounded-xl p-4 text-[#7a7268] hover:text-[#e8e2d9] hover:border-[#3e3a36] text-sm transition-colors">
              + Nieuw template
            </button>
          </div>
        )}

        {tab === 'templates' && editing !== null && (
          <div>
            <button onClick={() => setEditing(null)} className="text-[#7a7268] hover:text-[#e8e2d9] text-sm mb-4">← Terug naar templates</button>
            {editing === 'new'
              ? <TemplateForm onDone={() => setEditing(null)} />
              : <TemplateForm initial={editing} onDone={() => setEditing(null)} />
            }
          </div>
        )}

        {tab === 'account' && <AccountSettings />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `SettingsPage.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Settings/SettingsPage.tsx
git commit -m "style: dark mode token swap — SettingsPage"
```

---

## Task 9: BookingModal.tsx

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { TimeSelect } from '../components/TimeSelect'
import { isRecurringTemplate } from '../../domain/entities/Template'
import type { Template } from '../../domain/entities/Template'

interface Props {
  template: Template
  onClose: () => void
  isQuickBook?: boolean
}

function getMondayOfWeek(offset: number): string {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  today.setDate(today.getDate() + diff + offset * 7)
  return today.toISOString().split('T')[0]!
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

export function BookingModal({ template, onClose, isQuickBook = false }: Props) {
  const booking = useBooking(
    template,
    isQuickBook
      ? { initialDate: todayString(), initialStartTime: '09:00', initialEndTime: '09:30' }
      : {},
  )

  const showTimePickers = isQuickBook || !template.startTime || !template.endTime

  if (booking.status === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#252220] rounded-xl p-6 w-80 text-center flex flex-col gap-4">
          <div className="text-[#5a8a6a] text-4xl">✓</div>
          <div className="text-[#e8e2d9] font-semibold">Uren geboekt!</div>
          <button onClick={onClose} className="bg-[#e8e2d9] text-[#1c1917] py-2 rounded-lg text-sm font-medium hover:bg-[#d5cfc6] transition-colors">
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
          <div className="text-[#e8e2d9] font-bold">{template.name}</div>
          <button onClick={onClose} className="text-[#4a4540] hover:text-[#e8e2d9] text-lg">✕</button>
        </div>

        {/* Date + time pickers: shown for quick book or when template has no fixed times */}
        {showTimePickers && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-[#7a7268]">Datum</label>
              <input
                type="date"
                value={booking.weekStartDate}
                onChange={(e) => booking.setWeekStartDate(e.target.value)}
                className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <TimeSelect
                label="Van"
                value={booking.startTime}
                onChange={(time) => {
                  booking.setStartTime(time)
                  if (booking.endTime <= time) {
                    const [h, m] = time.split(':').map(Number)
                    const next = (h! * 60 + m! + 15)
                    const nh = Math.floor(next / 60).toString().padStart(2, '0')
                    const nm = (next % 60).toString().padStart(2, '0')
                    booking.setEndTime(`${nh}:${nm}`)
                  }
                }}
              />
              <TimeSelect
                label="Tot"
                value={booking.endTime}
                onChange={booking.setEndTime}
                minTime={booking.startTime}
              />
            </div>
          </>
        )}

        {/* Missing fields */}
        {!template.projectId && (
          <FieldSelector
            label="Project"
            required
            options={booking.projects.map((p) => ({ id: p.id, label: `${p.organizationName} · ${p.name}` }))}
            value={booking.projectId}
            onChange={booking.setProjectId}
          />
        )}
        {!template.serviceId && (
          <FieldSelector
            label="Dienst"
            required
            options={booking.services.map((s) => ({ id: s.id, label: s.name }))}
            value={booking.serviceId}
            onChange={booking.setServiceId}
            disabled={!booking.projectId}
          />
        )}
        {!template.hourTypeId && (
          <FieldSelector
            label="Urensoort"
            required
            options={booking.hourTypes.map((h) => ({ id: h.id, label: h.label }))}
            value={booking.hourTypeId}
            onChange={booking.setHourTypeId}
          />
        )}

        {/* Week selector for recurring templates (not shown when time pickers are visible) */}
        {!showTimePickers && isRecurringTemplate(template) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-[#7a7268]">Week</label>
            <div className="flex gap-2">
              {[0, -1].map((offset) => {
                const monday = getMondayOfWeek(offset)
                const label = offset === 0 ? 'Deze week' : 'Vorige week'
                return (
                  <button
                    key={offset}
                    onClick={() => booking.setWeekStartDate(monday)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      booking.weekStartDate === monday
                        ? 'bg-[#e8e2d9] text-[#1c1917]'
                        : 'bg-[#171512] text-[#7a7268] hover:text-[#e8e2d9]'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Note */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Toelichting</label>
          <input
            type="text"
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value)}
            placeholder="Optioneel"
            className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          />
        </div>

        {booking.errorMessage && (
          <div className="bg-[#2e1e1a] text-[#b85a3a] text-xs rounded-lg px-3 py-2">
            {booking.errorMessage}
          </div>
        )}

        <button
          onClick={booking.book}
          disabled={!booking.canBook || booking.status === 'loading'}
          className="bg-[#e8e2d9] hover:bg-[#d5cfc6] disabled:opacity-40 disabled:cursor-not-allowed text-[#1c1917] font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {booking.status === 'loading' ? 'Bezig...' : 'Boeken →'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `BookingModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "style: dark mode token swap — BookingModal"
```

---

## Task 10: SearchableSelect.tsx

**Files:**
- Modify: `src/ui/components/SearchableSelect.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
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
}

export function SearchableSelect({ label, options, value, onChange, required, disabled, placeholder = 'Kies...' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)
  const filtered = query.length > 0
    ? (() => {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
        return options.filter((o) => {
          const label = o.label.toLowerCase()
          return terms.every((term) => label.includes(term))
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
          className="w-full bg-[#1e1b18] text-left text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none disabled:opacity-50 flex items-center justify-between gap-2"
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
                filtered.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[#252220] transition-colors ${
                      opt.id === value ? 'text-[#e8e2d9] font-medium' : 'text-[#7a7268]'
                    }`}
                  >
                    {opt.label}
                  </button>
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

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `SearchableSelect.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/SearchableSelect.tsx
git commit -m "style: dark mode token swap — SearchableSelect"
```

---

## Task 11: DayPicker.tsx

**Files:**
- Modify: `src/ui/components/DayPicker.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
import type { Day } from '../../domain/entities/Template'

const DAYS: { key: Day; label: string }[] = [
  { key: 'mon', label: 'Ma' },
  { key: 'tue', label: 'Di' },
  { key: 'wed', label: 'Wo' },
  { key: 'thu', label: 'Do' },
  { key: 'fri', label: 'Vr' },
  { key: 'sat', label: 'Za' },
  { key: 'sun', label: 'Zo' },
]

interface Props {
  selected: Day[]
  onChange: (days: Day[]) => void
}

export function DayPicker({ selected, onChange }: Props) {
  function toggle(day: Day) {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day))
    } else {
      onChange([...selected, day])
    }
  }

  return (
    <div className="flex gap-1">
      {DAYS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            selected.includes(key)
              ? 'bg-[#e8e2d9] text-[#1c1917]'
              : 'bg-[#1e1b18] text-[#7a7268] hover:text-[#e8e2d9]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `DayPicker.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/DayPicker.tsx
git commit -m "style: dark mode token swap — DayPicker"
```

---

## Task 12: TimeSelect.tsx

**Files:**
- Modify: `src/ui/components/TimeSelect.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
interface Props {
  label: string
  value: string        // HH:mm
  onChange: (time: string) => void
  minTime?: string     // HH:mm — options at or before this time are excluded
}

function generateTimes(): string[] {
  const times: string[] = []
  const [minH, minM] = '07:00'.split(':').map(Number)
  const [maxH, maxM] = '20:00'.split(':').map(Number)
  const minTotal = minH! * 60 + minM!
  const maxTotal = maxH! * 60 + maxM!
  for (let t = minTotal; t <= maxTotal; t += 15) {
    const h = Math.floor(t / 60).toString().padStart(2, '0')
    const m = (t % 60).toString().padStart(2, '0')
    times.push(`${h}:${m}`)
  }
  return times
}

const ALL_TIMES = generateTimes()

export function TimeSelect({ label, value, onChange, minTime }: Props) {
  const options = minTime
    ? ALL_TIMES.filter((t) => t > minTime)
    : ALL_TIMES

  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-xs uppercase tracking-widest text-[#7a7268]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
      >
        {options.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `TimeSelect.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/TimeSelect.tsx
git commit -m "style: dark mode token swap — TimeSelect"
```

---

## Task 13: AccountSettings.tsx

**Files:**
- Modify: `src/ui/pages/Settings/AccountSettings.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
import { useState, useEffect } from 'react'
import { keychainRepo, createSimplicateRepository } from '../../../application/container'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../../store/appStore'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export function AccountSettings() {
  const user = useAppStore((s) => s.user)
  const setSimplicateData = useAppStore((s) => s.setSimplicateData)
  const setSimplicateEmployeeId = useAppStore((s) => s.setSimplicateEmployeeId)
  const setCopilotToken = useAppStore((s) => s.setCopilotToken)
  const { logout } = useAuth()

  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [hasExisting, setHasExisting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string | null>(null)

  const [copilotTokenInput, setCopilotTokenInput] = useState('')
  const [hasCopilotToken, setHasCopilotToken] = useState(false)
  const [copilotSaved, setCopilotSaved] = useState(false)

  useEffect(() => {
    async function loadExisting() {
      const key = await keychainRepo.get('simplicate-api-key')
      const secret = await keychainRepo.get('simplicate-api-secret')
      if (key && secret) setHasExisting(true)
      const ct = await keychainRepo.get('copilot-token')
      if (ct) { setHasCopilotToken(true); setCopilotToken(ct) }
    }
    void loadExisting()
  }, [setCopilotToken])

  async function save() {
    await keychainRepo.set('simplicate-api-key', apiKey)
    await keychainRepo.set('simplicate-api-secret', apiSecret)
    setHasExisting(true)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testConnection() {
    setTestState('testing')
    setTestError(null)
    try {
      const key = apiKey || await keychainRepo.get('simplicate-api-key')
      const secret = apiSecret || await keychainRepo.get('simplicate-api-secret')
      if (!key || !secret) {
        setTestState('fail')
        setTestError('Geen credentials ingevuld.')
        return
      }
      const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, key, secret)
      const projects = await repo.getProjects()
      if (user?.email) {
        try {
          const employee = await repo.getEmployee(user.email)
          setSimplicateEmployeeId(employee.id)
        } catch {
          // Not fatal
        }
      }
      const [hourTypes] = await Promise.all([repo.getHourTypes()])
      setSimplicateData({ projects, services: [], hourTypes })
      setTestState('ok')
    } catch (err) {
      setTestState('fail')
      const msg = err instanceof Error ? err.message : String(err)
      setTestError(msg.includes('401') ? 'Ongeldige API key of secret (401).' : msg)
    }
  }

  const canSave = apiKey.length > 0 && apiSecret.length > 0
  const canTest = canSave || hasExisting

  async function saveCopilotToken() {
    await keychainRepo.set('copilot-token', copilotTokenInput)
    setCopilotToken(copilotTokenInput)
    setHasCopilotToken(true)
    setCopilotSaved(true)
    setTimeout(() => setCopilotSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">Ingelogd als</div>
        <div className="text-[#e8e2d9] text-sm">{user?.name} ({user?.email})</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">Simplicate API</div>

        {hasExisting && apiKey === '' && (
          <div className="text-xs text-[#4a4540] bg-[#1e1b18] rounded-lg px-3 py-2 border border-[#2e2a26]">
            Credentials zijn opgeslagen. Vul nieuwe in om te overschrijven.
          </div>
        )}

        <input
          type="text"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setTestState('idle') }}
          placeholder={hasExisting ? 'API Key (laat leeg om huidig te bewaren)' : 'API Key'}
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => { setApiSecret(e.target.value); setTestState('idle') }}
          placeholder={hasExisting ? 'API Secret (laat leeg om huidig te bewaren)' : 'API Secret'}
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={testConnection}
            disabled={!canTest || testState === 'testing'}
            className="flex-1 bg-[#252220] disabled:opacity-40 text-[#e8e2d9] text-sm font-medium py-2 rounded-lg border border-[#3e3a36] hover:border-[#5a5248] transition-colors"
          >
            {testState === 'testing' ? 'Testen...' : 'Test verbinding'}
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
          >
            {saved ? '✓ Opgeslagen' : 'Opslaan'}
          </button>
        </div>

        {testState === 'ok' && (
          <div className="bg-[#1e2e22] text-[#5a8a6a] text-sm rounded-lg px-3 py-2">
            ✓ Verbinding geslaagd
          </div>
        )}
        {testState === 'fail' && (
          <div className="bg-[#2e1e1a] text-[#b85a3a] text-sm rounded-lg px-3 py-2">
            {testError ?? 'Verbinding mislukt'}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">GitHub Copilot token</div>
        <div className="text-xs text-[#4a4540]">
          Verkrijg via: <code className="bg-[#1e1b18] px-1 rounded">gh auth token</code> in een terminal.
        </div>

        {hasCopilotToken && copilotTokenInput === '' && (
          <div className="text-xs text-[#4a4540] bg-[#1e1b18] rounded-lg px-3 py-2 border border-[#2e2a26]">
            Token is opgeslagen. Vul een nieuw token in om te overschrijven.
          </div>
        )}

        <input
          type="password"
          value={copilotTokenInput}
          onChange={e => setCopilotTokenInput(e.target.value)}
          placeholder={hasCopilotToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'ghu_...'}
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />

        <button
          onClick={saveCopilotToken}
          disabled={copilotTokenInput.length === 0}
          className="bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
        >
          {copilotSaved ? '✓ Opgeslagen' : 'Opslaan'}
        </button>
      </div>

      <button
        onClick={logout}
        className="text-[#b85a3a] hover:text-[#c86a4a] text-sm self-start transition-colors"
      >
        Uitloggen
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `AccountSettings.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Settings/AccountSettings.tsx
git commit -m "style: dark mode token swap — AccountSettings"
```

---

## Task 14: TemplateForm.tsx

**Files:**
- Modify: `src/ui/pages/Settings/TemplateForm.tsx`

- [ ] **Step 1: Apply token swap**

Replace the full file content:

```tsx
import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useTemplates } from '../../hooks/useTemplates'
import { useAppStore } from '../../../store/appStore'
import { keychainRepo, createSimplicateRepository } from '../../../application/container'
import { DayPicker } from '../../components/DayPicker'
import { SearchableSelect } from '../../components/SearchableSelect'
import type { Template, TemplateType, Day } from '../../../domain/entities/Template'
import type { SimplicateService } from '../../../domain/repositories/ISimplicateRepository'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string
const COLORS = ['#e8e2d9', '#63c5ff', '#63ffb4', '#f59e0b', '#f87171', '#a78bfa']
const TYPE_LABELS: Record<TemplateType, string> = {
  recurring: 'Herhalend (ma–vr)',
  single: 'Los (vandaag)',
  'weekly-block': 'Wekelijks blok',
}

interface Props {
  initial?: Template
  onDone: () => void
}

export function TemplateForm({ initial, onDone }: Props) {
  const { save } = useTemplates()
  const projects = useAppStore((s) => s.projects)
  const hourTypes = useAppStore((s) => s.hourTypes)

  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<TemplateType>(initial?.type ?? 'recurring')
  const [color, setColor] = useState(initial?.color ?? COLORS[0]!)
  const [startTime, setStartTime] = useState<string | undefined>(initial?.startTime)
  const [endTime, setEndTime] = useState<string | undefined>(initial?.endTime)
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(initial?.hourTypeId ?? '')
  const [defaultNote, setDefaultNote] = useState(initial?.defaultNote ?? '')
  const [days, setDays] = useState<Day[]>(
    initial?.type === 'recurring' ? initial.days : ['mon', 'tue', 'wed', 'thu', 'fri'],
  )
  const [day, setDay] = useState<Day>(
    initial?.type === 'weekly-block' ? initial.day : 'mon',
  )
  const [services, setServices] = useState<SimplicateService[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load services when projectId changes
  useEffect(() => {
    if (!projectId) {
      setServices([])
      setServiceId('')
      return
    }
    setLoadingServices(true)
    async function load() {
      try {
        const key = await keychainRepo.get('simplicate-api-key')
        const secret = await keychainRepo.get('simplicate-api-secret')
        if (!key || !secret) return
        const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, key, secret)
        const result = await repo.getServices(projectId)
        setServices(result)
      } catch {
        setServices([])
      } finally {
        setLoadingServices(false)
      }
    }
    void load()
  }, [projectId])

  function handleProjectChange(id: string) {
    setProjectId(id)
    setServiceId('')
  }

  async function handleSave() {
    setError(null)
    try {
      const base = {
        id: initial?.id ?? uuidv4(),
        name,
        color,
        ...(startTime !== undefined ? { startTime } : {}),
        ...(endTime !== undefined ? { endTime } : {}),
        ...(projectId ? { projectId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(hourTypeId ? { hourTypeId } : {}),
        ...(defaultNote ? { defaultNote } : {}),
      }
      let template: Template
      if (type === 'recurring') template = { ...base, type: 'recurring', days }
      else if (type === 'single') template = { ...base, type: 'single' }
      else template = { ...base, type: 'weekly-block', day }
      await save(template)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-[#7a7268]">Naam</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Dagelijkse standup"
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-widest text-[#7a7268]">Type</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TYPE_LABELS) as TemplateType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                type === t ? 'bg-[#e8e2d9] text-[#1c1917]' : 'bg-[#1e1b18] text-[#7a7268] hover:text-[#e8e2d9]'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {type === 'recurring' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Dagen</label>
          <DayPicker selected={days} onChange={setDays} />
        </div>
      )}

      {type === 'weekly-block' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Dag</label>
          <DayPicker selected={[day]} onChange={(d) => { if (d[0]) setDay(d[0]) }} />
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-widest text-[#7a7268]">Starttijd</label>
            <button
              type="button"
              onClick={() => setStartTime(startTime !== undefined ? undefined : '09:00')}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                startTime === undefined
                  ? 'bg-[#e8e2d9] text-[#1c1917]'
                  : 'bg-[#1e1b18] text-[#4a4540] hover:text-[#7a7268]'
              }`}
            >
              Dynamisch
            </button>
          </div>
          {startTime !== undefined ? (
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
            />
          ) : (
            <div className="bg-[#1e1b18] text-[#4a4540] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] border-dashed">
              Kiest gebruiker bij boeking
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-widest text-[#7a7268]">Eindtijd</label>
            <button
              type="button"
              onClick={() => setEndTime(endTime !== undefined ? undefined : '09:30')}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                endTime === undefined
                  ? 'bg-[#e8e2d9] text-[#1c1917]'
                  : 'bg-[#1e1b18] text-[#4a4540] hover:text-[#7a7268]'
              }`}
            >
              Dynamisch
            </button>
          </div>
          {endTime !== undefined ? (
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
            />
          ) : (
            <div className="bg-[#1e1b18] text-[#4a4540] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] border-dashed">
              Kiest gebruiker bij boeking
            </div>
          )}
        </div>
      </div>

      <SearchableSelect
        label="Project (optioneel)"
        options={projects.map((p) => ({ id: p.id, label: `${p.organizationName} · ${p.name}` }))}
        value={projectId || undefined}
        onChange={handleProjectChange}
      />
      <SearchableSelect
        label={loadingServices ? 'Dienst (laden...)' : 'Dienst (optioneel)'}
        options={services.map((s) => ({ id: s.id, label: s.name }))}
        value={serviceId || undefined}
        onChange={setServiceId}
        disabled={!projectId || loadingServices}
        placeholder={!projectId ? 'Kies eerst een project' : 'Kies...'}
      />
      <SearchableSelect
        label="Urensoort (optioneel)"
        options={hourTypes.map((h) => ({ id: h.id, label: h.label }))}
        value={hourTypeId || undefined}
        onChange={setHourTypeId}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-[#7a7268]">Standaard toelichting</label>
        <input type="text" value={defaultNote} onChange={(e) => setDefaultNote(e.target.value)}
          placeholder="Optioneel"
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-[#7a7268]">Kleur</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-[#e8e2d9] ring-offset-1 ring-offset-[#252220]' : ''}`}
            />
          ))}
        </div>
      </div>

      {error && <div className="bg-[#2e1e1a] text-[#b85a3a] text-xs rounded-lg px-3 py-2">{error}</div>}

      <button onClick={handleSave}
        className="bg-[#e8e2d9] hover:bg-[#d5cfc6] text-[#1c1917] font-semibold py-2.5 rounded-lg text-sm transition-colors">
        {initial ? 'Opslaan' : 'Template aanmaken'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors in `TemplateForm.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Settings/TemplateForm.tsx
git commit -m "style: dark mode token swap — TemplateForm"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 2: Run unit tests**

```bash
npm run test
```

Expected: all tests pass (83+)

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no new errors (pre-existing errors in `useSimplicateData.ts`, `useTemplates.ts` are not our responsibility)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style: dark mode redesign complete — all 14 files"
```
