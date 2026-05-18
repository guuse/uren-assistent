# Quick Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "+ Boeken" button in the Home header that opens a free-form booking modal (no template required) with date picker and quarter-hour time dropdowns.

**Architecture:** A module-level `QUICK_BOOK_TEMPLATE` constant acts as a synthetic `SingleTemplate`. `useBooking` is extended with optional initial date/time overrides. `BookingModal` gains an `isQuickBook` prop that shows date + time fields instead of the week selector.

**Tech Stack:** React, TypeScript strict, Zustand, existing `BookingModal` + `useBooking` + `BookTemplateUseCase`

---

## Files

| Action | File | Change |
|--------|------|--------|
| Create | `src/ui/components/TimeSelect.tsx` | Quarter-hour dropdown (07:00–20:00) |
| Modify | `src/ui/hooks/useBooking.ts` | Add `UseBookingOptions` + `startTime`/`endTime` state |
| Modify | `src/ui/pages/BookingModal.tsx` | Add `isQuickBook` prop, date + time fields |
| Modify | `src/ui/pages/Home.tsx` | Add `QUICK_BOOK_TEMPLATE` constant + "+ Boeken" button |

---

### Task 1: TimeSelect component

**Files:**
- Create: `src/ui/components/TimeSelect.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/ui/components/TimeSelect.tsx
interface Props {
  label: string
  value: string        // HH:mm
  onChange: (v: string) => void
  minTime?: string     // HH:mm — options before this are disabled
}

function generateTimes(min = '07:00', max = '20:00'): string[] {
  const times: string[] = []
  const [minH, minM] = min.split(':').map(Number)
  const [maxH, maxM] = max.split(':').map(Number)
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
      <label className="text-xs uppercase tracking-widest text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
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
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/TimeSelect.tsx
git commit -m "feat: add TimeSelect quarter-hour dropdown component"
```

---

### Task 2: Extend useBooking with time/date overrides

**Files:**
- Modify: `src/ui/hooks/useBooking.ts`

- [ ] **Step 1: Add `UseBookingOptions` and override state**

Replace the top of `useBooking` — add the options parameter and new state for `startTime`, `endTime`, and a date-based initial value for `weekStartDate`:

```ts
// src/ui/hooks/useBooking.ts
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { Template } from '../../domain/entities/Template'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error'

export interface UseBookingOptions {
  initialDate?: string       // YYYY-MM-DD, overrides Monday calculation
  initialStartTime?: string  // HH:mm, overrides template.startTime
  initialEndTime?: string    // HH:mm, overrides template.endTime
}

export function useBooking(template: Template, options: UseBookingOptions = {}) {
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)
  const projects = useAppStore((s) => s.projects)
  const allHourTypes = useAppStore((s) => s.hourTypes)

  const [projectId, setProjectId] = useState(template.projectId ?? '')
  const [serviceId, setServiceId] = useState(template.serviceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(template.hourTypeId ?? '')
  const [note, setNote] = useState(template.defaultNote ?? '')
  const [startTime, setStartTime] = useState(options.initialStartTime ?? template.startTime)
  const [endTime, setEndTime] = useState(options.initialEndTime ?? template.endTime)
  const [weekStartDate, setWeekStartDate] = useState(() => {
    if (options.initialDate) return options.initialDate
    // Default to this Monday
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    today.setDate(today.getDate() + diff)
    return today.toISOString().split('T')[0]!
  })
  const [services, setServices] = useState<{ id: string; name: string; hourTypeIds: string[] }[]>([])
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filter hour types to those available on the selected service
  const selectedService = services.find((s) => s.id === serviceId)
  const hourTypes = selectedService
    ? allHourTypes.filter((ht) => selectedService.hourTypeIds.includes(ht.id))
    : allHourTypes

  const missingFields = [
    !projectId && 'project',
    !serviceId && 'dienst',
    !hourTypeId && 'urensoort',
  ].filter(Boolean)

  async function loadServices(pid: string) {
    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    if (!apiKey || !apiSecret) return
    const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    const svc = await repo.getServices(pid)
    setServices(svc)
  }

  async function handleProjectChange(pid: string) {
    setProjectId(pid)
    setServiceId('')
    setHourTypeId('')
    await loadServices(pid)
  }

  async function book() {
    if (!simplicateEmployeeId) return
    setStatus('loading')
    setErrorMessage(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { bookTemplate } = createUseCases(simplicateRepo)

      // For quick book, pass a modified template with overridden times
      const effectiveTemplate = { ...template, startTime, endTime }

      await bookTemplate.execute({
        template: effectiveTemplate,
        employeeId: simplicateEmployeeId,
        note,
        weekStartDate,
        overrides: { projectId, serviceId, hourTypeId },
      })
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Boeken mislukt')
    }
  }

  return {
    projectId, setProjectId: handleProjectChange,
    serviceId, setServiceId: (id: string) => {
      setServiceId(id)
      const svc = services.find((s) => s.id === id)
      if (svc && hourTypeId && !svc.hourTypeIds.includes(hourTypeId)) {
        setHourTypeId('')
      }
    },
    hourTypeId, setHourTypeId,
    note, setNote,
    startTime, setStartTime,
    endTime, setEndTime,
    weekStartDate, setWeekStartDate,
    services,
    status,
    errorMessage,
    missingFields,
    canBook: missingFields.length === 0,
    projects,
    hourTypes,
    book,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useBooking.ts
git commit -m "feat: extend useBooking with date/time overrides for quick book"
```

---

### Task 3: Update BookingModal with isQuickBook support

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Step 1: Rewrite BookingModal**

```tsx
// src/ui/pages/BookingModal.tsx
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

  if (booking.status === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#2d2d44] rounded-xl p-6 w-80 text-center flex flex-col gap-4">
          <div className="text-green-400 text-4xl">✓</div>
          <div className="text-white font-semibold">Uren geboekt!</div>
          <button onClick={onClose} className="bg-[#6c63ff] text-white py-2 rounded-lg text-sm font-medium">
            Sluiten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#2d2d44] rounded-xl p-6 w-96 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="text-white font-bold">{template.name}</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
        </div>

        {/* Quick book: date + time pickers */}
        {isQuickBook && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-gray-400">Datum</label>
              <input
                type="date"
                value={booking.weekStartDate}
                onChange={(e) => booking.setWeekStartDate(e.target.value)}
                className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <TimeSelect
                label="Van"
                value={booking.startTime}
                onChange={(v) => {
                  booking.setStartTime(v)
                  // If endTime is no longer after startTime, bump it one slot
                  if (booking.endTime <= v) {
                    const [h, m] = v.split(':').map(Number)
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

        {/* Week selector for recurring templates (not shown for quick book) */}
        {!isQuickBook && isRecurringTemplate(template) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-gray-400">Week</label>
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
                        ? 'bg-[#6c63ff] text-white'
                        : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
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
          <label className="text-xs uppercase tracking-widest text-gray-400">Toelichting</label>
          <input
            type="text"
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value)}
            placeholder="Optioneel"
            className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
          />
        </div>

        {booking.errorMessage && (
          <div className="bg-red-900/40 text-red-300 text-xs rounded-lg px-3 py-2">
            {booking.errorMessage}
          </div>
        )}

        <button
          onClick={booking.book}
          disabled={!booking.canBook || booking.status === 'loading'}
          className="bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
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
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "feat: add isQuickBook mode to BookingModal with date/time pickers"
```

---

### Task 4: Add QUICK_BOOK_TEMPLATE and "+ Boeken" button to Home

**Files:**
- Modify: `src/ui/pages/Home.tsx`

- [ ] **Step 1: Add constant and button**

Add `QUICK_BOOK_TEMPLATE` as a module-level constant and a "+ Boeken" button in the header. Also pass `isQuickBook` to `BookingModal` when the template is the quick book one:

```tsx
// src/ui/pages/Home.tsx
import { useState, useEffect } from 'react'
import { useTemplates } from '../hooks/useTemplates'
import { TemplateCard } from '../components/TemplateCard'
import { BookingModal } from './BookingModal'
import { SettingsPage } from './Settings/SettingsPage'
import { useAuth } from '../hooks/useAuth'
import { useSimplicateData } from '../hooks/useSimplicateData'
import { useAppStore } from '../../store/appStore'
import type { Template } from '../../domain/entities/Template'
import type { SingleTemplate } from '../../domain/entities/Template'

const QUICK_BOOK_TEMPLATE: SingleTemplate = {
  id: '__quick__',
  name: 'Vrij boeken',
  type: 'single',
  color: '#6c63ff',
  startTime: '09:00',
  endTime: '09:30',
}

export function HomePage() {
  const { templates, isLoading, reload } = useTemplates()
  const { logout } = useAuth()
  const user = useAppStore((s) => s.user)
  const projects = useAppStore((s) => s.projects)
  const { needsCredentials, isSyncing, syncError, sync } = useSimplicateData()
  const [bookingTemplate, setBookingTemplate] = useState<Template | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'templates' | 'account'>('templates')

  useEffect(() => {
    if (needsCredentials) {
      setSettingsTab('account')
      setShowSettings(true)
    }
  }, [needsCredentials])

  if (showSettings) {
    return (
      <SettingsPage
        initialTab={settingsTab}
        onBack={() => {
          setShowSettings(false)
          setSettingsTab('templates')
          void sync()
          void reload()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-widest">Uren schrijven</div>
          <div className="flex items-center gap-3">
            {isSyncing && (
              <div className="text-xs text-gray-500">Synchroniseren...</div>
            )}
            {syncError && !isSyncing && (
              <div className="text-xs text-red-400" title={syncError}>Sync mislukt</div>
            )}
            <button
              onClick={() => setBookingTemplate(QUICK_BOOK_TEMPLATE)}
              className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              + Boeken
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="text-gray-400 text-sm">Laden...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onBook={setBookingTemplate}
                onEdit={() => setShowSettings(true)}
              />
            ))}
            <button
              onClick={() => setShowSettings(true)}
              className="bg-[#2d2d44] border border-dashed border-gray-600 rounded-xl p-4 flex items-center justify-center text-gray-500 hover:text-gray-400 hover:border-gray-500 transition-colors text-sm"
            >
              + Template toevoegen
            </button>
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
        <span>Ingelogd als {user?.name}</span>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => { void sync() }}
            disabled={isSyncing}
            className="hover:text-gray-300 disabled:opacity-40"
            title={`${projects.length} projecten geladen`}
          >
            {isSyncing ? 'Synchroniseren...' : `↻ Sync${projects.length > 0 ? ` (${projects.length})` : ''}`}
          </button>
          <button onClick={() => { setSettingsTab('templates'); setShowSettings(true) }} className="hover:text-gray-300">⚙ Instellingen</button>
          <button onClick={logout} className="hover:text-gray-300">Uitloggen</button>
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
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Home.tsx
git commit -m "feat: add quick book button to Home header"
```
