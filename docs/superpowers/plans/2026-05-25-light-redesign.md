# Light Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark theme with a warm light design system: Inter font, Heroicons uniform, CSS design tokens, and restyled components across all screens.

**Architecture:** Pure visual layer swap — no logic, routing, or data changes. All colors/spacing move to CSS custom properties in `index.css`. React components keep their props and behaviour; only className/style strings change.

**Tech Stack:** Tailwind CSS v4, `@heroicons/react`, `lucide-react` (removed from two files), Inter via Google Fonts in `index.html`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `index.html` | Modify | Add Inter Google Fonts `<link>` |
| `src/index.css` | Modify | Add CSS custom properties (design tokens), reset `App.css` conflicts |
| `src/App.css` | Modify | Remove dark `:root`, keep only legacy resets that don't conflict |
| `src/ui/components/Sidebar.tsx` | Rewrite styling | Light sidebar, wordmark "U. / A", calendar icon + settings icon |
| `src/ui/pages/LoginPage.tsx` | Rewrite styling | Light card with wordmark, Google SVG button |
| `src/ui/components/WeekDayList.tsx` | Rewrite styling + swap icons | Light panel, Heroicons replacing Lucide, Nu-knop, progress bars |
| `src/ui/components/MonthPickerPopup.tsx` | Rewrite styling + swap icons | Light popup, Heroicons replacing Lucide |
| `src/ui/components/DayTimeline.tsx` | Rewrite CONFIDENCE_COLORS + topbar | New semantic light colours, legend strip, topbar |
| `src/ui/components/EvidencePanel.tsx` | Rewrite styling | Light evidence strip |
| `src/ui/pages/BookingModal.tsx` | Rewrite styling | Two-column light modal |
| `src/ui/pages/WeekPage.tsx` | Rewrite styling | Light app bg wrapper |
| `src/ui/pages/Settings/SettingsPage.tsx` | Rewrite styling | Light settings layout |
| `src/ui/pages/Settings/AccountSettings.tsx` | Rewrite styling | Light account rows |

---

## Task 1: Inter font + CSS design tokens

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Modify: `src/App.css`

- [ ] **Step 1: Add Inter to index.html**

Open `index.html`. In the `<head>`, before the existing `<link>` tags, add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Replace src/index.css**

Replace the entire content of `src/index.css` with:

```css
@import "tailwindcss";

:root {
  /* Backgrounds */
  --bg-app:    #f0efe9;
  --bg:        #f8f7f4;
  --surface:   #ffffff;

  /* Borders */
  --border:    #e7e5e4;

  /* Text */
  --text-primary:   #1c1917;
  --text-secondary: #57534e;
  --text-muted:     #78716c;
  --text-faint:     #a8a29e;

  /* Accent (indigo) */
  --accent:         #6366f1;
  --accent-hover:   #4f46e5;
  --accent-light:   #eef2ff;
  --accent-border:  #c7d2fe;

  /* Semantic */
  --success:        #16a34a;
  --success-light:  #f0fdf4;
  --warning:        #d97706;
  --warning-light:  #fffbeb;
  --danger:         #ef4444;
  --danger-light:   #fff1f2;

  /* Sidebar */
  --sidebar-w: 56px;

  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: var(--text-primary);
  background-color: var(--bg-app);
  -webkit-font-smoothing: antialiased;
}

*, *::before, *::after {
  box-sizing: border-box;
}
```

- [ ] **Step 3: Strip App.css of dark-mode overrides**

Replace the entire content of `src/App.css` with:

```css
/* Legacy resets — do not add dark-mode rules here */
a {
  font-weight: 500;
  color: var(--accent);
  text-decoration: inherit;
}
a:hover {
  color: var(--accent-hover);
}
input, button {
  font-family: inherit;
  outline: none;
}
```

- [ ] **Step 4: Verify app still launches**

```bash
npm run tauri dev
```

Expected: app opens with no console errors; background is now `#f0efe9` (warm off-white).

- [ ] **Step 5: Commit**

```bash
git add index.html src/index.css src/App.css
git commit -m "design: add Inter font and CSS design tokens"
```

---

## Task 2: Sidebar — wordmark + light theme

**Files:**
- Modify: `src/ui/components/Sidebar.tsx`

- [ ] **Step 1: Replace Sidebar.tsx content**

```tsx
import { CalendarDaysIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '../../store/appStore'

interface Props {
  onSettings: () => void
  activeTab?: 'week' | 'settings'
}

export function Sidebar({ onSettings, activeTab = 'week' }: Props) {
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center py-3 gap-1"
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Wordmark */}
      <div className="flex flex-col items-center mb-2" style={{ lineHeight: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          U<span style={{ color: 'var(--accent)' }}>.</span>
        </span>
        <span style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent)', marginTop: 2 }}>
          A
        </span>
      </div>

      {/* Week nav icon */}
      <button
        title="Week"
        onClick={() => {/* week is always active for now */}}
        className="flex items-center justify-center rounded-lg transition-colors"
        style={{
          width: 34, height: 34,
          background: activeTab === 'week' ? 'var(--accent-light)' : 'transparent',
          color: activeTab === 'week' ? 'var(--accent)' : 'var(--text-muted)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <CalendarDaysIcon style={{ width: 17, height: 17 }} strokeWidth={2} />
      </button>

      <div className="flex-1" />

      {/* Settings icon */}
      <button
        title="Instellingen"
        onClick={onSettings}
        className="flex items-center justify-center rounded-lg transition-colors"
        style={{
          width: 34, height: 34,
          background: activeTab === 'settings' ? 'var(--accent-light)' : 'transparent',
          color: activeTab === 'settings' ? 'var(--accent)' : 'var(--text-muted)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Cog6ToothIcon style={{ width: 17, height: 17 }} strokeWidth={2} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/Sidebar.tsx
git commit -m "design: sidebar — wordmark + light theme"
```

---

## Task 3: LoginPage — light card with wordmark

**Files:**
- Modify: `src/ui/pages/LoginPage.tsx`

- [ ] **Step 1: Replace LoginPage.tsx content**

```tsx
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'

export function LoginPage() {
  const { loginWithGoogle } = useAuth()
  const isLoading = useAppStore((s) => s.isLoading)
  const error = useAppStore((s) => s.error)

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-app)' }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '36px 32px',
          width: 320,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        {/* Wordmark */}
        <div className="flex flex-col items-center mb-7">
          <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -1, lineHeight: 1 }}>
            Uren<span style={{ color: 'var(--accent)' }}>.</span>
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)', marginTop: 4 }}>
            Assistent
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', width: 'calc(100% + 64px)', marginLeft: -32, marginBottom: 24 }} />

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Log in met je Google-account om je uren bij te houden en te verwerken met AI.
        </p>

        {error && (
          <div
            className="w-full text-center mb-3"
            style={{
              fontSize: 11,
              color: 'var(--danger)',
              background: '#fff1f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '8px 16px',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 transition-colors"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontFamily: 'inherit',
          }}
        >
          {/* Google G SVG */}
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoading ? 'Bezig met inloggen…' : 'Inloggen met Google'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/LoginPage.tsx
git commit -m "design: login page — light card with wordmark"
```

---

## Task 4: WeekDayList — light panel, Heroicons, Nu-knop

**Files:**
- Modify: `src/ui/components/WeekDayList.tsx`

The component is ~289 lines. The goal is to:
1. Replace all dark Tailwind classes with CSS-var-based inline styles or Tailwind light utilities.
2. Replace `Trash2` and `CalendarDays` from `lucide-react` with `TrashIcon` and `CalendarDaysIcon` from `@heroicons/react/24/outline`.
3. Keep all props, event handlers, and logic untouched.
4. Colour the progress bar by hours: `>= TARGET_HOURS` → `var(--success)`, `> 0` → `var(--warning)`, else transparent.

- [ ] **Step 1: Read the current full file**

Read `src/ui/components/WeekDayList.tsx` entirely (offset=0, limit=400).

- [ ] **Step 2: Replace WeekDayList.tsx**

Replace the file with the following. All logic (handlers, conditions, ConfirmDialog, MonthPickerPopup calls) is preserved; only styling changes.

```tsx
import { useState } from 'react'
import { TrashIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import { ConfirmDialog } from './ConfirmDialog'
import { MonthPickerPopup } from './MonthPickerPopup'

const DAY_LABELS: Record<string, string> = {
  '1': 'MA', '2': 'DI', '3': 'WO', '4': 'DO', '5': 'VR',
}

export type DayProcessingState = 'idle' | 'classifying' | 'done' | 'error'

interface Props {
  weekDays: string[]
  selectedDate: string
  hoursForDate: (date: string) => number
  onSelectDate: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  weekLabel: string
  conceptCountForDate?: (date: string) => number
  onProcessWeek?: () => void
  onUploadCsv?: () => void
  processingStateForDate?: (date: string) => DayProcessingState
  isProcessingWeek?: boolean
  llmBlockCountForDate?: (date: string) => number
  onClearDayBlocks?: (date: string) => Promise<void>
  isClearingDay?: boolean
  clearError?: string | null
  onClearWeekBlocks?: () => Promise<void>
  isClearingWeek?: boolean
  clearWeekError?: string | null
  totalLlmBlockCount?: number
  isCurrentWeek?: boolean
  onGoToCurrentWeek?: () => void
  onGoToDate?: (date: string) => void
}

const TARGET_HOURS = 8

function ProgressBar({ hours }: { hours: number }) {
  const pct = Math.min(100, (hours / TARGET_HOURS) * 100)
  const color = hours >= TARGET_HOURS
    ? 'var(--success)'
    : hours > 0
      ? 'var(--warning)'
      : 'transparent'
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 100, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', borderRadius: 100, transition: 'width 0.3s', width: `${pct}%`, background: color }} />
    </div>
  )
}

// Button helpers
const iconBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
  flexShrink: 0, padding: 0, fontFamily: 'inherit', ...extra,
})

export function WeekDayList({
  weekDays,
  selectedDate,
  hoursForDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  weekLabel,
  conceptCountForDate,
  onProcessWeek,
  onUploadCsv,
  processingStateForDate,
  isProcessingWeek,
  llmBlockCountForDate,
  onClearDayBlocks,
  isClearingDay,
  clearError,
  onClearWeekBlocks,
  isClearingWeek,
  clearWeekError,
  totalLlmBlockCount,
  isCurrentWeek,
  onGoToCurrentWeek,
  onGoToDate,
}: Props) {
  const [confirmClearDate, setConfirmClearDate] = useState<string | null>(null)
  const [confirmClearWeek, setConfirmClearWeek] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  // Derive week range label from weekDays
  const rangeLabel = weekDays.length >= 2
    ? (() => {
        const fmt = (d: string) => {
          const dt = new Date(d)
          return `${dt.getDate()} ${dt.toLocaleString('nl-NL', { month: 'short' })}`
        }
        return `${fmt(weekDays[0]!)}–${fmt(weekDays[weekDays.length - 1]!)}`
      })()
    : ''

  // Week total hours
  const totalHours = weekDays.reduce((s, d) => s + hoursForDate(d), 0)
  const weekPct = Math.min(100, (totalHours / 40) * 100)

  return (
    <div
      style={{
        width: 214, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Week title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{weekLabel}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{rangeLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <button style={iconBtn()} onClick={onPrevWeek} title="Vorige week">‹</button>
            <button style={iconBtn()} onClick={onNextWeek} title="Volgende week">›</button>
          </div>
        </div>

        {/* Nu-knop + maandkiezer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 7 }}>
          {!isCurrentWeek && (
            <button
              onClick={onGoToCurrentWeek}
              style={{
                background: 'var(--accent-light)', color: 'var(--accent)',
                border: '1px solid var(--accent-border)', fontSize: 11, fontWeight: 700,
                padding: '4px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Nu
            </button>
          )}
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...iconBtn(), border: '1px solid transparent' }}
              onClick={() => setShowMonthPicker((v) => !v)}
              title="Kies datum"
            >
              <CalendarDaysIcon style={{ width: 13, height: 13 }} strokeWidth={2} />
            </button>
            {showMonthPicker && (
              <div style={{ position: 'absolute', top: 30, right: 0, zIndex: 50 }}>
                <MonthPickerPopup
                  selectedDate={selectedDate}
                  onSelectDate={(d) => { onGoToDate?.(d); setShowMonthPicker(false) }}
                  onClose={() => setShowMonthPicker(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Week progress */}
        <div style={{ marginTop: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Weekvoortgang
            </span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>
              {totalHours.toFixed(1).replace('.', ',')}/40u
            </span>
          </div>
          <div style={{ height: 4, background: '#f0ede8', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 100, width: `${weekPct}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Day list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {weekDays.map((date) => {
          const isSelected = date === selectedDate
          const hours = hoursForDate(date)
          const dayOfWeek = new Date(date).getDay().toString()
          const label = DAY_LABELS[dayOfWeek] ?? '??'
          const dt = new Date(date)
          const dateLabel = `${dt.getDate()} ${dt.toLocaleString('nl-NL', { month: 'short' })}`
          const processingState = processingStateForDate?.(date) ?? 'idle'
          const llmCount = llmBlockCountForDate?.(date) ?? 0

          return (
            <div
              key={date}
              onClick={() => onSelectDate(date)}
              style={{
                padding: isSelected ? '9px 14px 9px 11px' : '9px 14px',
                borderBottom: '1px solid var(--border)',
                borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                background: isSelected ? 'var(--accent-light)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dateLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ flex: 1 }}>
                  <ProgressBar hours={hours} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {hours > 0 ? `${hours.toFixed(1).replace('.', ',')}u` : '–'}
                  {hours >= TARGET_HOURS ? ' ✓' : ''}
                </span>
                {llmCount > 0 && onClearDayBlocks && (
                  <button
                    title={`Wis ${llmCount} LLM-blok${llmCount !== 1 ? 'ken' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setConfirmClearDate(date) }}
                    style={{ ...iconBtn(), color: 'var(--danger)', borderColor: '#fecaca' }}
                  >
                    <TrashIcon style={{ width: 11, height: 11 }} strokeWidth={2} />
                  </button>
                )}
              </div>
              {processingState === 'classifying' && (
                <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 3 }}>Verwerken…</div>
              )}
              {processingState === 'error' && (
                <div style={{ fontSize: 9, color: 'var(--danger)', marginTop: 3 }}>Fout bij verwerken</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {(clearError || clearWeekError) && (
          <div style={{ fontSize: 10, color: 'var(--danger)' }}>{clearError ?? clearWeekError}</div>
        )}
        {totalLlmBlockCount != null && totalLlmBlockCount > 0 && onClearWeekBlocks && (
          <button
            onClick={() => setConfirmClearWeek(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, border: '1px solid #fecaca', borderRadius: 7, padding: '5px 10px',
              fontSize: 11, fontWeight: 600, color: 'var(--danger)', background: '#fff1f2',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <TrashIcon style={{ width: 12, height: 12 }} strokeWidth={2} />
            Wis week ({totalLlmBlockCount})
          </button>
        )}
        {onProcessWeek && (
          <button
            onClick={onProcessWeek}
            disabled={isProcessingWeek}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, background: 'var(--accent)', color: 'white', border: 'none',
              borderRadius: 7, padding: '7px 12px', fontSize: 11, fontWeight: 600,
              cursor: isProcessingWeek ? 'not-allowed' : 'pointer', opacity: isProcessingWeek ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {isProcessingWeek ? 'Bezig…' : 'Verwerk week'}
          </button>
        )}
        {onUploadCsv && (
          <button
            onClick={onUploadCsv}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            CSV uploaden
          </button>
        )}
      </div>

      {/* Confirm: clear day */}
      {confirmClearDate && (
        <ConfirmDialog
          title="LLM-blokken wissen"
          message={`Wis alle LLM-blokken voor ${confirmClearDate}?`}
          confirmLabel="Wissen"
          onConfirm={async () => { await onClearDayBlocks?.(confirmClearDate); setConfirmClearDate(null) }}
          onCancel={() => setConfirmClearDate(null)}
          isLoading={isClearingDay}
        />
      )}

      {/* Confirm: clear week */}
      {confirmClearWeek && (
        <ConfirmDialog
          title="Week wissen"
          message="Wis alle LLM-blokken voor deze week?"
          confirmLabel="Wissen"
          onConfirm={async () => { await onClearWeekBlocks?.(); setConfirmClearWeek(false) }}
          onCancel={() => setConfirmClearWeek(false)}
          isLoading={isClearingWeek}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run unit tests**

```bash
npm run test
```

Expected: all tests pass (WeekDayList has no unit tests; no regressions expected).

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/WeekDayList.tsx
git commit -m "design: WeekDayList — light panel, Heroicons, Nu-knop"
```

---

## Task 5: MonthPickerPopup — light + Heroicons

**Files:**
- Modify: `src/ui/components/MonthPickerPopup.tsx`

- [ ] **Step 1: Read current file**

Read `src/ui/components/MonthPickerPopup.tsx` entirely.

- [ ] **Step 2: Replace lucide imports with Heroicons**

Find the import line:
```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
```
Replace with:
```tsx
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
```

Then replace every usage of `<ChevronLeft` → `<ChevronLeftIcon` and `<ChevronRight` → `<ChevronRightIcon`.

- [ ] **Step 3: Replace dark classes with light styles**

The popup currently uses dark Tailwind classes (bg-[#...], text-[#...]).
Replace the container div className with inline styles using CSS vars:

```tsx
// Container
<div
  style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 9,
    boxShadow: '0 4px 16px rgba(0,0,0,0.09)',
    padding: 12,
    width: 210,
  }}
>
```

Apply the following mapping for other elements:

| Old dark class pattern | New style |
|---|---|
| `bg-[#1c...]` / `bg-[#25...]` | `background: 'var(--surface)'` |
| `text-[#e8e2d9]` / `text-[#c4...` | `color: 'var(--text-primary)'` |
| `text-[#7a7268]` | `color: 'var(--text-muted)'` |
| `border-[#2e2a26]` | `border: '1px solid var(--border)'` |
| `hover:bg-[#2a...]` | `className="hover:bg-[#f8f7f4]"` or inline hover via CSS class |
| Selected day | `background: 'var(--accent)', color: 'white'` |
| Today | `background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 700` |
| Has-hours dot | `background: 'var(--accent)'` |

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/MonthPickerPopup.tsx
git commit -m "design: MonthPickerPopup — light theme + Heroicons"
```

---

## Task 6: DayTimeline — CONFIDENCE_COLORS + topbar

**Files:**
- Modify: `src/ui/components/DayTimeline.tsx`

- [ ] **Step 1: Replace CONFIDENCE_COLORS and WARN_STYLE**

Find this block (lines ~23-31):
```tsx
const CONFIDENCE_COLORS: Record<1 | 2 | 3 | 4 | 5, { bg: string; border: string; sub: string; badge: string }> = {
  5: { bg: 'bg-[#1a2a1a]', border: 'border border-dashed border-[#5a8a6a]', sub: 'text-[#5a8a6a]', badge: 'bg-[#1a3a1a] text-[#5a8a6a]' },
  ...
}
const WARN_STYLE = { bg: 'bg-[#2a2010]', border: '...', sub: '...', badge: '...' }
```

Replace with:
```tsx
const CONFIDENCE_COLORS: Record<1 | 2 | 3 | 4 | 5, { bg: string; borderStyle: string; borderColor: string; borderLeft: string; titleColor: string; subColor: string; badgeBg: string; badgeColor: string }> = {
  5: { bg: '#f0fdf4', borderStyle: 'solid',  borderColor: '#86efac', borderLeft: '#16a34a', titleColor: '#14532d', subColor: '#16a34a', badgeBg: '#dcfce7', badgeColor: '#16a34a' },
  4: { bg: '#f0fdf4', borderStyle: 'solid',  borderColor: '#86efac', borderLeft: '#16a34a', titleColor: '#14532d', subColor: '#16a34a', badgeBg: '#dcfce7', badgeColor: '#16a34a' },
  3: { bg: '#fffbeb', borderStyle: 'solid',  borderColor: '#fcd34d', borderLeft: '#d97706', titleColor: '#78350f', subColor: '#d97706', badgeBg: '#fef3c7', badgeColor: '#d97706' },
  2: { bg: '#fff1f2', borderStyle: 'dashed', borderColor: '#fca5a5', borderLeft: '#ef4444', titleColor: '#7f1d1d', subColor: '#ef4444', badgeBg: '#fee2e2', badgeColor: '#ef4444' },
  1: { bg: '#fff1f2', borderStyle: 'dashed', borderColor: '#fca5a5', borderLeft: '#ef4444', titleColor: '#7f1d1d', subColor: '#ef4444', badgeBg: '#fee2e2', badgeColor: '#ef4444' },
}

const WARN_STYLE = { bg: '#fffbeb', borderStyle: 'dashed' as const, borderColor: '#fcd34d', borderLeft: '#d97706', titleColor: '#78350f', subColor: '#d97706', badgeBg: '#fef3c7', badgeColor: '#d97706' }
```

- [ ] **Step 2: Update blockStyle return type**

The `blockStyle` function returns `CONFIDENCE_COLORS[block.confidence]`. Its return type now changes. Verify the function signature compiles without adding a type annotation conflict. No logic change needed.

- [ ] **Step 3: Update concept block rendering to use new style object**

Search for places in `DayTimeline.tsx` where the block style is applied to JSX. Currently blocks use `cs.bg`, `cs.border`, `cs.sub`, `cs.badge` as Tailwind classes.

Find pattern like:
```tsx
className={`... ${cs.bg} ${cs.border} ...`}
```

Replace with inline styles. The block container `<div>` should use:
```tsx
style={{
  background: cs.bg,
  border: `1.5px ${cs.borderStyle} ${cs.borderColor}`,
  borderLeft: `3px solid ${cs.borderLeft}`,
}}
```

Title text:
```tsx
style={{ color: cs.titleColor, fontSize: 10, fontWeight: 700 }}
```

Subtitle text:
```tsx
style={{ color: cs.subColor, fontSize: 9 }}
```

Confidence badge:
```tsx
style={{ background: cs.badgeBg, color: cs.badgeColor, fontSize: 8, fontWeight: 700, borderRadius: 3, padding: '1px 4px', position: 'absolute', top: 3, right: 4 }}
```

- [ ] **Step 4: Update topbar / header area**

The topbar currently has dark bg. Find the topbar div and replace dark classes with:
```tsx
style={{
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  flexShrink: 0, background: 'var(--surface)',
}}
```

- [ ] **Step 5: Add legend strip to topbar**

In the right side of the topbar, add the colour legend (after the existing heading):
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1' }} />
    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>geboekt</span>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f0fdf4', borderLeft: '2px solid #16a34a' }} />
    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>hoog</span>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fffbeb', borderLeft: '2px solid #d97706' }} />
    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>midden</span>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fff1f2', borderLeft: '2px dashed #ef4444' }} />
    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>laag</span>
  </div>
  {/* existing "Verwerk dag" button stays here */}
</div>
```

- [ ] **Step 6: Update booked entry blocks**

Booked `HourEntry` blocks currently use dark indigo classes. Find where booked entries render and apply:
```tsx
style={{
  background: '#6366f1',
  borderRadius: 5,
  // existing position/size inline styles preserved
}}
```

Title inside booked block: `style={{ color: 'rgba(255,255,255,.95)', fontSize: 10, fontWeight: 700 }}`

- [ ] **Step 7: Update grid background and hour lines**

The outer scroll container should have `background: 'var(--bg-app)'`. Hour lines:
```tsx
// Full hour line
style={{ position: 'absolute', left: 0, right: 0, borderTop: '1px solid #f0ede8', pointerEvents: 'none' }}
// Half-hour line
style={{ position: 'absolute', left: 0, right: 0, borderTop: '1px dashed #f5f2ee', pointerEvents: 'none' }}
```

Now-line stays red: `style={{ position: 'absolute', left: 0, right: 0, borderTop: '2px solid #ef4444', zIndex: 20, pointerEvents: 'none' }}`.

- [ ] **Step 8: Run unit tests**

```bash
npm run test
```

Expected: DayTimeline.helpers tests still pass.

- [ ] **Step 9: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/ui/components/DayTimeline.tsx
git commit -m "design: DayTimeline — semantic light confidence colours + topbar legend"
```

---

## Task 7: EvidencePanel — light theme

**Files:**
- Modify: `src/ui/components/EvidencePanel.tsx`

- [ ] **Step 1: Read current EvidencePanel.tsx**

Read `src/ui/components/EvidencePanel.tsx` entirely.

- [ ] **Step 2: Replace all dark bg/text classes with light CSS-var styles**

Key mappings:
- Container: `background: 'var(--bg)', borderLeft: '1px solid var(--border)'`
- Section header label: `fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)'`
- Each evidence item row: `display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 6`
- Icon cell: `width: 22, height: 22, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700`
  - Agenda icon: `background: '#f0fdf4', color: '#16a34a'`
  - GitHub icon: `background: '#fff7ed', color: '#ea580c'`
  - Linear icon: `background: '#f5f3ff', color: '#7c3aed'`
  - URL icon: `background: 'var(--accent-light)', color: 'var(--accent)'`
- Item title: `fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'`
- Item subtitle: `fontSize: 9, color: 'var(--text-muted)', marginTop: 1`
- AI summary card: `margin: 7, padding: '8px 10px', background: 'var(--surface)', borderRadius: 7, border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)'`
  - Label: `fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 4`
  - Text: `fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic'`

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/EvidencePanel.tsx
git commit -m "design: EvidencePanel — light theme"
```

---

## Task 8: BookingModal — two-column light modal

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Step 1: Read current BookingModal.tsx**

Read `src/ui/pages/BookingModal.tsx` entirely.

- [ ] **Step 2: Replace overlay + modal container**

Backdrop:
```tsx
<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(1px)', zIndex: 40 }} />
```

Modal box:
```tsx
<div
  style={{
    position: 'fixed', inset: 0, zIndex: 50,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24,
  }}
>
  <div
    style={{
      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)', width: 660, maxHeight: 520,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}
  >
```

- [ ] **Step 3: Modal header**

```tsx
// Header
<div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
  <div>
    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
      {/* date, time, duration, confidence badge — use text-secondary / text-muted */}
    </div>
  </div>
  {/* Close X button */}
</div>
```

- [ ] **Step 4: Modal body — two columns**

```tsx
<div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
  {/* Form column */}
  <div style={{ width: 264, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
    {/* form fields */}
  </div>
  {/* Evidence column — reuses EvidencePanel or same pattern */}
  <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
    {/* evidence items same styling as Task 7 */}
  </div>
</div>
```

- [ ] **Step 5: Form field labels**

Each field label:
```tsx
<div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 3 }}>
  Tijd
</div>
```

- [ ] **Step 6: Inputs and selects**

Input/select wrapper:
```tsx
style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontFamily: 'inherit', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
```

- [ ] **Step 7: Footer buttons**

Cancel:
```tsx
style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
```

Save:
```tsx
style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
```

- [ ] **Step 8: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 9: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "design: BookingModal — two-column light modal"
```

---

## Task 9: WeekPage + Settings — light wrappers

**Files:**
- Modify: `src/ui/pages/WeekPage.tsx`
- Modify: `src/ui/pages/Settings/SettingsPage.tsx`
- Modify: `src/ui/pages/Settings/AccountSettings.tsx`

- [ ] **Step 1: WeekPage — replace dark bg wrapper**

Find the outer wrapper div in `WeekPage.tsx`. Replace its dark background with:
```tsx
style={{ display: 'flex', height: '100vh', background: 'var(--bg-app)' }}
```

Remove any remaining `bg-[#1c1917]` or similar dark classes.

- [ ] **Step 2: SettingsPage — light layout**

In `SettingsPage.tsx`, replace:
- Root container background: `background: 'var(--bg-app)'`
- `<h1>` style: `fontSize: 17, fontWeight: 800, marginBottom: 18`
- Section cards: `background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14`
- Section header: `padding: '8px 14px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'var(--bg)', borderBottom: '1px solid var(--border)'`
- Row: `padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10`
- Row title: `fontSize: 12, fontWeight: 600`
- Row subtitle: `fontSize: 10, color: 'var(--text-muted)', marginTop: 1`

- [ ] **Step 3: AccountSettings — light rows**

Same pattern as SettingsPage rows. Status dot:
- Connected: `width: 7, height: 7, borderRadius: '50%', background: 'var(--success)'`
- Disconnected: `width: 7, height: 7, borderRadius: '50%', background: 'var(--text-faint)'`

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Run all tests**

```bash
npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/pages/WeekPage.tsx src/ui/pages/Settings/SettingsPage.tsx src/ui/pages/Settings/AccountSettings.tsx
git commit -m "design: WeekPage + Settings — light wrappers"
```

---

## Task 10: Final verification

- [ ] **Step 1: Full typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 2: All unit tests pass**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: zero errors or only pre-existing warnings.

- [ ] **Step 4: Visual smoke test**

```bash
npm run tauri dev
```

Verify:
- Login screen: light card, wordmark "Uren. / ASSISTENT", Google button
- Sidebar: white background, "U. / A" wordmark, icons visible
- Week panel: light, Nu-knop visible when not current week, month picker opens
- Timeline: confidence-coloured blocks (green/amber/red), indigo booked blocks, colour legend in topbar
- Evidence strip: light background, colour-coded icons
- Booking modal: two columns, light form left, evidence right
- Settings: light cards with section headers

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "design: complete light redesign — Inter, Heroicons, CSS tokens"
```
