# UI Redesign — Spec

**Date:** 2026-05-21  
**Status:** Approved

---

## Goal

Redesign the full application UI: fix the broken layout, replace the mixed dark/light visual inconsistency, adopt a clean soft palette, and restructure navigation and the import flow.

---

## Design Decisions

| Dimension | Decision |
|---|---|
| Navigation | 52px icon-only sidebar (replaces top nav) |
| Color palette | Warm cream (see tokens below) |
| Import review | Full-page focused card per block (replaces modal) |
| Typography | Inter — no change |

---

## Color Tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#faf8f4` | Page background |
| `bg-sidebar` | `#f2ede6` | Sidebar background |
| `bg-card` | `#ffffff` | Cards, panels |
| `bg-inset` | `#faf8f4` | Inset areas inside cards (evidence panel, selectors) |
| `border` | `#e8e2d9` | All borders |
| `text-primary` | `#3a3530` | Headings, labels, CTA button background |
| `text-secondary` | `#a09890` | Timestamps, secondary labels |
| `text-muted` | `#c0b8b0` | Placeholder text, section labels (uppercase) |
| `text-on-dark` | `#faf8f4` | Text on dark (#3a3530) backgrounds |
| `active-tint` | `#3a353012` | Active icon background in sidebar |

Template/category dot colors (no semantic meaning, just visual variety):
- Terracotta: `#d97757`
- Sage: `#6a9e80`
- Muted lavender: `#9b8ec4`
- Additional: `#c4956a`, `#7a9e7e`, `#8b7db8`

Status indicator colors (semantic):
- Success / booked: `#6a9e80`
- Warning / incomplete: `#c4956a`
- Error / unready: `#d97757`

---

## App Shell

### Layout

```
┌──────────────────────────────────────┐
│ [52px sidebar] │ [content area]      │
│                │                     │
│                │                     │
└──────────────────────────────────────┘
```

- `App.tsx` wraps everything in `h-screen flex overflow-hidden bg-[#faf8f4]`
- Sidebar: `w-[52px] flex-shrink-0 bg-[#f2ede6] border-r border-[#e8e2d9]`
- Content: `flex-1 overflow-hidden` — each page owns its own scroll

### Sidebar contents (top to bottom)

1. Logo mark — 30×30px, `bg-[#3a3530]` rounded square, no text
2. Home icon (Heroicons `HomeIcon`) — active state: `bg-[#3a353012]` tint + darker stroke
3. Import icon (Heroicons `ArrowDownTrayIcon`) — same active logic
4. `flex-1` spacer
5. Settings icon (Heroicons `Cog6ToothIcon`)
6. User avatar — 26px circle, initials, `bg-[#e8e2d9]`

Active icon style: `bg-[#3a353012] rounded-lg` with `stroke-[#3a3530]`  
Inactive icon style: no background, `stroke-[#c8c0b8]`

Tooltip on hover (native `title` attribute is sufficient — no custom tooltip component needed).

### Removing old top nav

`App.tsx` currently renders a `<nav>` with `bg-white border-b`. This is removed entirely. Navigation state (`currentPage`) moves to a sidebar prop/callback pattern.

---

## Home Page

### Structure

```
┌─ content ─────────────────────────────┐
│  Header row: title + date | + Boeken  │
│  Template grid (2 columns)            │
│    [card] [card]                      │
│    [card] [+ Template toevoegen]      │
│  Status bar: user info | sync/logout  │
└───────────────────────────────────────┘
```

### Header

- Title: `text-[#3a3530] text-[15px] font-bold tracking-tight`
- Date: `text-[#a09890] text-[11px]`
- "+ Boeken" button: `bg-[#3a3530] text-[#faf8f4] rounded-md px-[14px] py-[7px] text-[11px] font-semibold`

### Template cards

- `bg-white border border-[#e8e2d9] rounded-[10px] p-[14px] cursor-pointer`
- Hover: `hover:border-[#d0c9c0]` (subtle darkening, no shadow)
- Color dot: 8×8px circle, template's `color` field
- Name: `text-[#3a3530] text-[12px] font-semibold`
- Time: `text-[#a09890] text-[11px]`

### Add template card

- `border border-dashed border-[#e0d9d0] rounded-[10px] text-[#c8c0b8] text-[11px]`

### Status bar

- `border-t border-[#e8e2d9] py-[10px]` — flex row, `text-[#c0b8b0] text-[10px]`
- Left: "Ingelogd als {name}"
- Right: "↻ Sync (N)" + "Uitloggen"

---

## Import Page

### Overview of states

1. **Empty** — drop zone + CSV button, no blocks yet
2. **Loading** — progress message, spinner
3. **Review** — focused card per block, step through all
4. **Done** — summary screen

### Structure (Review state)

```
┌─ content ──────────────────────────────┐
│  Top bar: title | progress bar | N/T | + CSV │
│                                         │
│  ┌─ Focused card ──────────────────┐   │
│  │  Block title + time range       │   │
│  │  Confidence badge               │   │
│  │  Evidence panel (inset)         │   │
│  │  Project selector               │   │
│  │  Service selector               │   │
│  │  [← Vorige] [Overslaan] [Bevestig →] │
│  └─────────────────────────────────┘   │
│                                         │
│  Dot progress indicator                 │
└─────────────────────────────────────────┘
```

### Top bar

- Title: `text-[#3a3530] text-[13px] font-bold`
- Progress bar: `flex-1 h-[3px] bg-[#e8e2d9] rounded` with inner fill `bg-[#3a3530]` at `width: (current/total * 100)%`
- Counter: `text-[#a09890] text-[10px]` — "N / T"
- "+ CSV" button: `bg-white border border-[#e8e2d9] text-[#a09890] rounded px-[10px] py-[4px] text-[10px]`

### Focused card

- `bg-white border border-[#e8e2d9] rounded-[12px] p-[18px] flex flex-col gap-[12px]`
- Takes `flex-1` — fills all available vertical space between top bar and dot indicator
- Keyboard: left arrow = previous, right arrow = next/confirm

**Block header:**
- Title: `text-[#3a3530] text-[14px] font-bold tracking-tight`
- Time line: `text-[#a09890] text-[11px]`
- Confidence badge: `bg-[#f2ede6] text-[#a09890] rounded text-[10px] px-[9px] py-[3px]`

**Evidence panel:**
- Container: `bg-[#faf8f4] border border-[#e8e2d9] rounded-[8px] p-[10px_12px]`
- Label: `text-[#c0b8b0] text-[9px] font-semibold uppercase tracking-[0.07em]` — "Wat je deed"
- Each URL row: 3px dot (`bg-[#c0b8b0]`) + `text-[#a09890] text-[10px]` truncated
- Max 5 URLs shown

**Project / service selectors:**
- 2-column grid, same width
- Label: `text-[#c0b8b0] text-[9px] font-semibold uppercase tracking-[0.07em]`
- Selected value: `bg-[#faf8f4] border border-[#d97757] rounded-[7px] p-[7px_10px] text-[#3a3530] text-[11px]` (accent border when filled)
- Empty: same but `border-[#e8e2d9] text-[#c0b8b0]`
- These reuse the existing `SearchableSelect` component

**Action row:**
- `← Vorige`: `bg-[#faf8f4] border border-[#e8e2d9] text-[#a09890] rounded-[7px] px-[14px] py-[8px] text-[11px]`
- `Overslaan`: same style as Vorige
- `Bevestig →`: `flex-1 bg-[#3a3530] text-[#faf8f4] rounded-[7px] py-[8px] text-[11px] font-semibold`

### Dot progress indicator

- Row of dots, centered, `gap-[6px]`
- Active: 7×7px `bg-[#3a3530]`
- Inactive: 5×5px `bg-[#e0d9d0]`

### Empty state

- Centered drop zone: dashed border `border-[#e0d9d0]`, cream bg, text `text-[#c0b8b0]`
- "Sleep Chrome history CSV hiernaartoe of klik"
- Min-visits input below it

### Loading state

- Replace card area with a simple centered text + subtle spinner
- `text-[#a09890] text-[12px]`

### Done state (after all blocks confirmed/skipped)

- Card area shows: "Klaar — N blokken bevestigd, M overgeslagen"
- "Boek alle bevestigde blokken" CTA button (primary style)

---

## Settings Page

No structural changes. Apply color tokens:
- Background: `bg-[#faf8f4]`
- Cards/panels: `bg-white border border-[#e8e2d9]`
- All text: use `text-primary` / `text-secondary` / `text-muted` tokens

---

## Components to update

| Component | Change |
|---|---|
| `App.tsx` | Remove top nav, add sidebar, update wrapper styles |
| `Home.tsx` | Apply new tokens, new status bar, remove old footer pattern |
| `ImportPage.tsx` | Full rewrite: remove day-sidebar + block list + modal pattern, implement focused card flow |
| `ImportBlockModal.tsx` | Delete — functionality absorbed into ImportPage focused card |
| `EvidencePanel.tsx` | Keep logic, restyle to new tokens |
| `TemplateCard.tsx` | Apply new card styles |
| `BookingModal.tsx` | Apply color tokens, keep structure |
| `SettingsPage.tsx` | Apply color tokens |
| `LoginPage.tsx` | Apply color tokens |

---

## What does NOT change

- All domain entities, use cases, repositories — zero changes
- `useImport` hook logic — zero changes to business logic
- `ClassifiedBlock` shape — zero changes (rawTitles/rawUrls stay)
- `selectedBlockIndex` from `useImport` is reused as-is: ImportPage steps through blocks by incrementing it directly, no modal involved. `openBlock`/`closeBlock` are no longer called; the page manages navigation itself via index state.

---

## Out of scope

- Animations / transitions (can be added later)
- Dark mode
- Responsive / mobile layout
- Any new features
