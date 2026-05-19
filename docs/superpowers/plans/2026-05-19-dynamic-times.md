# Dynamic Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `startTime`/`endTime` optional on templates so users can pick times at booking time via `TimeSelect` dropdowns.

**Architecture:** `startTime`/`endTime` become `string | undefined` on `BaseTemplate`. The use case gains a guard. `useBooking` falls back to `'09:00'`/`'09:30'`. `BookingModal` shows time pickers whenever either time is absent. `TemplateForm` gets a "Dynamisch" toggle per time field.

**Tech Stack:** TypeScript strict mode (`exactOptionalPropertyTypes`), React 18, Vitest, existing `TimeSelect` component

---

## Files

| Action | File | Change |
|--------|------|--------|
| Modify | `src/domain/entities/Template.ts` | `startTime?`/`endTime?` optional |
| Modify | `src/domain/usecases/BookTemplateUseCase.ts` | Guard for missing times |
| Modify | `src/ui/hooks/useBooking.ts` | Fallback `?? '09:00'`/`?? '09:30'` |
| Modify | `src/ui/pages/BookingModal.tsx` | `showTimePickers` condition |
| Modify | `src/ui/pages/Settings/TemplateForm.tsx` | Dynamisch toggle per time field |

---

### Task 1: Make times optional in domain entity

**Files:**
- Modify: `src/domain/entities/Template.ts`

- [ ] **Step 1: Update `BaseTemplate`**

Open `src/domain/entities/Template.ts`. Change lines 13–14:

```ts
// Before:
startTime: string // HH:mm
endTime: string   // HH:mm

// After:
startTime?: string  // HH:mm — undefined = user picks at booking time
endTime?: string    // HH:mm — undefined = user picks at booking time
```

Full file after change:

```ts
export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type TemplateType = 'recurring' | 'single' | 'weekly-block'

export interface BaseTemplate {
  id: string
  name: string
  type: TemplateType
  color: string
  projectId?: string
  serviceId?: string
  hourTypeId?: string
  defaultNote?: string
  startTime?: string  // HH:mm — undefined = user picks at booking time
  endTime?: string    // HH:mm — undefined = user picks at booking time
}

export interface RecurringTemplate extends BaseTemplate {
  type: 'recurring'
  days: Day[]
}

export interface SingleTemplate extends BaseTemplate {
  type: 'single'
}

export interface WeeklyBlockTemplate extends BaseTemplate {
  type: 'weekly-block'
  day: Day
}

export type Template = RecurringTemplate | SingleTemplate | WeeklyBlockTemplate

export function isRecurringTemplate(t: Template): t is RecurringTemplate {
  return t.type === 'recurring'
}

export function isSingleTemplate(t: Template): t is SingleTemplate {
  return t.type === 'single'
}

export function isWeeklyBlockTemplate(t: Template): t is WeeklyBlockTemplate {
  return t.type === 'weekly-block'
}
```

- [ ] **Step 2: Run typecheck — expect errors**

```bash
npm run typecheck 2>&1 | head -40
```

Expected: TypeScript errors in `BookTemplateUseCase.ts`, `useBooking.ts`, possibly `BookingModal.tsx`. These will be fixed in subsequent tasks.

- [ ] **Step 3: Commit domain change only**

```bash
git add src/domain/entities/Template.ts
git commit -m "feat: make startTime/endTime optional on BaseTemplate"
```

---

### Task 2: Guard missing times in BookTemplateUseCase

**Files:**
- Modify: `src/domain/usecases/BookTemplateUseCase.ts`

- [ ] **Step 1: Add time guard and fix type errors**

Replace the full file with:

```ts
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { Template } from '../entities/Template'
import type { HourEntry } from '../entities/HourEntry'
import { isRecurringTemplate, isSingleTemplate, isWeeklyBlockTemplate } from '../entities/Template'

const DAY_OFFSETS: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]!
}

function hoursFromTimes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return ((eh! * 60 + em!) - (sh! * 60 + sm!)) / 60
}

interface BookTemplateInput {
  template: Template
  employeeId: string
  note: string
  weekStartDate: string // YYYY-MM-DD, always a Monday or selected date
  overrides?: {
    projectId?: string
    serviceId?: string
    hourTypeId?: string
  }
}

export class BookTemplateUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(input: BookTemplateInput): Promise<void> {
    const { template, employeeId, note, weekStartDate, overrides = {} } = input

    const projectId = overrides.projectId ?? template.projectId
    const serviceId = overrides.serviceId ?? template.serviceId
    const hourTypeId = overrides.hourTypeId ?? template.hourTypeId
    const startTime = template.startTime
    const endTime = template.endTime

    const missing: string[] = []
    if (!projectId) missing.push('projectId')
    if (!serviceId) missing.push('serviceId')
    if (!hourTypeId) missing.push('hourTypeId')
    if (!startTime) missing.push('startTime')
    if (!endTime) missing.push('endTime')
    if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`)

    const baseEntry = {
      employeeId,
      projectId: projectId!,
      projectServiceId: serviceId!,
      hourTypeId: hourTypeId!,
      hours: hoursFromTimes(startTime!, endTime!),
      startTime: startTime!,
      endTime: endTime!,
      note,
    }

    let entries: HourEntry[] = []

    if (isRecurringTemplate(template)) {
      entries = template.days.map((day) => ({
        ...baseEntry,
        startDate: addDays(weekStartDate, DAY_OFFSETS[day]!),
      }))
    } else if (isSingleTemplate(template)) {
      entries = [{ ...baseEntry, startDate: weekStartDate }]
    } else if (isWeeklyBlockTemplate(template)) {
      entries = [{ ...baseEntry, startDate: addDays(weekStartDate, DAY_OFFSETS[template.day]!) }]
    } else {
      const _exhaustive: never = template
      throw new Error(`Unknown template type: ${(_exhaustive as { type: string }).type}`)
    }

    await this.simplicateRepo.bookHours(entries)
  }
}
```

- [ ] **Step 2: Run typecheck — expect fewer errors**

```bash
npm run typecheck 2>&1 | grep BookTemplateUseCase
```

Expected: no errors mentioning `BookTemplateUseCase.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/domain/usecases/BookTemplateUseCase.ts
git commit -m "feat: guard missing startTime/endTime in BookTemplateUseCase"
```

---

### Task 3: Fix useBooking fallbacks

**Files:**
- Modify: `src/ui/hooks/useBooking.ts`

- [ ] **Step 1: Add fallback defaults to useState**

In `src/ui/hooks/useBooking.ts`, find these two lines (around line 26–27):

```ts
const [startTime, setStartTime] = useState<string>(options.initialStartTime ?? template.startTime)
const [endTime, setEndTime] = useState<string>(options.initialEndTime ?? template.endTime)
```

Change them to:

```ts
const [startTime, setStartTime] = useState<string>(
  options.initialStartTime ?? template.startTime ?? '09:00'
)
const [endTime, setEndTime] = useState<string>(
  options.initialEndTime ?? template.endTime ?? '09:30'
)
```

- [ ] **Step 2: Run typecheck — no errors in useBooking**

```bash
npm run typecheck 2>&1 | grep useBooking
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useBooking.ts
git commit -m "feat: fallback to 09:00/09:30 when template times are absent"
```

---

### Task 4: Show time pickers in BookingModal when times are absent

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Step 1: Replace `isQuickBook` condition with `showTimePickers`**

In `src/ui/pages/BookingModal.tsx`, find the line inside the component body that reads:

```tsx
{isQuickBook && (
```

Just before that JSX block (after the `booking` variable is declared), add:

```tsx
const showTimePickers = isQuickBook || !template.startTime || !template.endTime
```

Then replace every occurrence of `isQuickBook &&` and `!isQuickBook &&` in the JSX:

- `{isQuickBook && (` → `{showTimePickers && (`
- `{!isQuickBook && isRecurringTemplate(template) && (` → `{!showTimePickers && isRecurringTemplate(template) && (`

The `isQuickBook` prop itself and its use in `useBooking(template, isQuickBook ? ... : {})` stays unchanged — it controls the initial date/time values, not the visibility.

Full file after change:

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

        {/* Date + time pickers: shown for quick book or when template has no fixed times */}
        {showTimePickers && (
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

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck 2>&1 | grep BookingModal
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "feat: show time pickers in BookingModal when template times are absent"
```

---

### Task 5: Dynamisch toggle in TemplateForm

**Files:**
- Modify: `src/ui/pages/Settings/TemplateForm.tsx`

- [ ] **Step 1: Replace the time section in TemplateForm**

In `src/ui/pages/Settings/TemplateForm.tsx`, the current state initializations for `startTime`/`endTime` (around lines 32–33) are:

```ts
const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00')
const [endTime, setEndTime] = useState(initial?.endTime ?? '09:30')
```

Replace them with:

```ts
const [startTime, setStartTime] = useState<string | undefined>(initial?.startTime)
const [endTime, setEndTime] = useState<string | undefined>(initial?.endTime)
```

Then find the time fields section in the JSX (around lines 148–159):

```tsx
<div className="flex gap-3">
  <div className="flex-1 flex flex-col gap-1">
    <label className="text-xs uppercase tracking-widest text-gray-400">Starttijd</label>
    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
      className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none" />
  </div>
  <div className="flex-1 flex flex-col gap-1">
    <label className="text-xs uppercase tracking-widest text-gray-400">Eindtijd</label>
    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
      className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none" />
  </div>
</div>
```

Replace it with:

```tsx
<div className="flex gap-3">
  <div className="flex-1 flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <label className="text-xs uppercase tracking-widest text-gray-400">Starttijd</label>
      <button
        type="button"
        onClick={() => setStartTime(startTime !== undefined ? undefined : '09:00')}
        className={`text-xs px-2 py-0.5 rounded transition-colors ${
          startTime === undefined
            ? 'bg-[#6c63ff] text-white'
            : 'bg-[#1a1a2e] text-gray-500 hover:text-gray-300'
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
        className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
      />
    ) : (
      <div className="bg-[#1a1a2e] text-gray-500 text-sm rounded-lg px-3 py-2 border border-gray-700 border-dashed">
        Kiest gebruiker bij boeking
      </div>
    )}
  </div>

  <div className="flex-1 flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <label className="text-xs uppercase tracking-widest text-gray-400">Eindtijd</label>
      <button
        type="button"
        onClick={() => setEndTime(endTime !== undefined ? undefined : '09:30')}
        className={`text-xs px-2 py-0.5 rounded transition-colors ${
          endTime === undefined
            ? 'bg-[#6c63ff] text-white'
            : 'bg-[#1a1a2e] text-gray-500 hover:text-gray-300'
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
        className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
      />
    ) : (
      <div className="bg-[#1a1a2e] text-gray-500 text-sm rounded-lg px-3 py-2 border border-gray-700 border-dashed">
        Kiest gebruiker bij boeking
      </div>
    )}
  </div>
</div>
```

Also update `handleSave` — the `base` object currently always sets `startTime`/`endTime`. Since they are now `string | undefined`, the existing `exactOptionalPropertyTypes` constraint means you must conditionally spread them. Replace the `base` object in `handleSave`:

```ts
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
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck 2>&1
```

Expected: no errors at all.

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Settings/TemplateForm.tsx
git commit -m "feat: add Dynamisch toggle for start/end time in TemplateForm"
```
