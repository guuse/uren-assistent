# Twee-kolommen BookingModal — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zet de BookingModal om naar een twee-kolommen layout (720px breed) wanneer er een `evidenceBlock` aanwezig is, zodat het formulier en de EvidencePanel naast elkaar staan en er niet meer gescrolled hoeft te worden.

**Architecture:** Alleen UI-laag wijzigingen. `BookingModal.tsx` krijgt een conditionele flex-row wrapper: als er een `evidenceBlock` is, staan formulier (links) en EvidencePanel (rechts) naast elkaar in gelijke kolommen. Zonder `evidenceBlock` blijft het huidige smalle layout intact. `EvidencePanel.tsx` krijgt scroll-within-column gedrag.

**Tech Stack:** React, Tailwind CSS (inline classes), TypeScript strict

---

## Bestanden

| Bestand | Wijziging |
|---|---|
| `src/ui/pages/BookingModal.tsx` | Twee-kolommen layout conditioneel op `evidenceBlock` |
| `src/ui/components/EvidencePanel.tsx` | `overflow-y: auto` + `max-height: 100%` voor intern scrollen |

---

## Task 1: EvidencePanel scrollbaar binnen kolom

**Files:**
- Modify: `src/ui/components/EvidencePanel.tsx`

- [ ] **Stap 1: Voeg scroll-gedrag toe aan de root div van EvidencePanel**

Open `src/ui/components/EvidencePanel.tsx`. Zoek de laatste `return (` in de component (rond regel 60+). De root element van de component is een `<div className="...">`. Voeg `overflow-y-auto` en `max-h-full` toe aan die className, en zet `min-h-0` zodat flex-shrink correct werkt.

Zoek de huidige root `<div>` van de return van de `EvidencePanel` functie (niet de helper functies). Het is de div met `className` die begint met iets als `"flex flex-col gap-..."` of `"rounded-lg border..."`. Voeg toe: `overflow-y-auto max-h-full min-h-0`.

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/EvidencePanel.tsx
git commit -m "fix: make EvidencePanel scroll within its container"
```

---

## Task 2: Twee-kolommen layout in BookingModal

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`

- [ ] **Stap 1: Vervang de modal-container breedte en body-structuur**

In `src/ui/pages/BookingModal.tsx`, regel 82:

**Huidig:**
```tsx
<div className="bg-[#252220] rounded-xl w-[420px] flex flex-col overflow-hidden">
```

**Nieuw:**
```tsx
<div
  className={`bg-[#252220] rounded-xl flex flex-col overflow-hidden ${
    evidenceBlock ? 'w-[720px]' : 'w-[420px]'
  }`}
  style={{ maxHeight: '90vh' }}
>
```

- [ ] **Stap 2: Vervang de body door een twee-kolommen structuur**

Vervang het huidige `{/* Body */}` blok (regels 108–201) door:

```tsx
{/* Body */}
{evidenceBlock ? (
  /* Twee-kolommen layout */
  <div className="flex flex-1 overflow-hidden min-h-0">
    {/* Linkerkolom: formulier */}
    <div className="flex-1 px-5 py-4 flex flex-col gap-4 overflow-y-auto border-r border-[#2e2a26]">
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
        renderSuffix={(opt) => (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void booking.toggleStar(opt.id) }}
            className="p-1 text-[#a07848] hover:text-[#c09858] transition-colors"
            aria-label={booking.starredIds.has(opt.id) ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
          >
            {booking.starredIds.has(opt.id) ? '★' : '☆'}
          </button>
        )}
        {...(booking.lastStarredId !== undefined && { groupSeparatorAfter: booking.lastStarredId })}
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

    {/* Rechterkolom: bewijs */}
    <div className="flex-1 px-5 py-4 overflow-y-auto min-h-0">
      <EvidencePanel
        rawUrls={evidenceBlock.rawUrls}
        rawTitles={evidenceBlock.rawTitles}
        urls={evidenceBlock.urls}
        titles={evidenceBlock.titles}
        summary={evidenceBlock.summary}
        startTime={evidenceBlock.startTime}
        endTime={evidenceBlock.endTime}
        meetings={evidenceBlock.overlappingMeetings}
        commits={evidenceBlock.commits ?? []}
        linearIssues={evidenceBlock.linearIssues ?? []}
      />
    </div>
  </div>
) : (
  /* Enkele kolom (geen evidenceBlock) */
  <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
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
      renderSuffix={(opt) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void booking.toggleStar(opt.id) }}
          className="p-1 text-[#a07848] hover:text-[#c09858] transition-colors"
          aria-label={booking.starredIds.has(opt.id) ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
        >
          {booking.starredIds.has(opt.id) ? '★' : '☆'}
        </button>
      )}
      {...(booking.lastStarredId !== undefined && { groupSeparatorAfter: booking.lastStarredId })}
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
)}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 4: Lint**

```bash
npm run lint
```

Verwacht: geen fouten.

- [ ] **Stap 5: Commit**

```bash
git add src/ui/pages/BookingModal.tsx
git commit -m "feat: two-column layout for BookingModal when evidenceBlock is present"
```
