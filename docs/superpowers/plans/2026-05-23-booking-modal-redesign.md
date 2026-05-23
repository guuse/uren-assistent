# BookingModal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Herontwerp `EvidencePanel` en `BookingModal` zodat alle context van een concept-blok (URLs, paginatitels, LLM-samenvatting) direct zichtbaar is en de gebruiker nooit meer zijn browsergeschiedenis hoeft te raadplegen.

**Architecture:** Puur UI-laag. `EvidencePanel` wordt volledig herschreven tot een scrollbaar bewijs-blok met domein-initiaalblokjes, paginatitels en een altijd-zichtbare LLM-samenvatting. `BookingModal` krijgt een nieuwe header (blok-naam als titel, datum/tijd/confidence als subtitle) en het overbodige datum-veld wordt verwijderd.

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS (arbitrary values), bestaande kleur-tokens uit het design system.

---

## Bestandsoverzicht

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `src/ui/components/EvidencePanel.tsx` | Herschrijven | Scrollbare URL+titel lijst met domein-initiaalblokjes en LLM-samenvatting |
| `src/ui/pages/BookingModal.tsx` | Aanpassen | Nieuwe header, datum-veld verwijderen, `title` prop vervangen door `blockName` uit `evidenceBlock` |

---

## Task 1: Herschrijf `EvidencePanel`

**Files:**
- Modify: `src/ui/components/EvidencePanel.tsx`

### Wat het nieuwe component doet

- Toont een kopregel: "Bezochte pagina's" links, `{N} · {startTime}–{endTime}` rechts
- Scrollbare URL-lijst (`max-height` ~138px, `overflow-y: auto`), elke rij:
  - Domein-initiaalblokje 26×26px (kleur afhankelijk van hostname-patroon)
  - URL-tekst (`host + pathname`, truncate) in `#e8e2d9`
  - Paginatitel eronder in `#7a7268`
- LLM-samenvatting altijd zichtbaar onder de lijst: groene verticale streep + italic tekst

### Kleurlogica domein-initiaalblokjes

```ts
function domainStyle(hostname: string): { bg: string; color: string } {
  if (/harborn/i.test(hostname)) return { bg: '#1a3a1a', color: '#5a8a6a' }
  if (/^accounts\.|^auth\.|^login\.|^sso\./i.test(hostname)) return { bg: '#3a2e10', color: '#a07848' }
  return { bg: '#252220', color: '#7a7268' }
}
```

### Stappen

- [ ] **Stap 1: Vervang de volledige inhoud van `EvidencePanel.tsx`**

```tsx
interface Props {
  rawUrls?: string[]
  rawTitles?: string[]
  urls?: string[]
  titles?: string[]
  summary?: string
  startTime?: string
  endTime?: string
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

export default function EvidencePanel({
  rawUrls,
  rawTitles,
  urls,
  titles,
  summary,
  startTime,
  endTime,
}: Props) {
  const urlList = rawUrls?.length ? rawUrls : urls ?? []
  const titleList = rawTitles?.length ? rawTitles : titles ?? []

  if (urlList.length === 0 && titleList.length === 0 && !summary) return null

  const timeLabel = startTime && endTime ? ` · ${startTime}–${endTime}` : ''

  return (
    <div className="bg-[#1c1917] border border-[#2e2a26] rounded-lg overflow-hidden">
      {/* Kopregel */}
      <div className="px-3 py-[7px] border-b border-[#2e2a26] flex justify-between items-center">
        <span className="text-[#4a4540] text-[0.5625rem] uppercase tracking-[.08em] font-semibold">
          Bezochte pagina's
        </span>
        <span className="text-[#4a4540] text-[0.5625rem]">
          {urlList.length}{timeLabel}
        </span>
      </div>

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

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: 0 errors.

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/EvidencePanel.tsx
git commit -m "feat: redesign EvidencePanel with scrollable URL list and LLM summary"
```

---

## Task 2: Pas `BookingModal` aan

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

### Wijzigingen

1. **Header:** toon `evidenceBlock.blockName` als titel (fallback naar `title` prop); datum/tijd/confidence als subtitle
2. **Datum-veld:** verwijder het `<input type="date">` en het bijbehorende label — datum staat al in de header
3. **EvidencePanel:** geef ook `summary`, `startTime`, `endTime`, `urls`, `titles` door

### Stappen

- [ ] **Stap 1: Vervang de modal-header en verwijder het datum-veld**

Vervang de huidige `BookingModal` door de volgende versie:

```tsx
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

  const modalTitle = evidenceBlock?.blockName ?? title

  const confidenceBadge = evidenceBlock
    ? evidenceBlock.origin === 'cache'
      ? { label: 'Cache', bg: '#1a3a1a', color: '#5a8a6a' }
      : { label: `${Math.round(evidenceBlock.confidence * 100)}% zeker`, bg: '#1a3a1a', color: '#5a8a6a' }
    : null

  const dateLabel = evidenceBlock
    ? new Date(evidenceBlock.date + 'T12:00:00').toLocaleDateString('nl-NL', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

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
      <div className="bg-[#252220] rounded-xl w-[420px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-[18px] pb-[14px] border-b border-[#2e2a26] flex justify-between items-start">
          <div>
            <div className="text-[#e8e2d9] font-bold text-base mb-[3px]">{modalTitle}</div>
            {evidenceBlock && (
              <div className="text-[#7a7268] text-[0.6875rem] flex items-center gap-2 flex-wrap">
                {dateLabel && <span>{dateLabel}</span>}
                <span className="text-[#2e2a26]">·</span>
                <span className="text-[#e8e2d9]">{evidenceBlock.startTime}–{evidenceBlock.endTime}</span>
                <span className="text-[#2e2a26]">·</span>
                <span>{evidenceBlock.hours}u</span>
                {confidenceBadge && (
                  <span
                    className="text-[0.5625rem] px-[7px] py-[2px] rounded-full font-semibold"
                    style={{ background: confidenceBadge.bg, color: confidenceBadge.color }}
                  >
                    {confidenceBadge.label}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-[#4a4540] hover:text-[#e8e2d9] text-lg mt-[2px]">✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>

          {evidenceBlock && (
            <EvidencePanel
              rawUrls={evidenceBlock.rawUrls}
              rawTitles={evidenceBlock.rawTitles}
              urls={evidenceBlock.urls}
              titles={evidenceBlock.titles}
              summary={evidenceBlock.summary}
              startTime={evidenceBlock.startTime}
              endTime={evidenceBlock.endTime}
            />
          )}

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

          {/* Toelichting */}
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-[#7a7268]">Toelichting</label>
            <input
              value={booking.note}
              onChange={(e) => booking.setNote(e.target.value)}
              placeholder="Optioneel"
              className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#3e3a36] focus:border-[#5a5248] focus:outline-none"
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
    </div>
  )
}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: 0 errors.

- [ ] **Stap 3: Lint**

```bash
npm run lint
```

Verwacht: geen nieuwe errors (er zijn 3 pre-existerende lint-warnings die je mag negeren).

- [ ] **Stap 4: Tests draaien**

```bash
npm run test
```

Verwacht: alle 104 tests groen.

- [ ] **Stap 5: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "feat: redesign BookingModal header with blockName, date/confidence subtitle and no date field"
```

---

## Verificatie na beide tasks

- [ ] Start de app: `npm run tauri dev`
- [ ] Open een concept-blok door erop te klikken in de tijdlijn
- [ ] Controleer: titel = blok-naam (niet "Losse browser-activiteit")
- [ ] Controleer: datum/tijd/confidence zichtbaar als subtitle
- [ ] Controleer: alle URLs zichtbaar met initiaalblokje en paginatitel
- [ ] Controleer: LLM-samenvatting zichtbaar als italic quote
- [ ] Controleer: scrollbar verschijnt bij 6+ URLs
- [ ] Controleer: geen datum-inputveld in het formulier
