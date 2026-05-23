# EvidencePanel Calendar Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `overlappingMeetings` rendering to `EvidencePanel` so the booking modal shows both browsing history and overlapping calendar events in a unified context block.

**Architecture:** One new prop (`meetings?: CalendarEvent[]`) on `EvidencePanel`. When meetings are present the header becomes "Context" and a new agenda section is inserted between the URL list and the LLM summary, separated by a divider. No domain/infrastructure changes.

**Tech Stack:** React 18, TypeScript strict (`exactOptionalPropertyTypes: true`), Tailwind CSS, Vitest + Testing Library

---

### Task 1: Add failing tests for agenda rendering

**Files:**
- Modify: `src/ui/components/EvidencePanel.test.tsx`

- [ ] **Step 1: Add tests**

Append these tests inside the existing `describe('EvidencePanel', ...)` block:

```tsx
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'

// helper
function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '1',
    title: 'Daily Stand-up',
    start: new Date('2026-05-13T09:00:00'),
    end: new Date('2026-05-13T09:30:00'),
    attendees: ['jan@company.com', 'lisa@company.com', 'marco@company.com'],
    status: 'accepted',
    ...overrides,
  }
}

it('shows "Context" header instead of "Bezochte pagina\'s" when meetings are provided', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent()]}
    />
  )
  expect(screen.getByText('Context')).toBeInTheDocument()
  expect(screen.queryByText("Bezochte pagina's")).toBeNull()
})

it('renders meeting title in agenda section', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent()]}
    />
  )
  expect(screen.getByText('Daily Stand-up')).toBeInTheDocument()
})

it('renders "Agenda (1)" sub-label', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent()]}
    />
  )
  expect(screen.getByText('Agenda (1)')).toBeInTheDocument()
})

it('renders "Browsing (1)" sub-label when meetings are present', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent()]}
    />
  )
  expect(screen.getByText('Browsing (1)')).toBeInTheDocument()
})

it('shows accepted status indicator', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent({ status: 'accepted' })]}
    />
  )
  expect(screen.getByText('✓ accepted')).toBeInTheDocument()
})

it('shows tentative status indicator', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent({ status: 'tentative' })]}
    />
  )
  expect(screen.getByText('? tentative')).toBeInTheDocument()
})

it('shows first names of up to 3 attendees', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent()]}
    />
  )
  expect(screen.getByText(/Jan, Lisa, Marco/)).toBeInTheDocument()
})

it('truncates attendees beyond 3 with +N', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent({ attendees: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'] })]}
    />
  )
  expect(screen.getByText(/\+2/)).toBeInTheDocument()
})

it('shows meeting time range', () => {
  render(
    <EvidencePanel
      rawUrls={['https://github.com/org/repo']}
      meetings={[makeEvent()]}
    />
  )
  expect(screen.getByText(/09:00–09:30/)).toBeInTheDocument()
})

it('keeps "Bezochte pagina\'s" header when no meetings provided', () => {
  render(<EvidencePanel rawUrls={['https://github.com/org/repo']} />)
  expect(screen.getByText("Bezochte pagina's")).toBeInTheDocument()
})

it('keeps "Bezochte pagina\'s" header when meetings is empty array', () => {
  render(<EvidencePanel rawUrls={['https://github.com/org/repo']} meetings={[]} />)
  expect(screen.getByText("Bezochte pagina's")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- EvidencePanel
```

Expected: 11 new tests FAIL (prop not accepted yet).

- [ ] **Step 3: Commit failing tests**

```bash
git add src/ui/components/EvidencePanel.test.tsx
git commit -m "test: add failing tests for EvidencePanel calendar agenda section"
```

---

### Task 2: Implement agenda rendering in EvidencePanel

**Files:**
- Modify: `src/ui/components/EvidencePanel.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'

interface Props {
  rawUrls?: string[] | undefined
  rawTitles?: string[] | undefined
  urls?: string[] | undefined
  titles?: string[] | undefined
  summary?: string | undefined
  startTime?: string | undefined
  endTime?: string | undefined
  meetings?: CalendarEvent[] | undefined
}

function displayUrl(url: string): { host: string; path: string } {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return { host: u.hostname, path: u.pathname.replace(/\/$/, '') }
  } catch {
    return { host: url, path: '' }
  }
}

function domainStyle(hostname: string): { bg: string; color: string } {
  if (/harborn/i.test(hostname)) return { bg: '#1a3a1a', color: '#5a8a6a' }
  if (/^accounts\.|^auth\.|^login\.|^sso\./i.test(hostname))
    return { bg: '#3a2e10', color: '#a07848' }
  return { bg: '#252220', color: '#7a7268' }
}

/** Extract first name from email: "jan.de.vries@company.com" → "Jan" */
function firstName(email: string): string {
  const local = email.split('@')[0] ?? email
  const part = local.split(/[._]/)[0] ?? local
  return part.charAt(0).toUpperCase() + part.slice(1)
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

function attendeeLabel(attendees: string[]): string {
  const names = attendees.slice(0, 3).map(firstName)
  const extra = attendees.length - 3
  return extra > 0 ? `${names.join(', ')} +${extra}` : names.join(', ')
}

export default function EvidencePanel({
  rawUrls,
  rawTitles,
  urls,
  titles,
  summary,
  startTime,
  endTime,
  meetings,
}: Props) {
  const urlList = rawUrls?.length ? rawUrls : urls ?? []
  const titleList = rawTitles?.length ? rawTitles : titles ?? []
  const meetingList = meetings?.length ? meetings : []
  const hasMeetings = meetingList.length > 0

  if (urlList.length === 0 && titleList.length === 0 && !summary && !hasMeetings) return null

  const timeLabel = startTime && endTime ? `${startTime}–${endTime}` : ''

  return (
    <div className="bg-[#1c1917] border border-[#2e2a26] rounded-lg overflow-hidden">
      {/* Kopregel */}
      <div className="px-3 py-[7px] border-b border-[#2e2a26] flex justify-between items-center">
        <span className="text-[#4a4540] text-[0.5625rem] uppercase tracking-[.08em] font-semibold">
          {hasMeetings ? 'Context' : "Bezochte pagina's"}
        </span>
        <span className="text-[#4a4540] text-[0.5625rem]">
          {hasMeetings
            ? timeLabel
            : `${urlList.length}${timeLabel ? ` · ${timeLabel}` : ''}`}
        </span>
      </div>

      {/* Browsing sub-label (alleen als meetings aanwezig) */}
      {hasMeetings && urlList.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <span className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em]">
            Browsing ({urlList.length})
          </span>
        </div>
      )}

      {/* URL-lijst */}
      {urlList.length > 0 && (
        <div className="overflow-y-auto px-3 py-2 flex flex-col gap-[7px]" style={{ maxHeight: '138px' }}>
          {urlList.map((url, i) => {
            const { host, path } = displayUrl(url)
            const style = domainStyle(host)
            const initial = host.replace(/^www\./, '')[0]?.toUpperCase() ?? '?'
            const pageTitle = titleList[i]
            return (
              <div key={i} className="flex gap-[10px] items-start">
                <div
                  className="flex-shrink-0 w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[0.5625rem] font-bold mt-[1px] border border-[#2e2a26]"
                  style={{ background: style.bg, color: style.color }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[#e8e2d9] text-[0.6875rem] font-medium truncate">
                    {host}{path}
                  </div>
                  {pageTitle && (
                    <div className="text-[#7a7268] text-[0.625rem] mt-[1px] truncate">
                      {pageTitle}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Scheidingslijn + Agenda-sectie */}
      {hasMeetings && (
        <>
          <div className="border-t border-[#2e2a26] mx-3" />
          <div className="px-3 pt-2 pb-1">
            <span className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em]">
              Agenda ({meetingList.length})
            </span>
          </div>
          <div className="px-3 pb-2 flex flex-col gap-[7px]">
            {meetingList.map((meeting) => {
              const statusColor = meeting.status === 'accepted' ? '#5a8a6a' : '#a07848'
              const statusLabel = meeting.status === 'accepted' ? '✓ accepted' : '? tentative'
              const timeRange = `${formatTime(meeting.start)}–${formatTime(meeting.end)}`
              const attendees = attendeeLabel(meeting.attendees)
              return (
                <div key={meeting.id} className="flex gap-[10px] items-start">
                  <div
                    className="flex-shrink-0 w-[26px] h-[26px] rounded-[5px] flex items-center justify-center text-[0.5625rem] mt-[1px] border border-[#2e2a26]"
                    style={{ background: '#1a2a3a' }}
                  >
                    📅
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-[5px]">
                      <span className="text-[#e8e2d9] text-[0.6875rem] font-medium truncate">
                        {meeting.title}
                      </span>
                      <span className="text-[0.5625rem] flex-shrink-0" style={{ color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="text-[#7a7268] text-[0.625rem] mt-[1px]">
                      {timeRange}{attendees ? ` · ${attendees}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* LLM-samenvatting */}
      {summary && (
        <div className="border-t border-[#2e2a26] px-3 py-[9px] bg-[#1c1917] flex gap-2 items-start">
          <div className="w-[2px] flex-shrink-0 bg-[#5a8a6a] rounded-sm self-stretch" />
          <div>
            <div className="text-[#4a4540] text-[0.5rem] uppercase tracking-[.06em] mb-[3px]">
              LLM samenvatting
            </div>
            <div className="text-[#94a3b8] text-[0.6875rem] leading-[1.5] italic">
              "{summary}"
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- EvidencePanel
```

Expected: all tests PASS (including the 11 new ones).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/EvidencePanel.tsx
git commit -m "feat: add agenda section to EvidencePanel when overlappingMeetings present"
```

---

### Task 3: Wire meetings prop in BookingModal

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx:87-95`

- [ ] **Step 1: Add meetings prop to EvidencePanel call**

Replace the existing `<EvidencePanel ... />` block (lines 87–96):

```tsx
{evidenceBlock && (
  <EvidencePanel
    rawUrls={evidenceBlock.rawUrls}
    rawTitles={evidenceBlock.rawTitles}
    urls={evidenceBlock.urls}
    titles={evidenceBlock.titles}
    summary={evidenceBlock.summary}
    startTime={evidenceBlock.startTime}
    endTime={evidenceBlock.endTime}
    meetings={evidenceBlock.overlappingMeetings}
  />
)}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. (`overlappingMeetings` is `CalendarEvent[] | undefined` on `ClassifiedBlock` — matches `meetings?: CalendarEvent[] | undefined`.)

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no new errors (existing 3 pre-existing errors are acceptable).

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "feat: pass overlappingMeetings from ClassifiedBlock to EvidencePanel"
```
