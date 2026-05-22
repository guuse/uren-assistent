# Dark Mode Redesign Spec

**Date:** 2026-05-22  
**Status:** Approved

## Goal

Replace the warm cream palette (introduced in the UI redesign of 2026-05-21) with a warm dark palette — espresso/charcoal tones. Same structure, same layout, same Clean Architecture constraints. Pure color token swap.

## Palette

| Token | Value | Usage |
|---|---|---|
| `bg-base` | `#1c1917` | Page backgrounds, main canvas |
| `bg-sidebar` | `#171512` | Sidebar background |
| `bg-card` | `#252220` | Card surfaces, modal content |
| `bg-input` | `#1e1b18` | Input fields, select backgrounds |
| `bg-subtle` | `#2a2622` | Evidence panel, subtle inset areas |
| `text-primary` | `#e8e2d9` | Headings, body text |
| `text-muted` | `#7a7268` | Timestamps, labels, secondary info |
| `text-faint` | `#4a4540` | Placeholder text, very muted elements |
| `border` | `#2e2a26` | Card borders, dividers, input borders |
| `border-hover` | `#3e3a36` | Hover state borders |
| `accent` | `#e8e2d9` | Primary CTA buttons (light on dark) |
| `accent-text` | `#1c1917` | Text on accent buttons |
| `accent-hover` | `#d5cfc6` | Hover state for CTA buttons |
| `success` | `#5a8a6a` | Geboekt, succes states |
| `warning` | `#a07848` | Waarschuwing, ontbrekende velden |
| `error` | `#b85a3a` | Fouten |
| `focus-ring` | `#5a5248` | Focus border on inputs |
| `active-nav` | `#2e2a26` | Active nav item background |
| `dot-active` | `#e8e2d9` | Active dot in progress indicator |
| `dot-muted` | `#3e3a36` | Inactive/skipped dot |

## Scope

All files touched in the 2026-05-21 redesign, plus the components that still had old dark colors:

| File | Action |
|---|---|
| `src/ui/components/Sidebar.tsx` | Token swap |
| `src/ui/pages/Home.tsx` | Token swap |
| `src/ui/components/TemplateCard.tsx` | Token swap |
| `src/ui/components/EvidencePanel.tsx` | Token swap |
| `src/ui/components/ImportBlockCard.tsx` | Token swap |
| `src/ui/pages/ImportPage.tsx` | Token swap |
| `src/ui/pages/LoginPage.tsx` | Token swap |
| `src/ui/pages/Settings/SettingsPage.tsx` | Token swap |
| `src/ui/pages/BookingModal.tsx` | Token swap |
| `src/ui/components/SearchableSelect.tsx` | Token swap (had old `#1a1a2e` dark) |
| `src/ui/components/DayPicker.tsx` | Token swap (had old purple active) |
| `src/ui/components/TimeSelect.tsx` | Token swap (had old dark) |
| `src/ui/pages/Settings/AccountSettings.tsx` | Token swap (had old dark + purple) |
| `src/ui/pages/Settings/TemplateForm.tsx` | Token swap (had old dark + purple) |

## Token Map (old → new)

### Backgrounds
- `bg-[#faf8f4]` → `bg-[#1c1917]`
- `bg-[#f2ede6]` → `bg-[#171512]`
- `bg-white` → `bg-[#252220]`
- `bg-[#fff8f5]` → `bg-[#221e1b]` (error bg tint)
- Old `bg-[#1a1a2e]` → `bg-[#1e1b18]`
- Old `bg-[#2d2d44]` → `bg-[#252220]`
- Old `bg-[#12121e]` → `bg-[#171512]`

### Text
- `text-[#3a3530]` → `text-[#e8e2d9]`
- `text-[#a09890]` → `text-[#7a7268]`
- `text-[#c0b8b0]` → `text-[#4a4540]`
- `text-[#c8c0b8]` → `text-[#4a4540]`
- Old `text-white` → `text-[#e8e2d9]`
- Old `text-gray-400` → `text-[#7a7268]`
- Old `text-gray-500` → `text-[#4a4540]`
- Old `text-gray-300` → `text-[#a09890]`

### Borders
- `border-[#e8e2d9]` → `border-[#2e2a26]`
- `border-[#e0d9d0]` → `border-[#2e2a26]`
- `border-[#d0c9c0]` → `border-[#3e3a36]`
- `border-[#f0ddd5]` → `border-[#3a2e2a]`
- Old `border-gray-700` → `border-[#2e2a26]`
- Old `border-gray-800` → `border-[#252220]`
- Old `border-gray-600` → `border-[#3e3a36]`

### Accent / Primary buttons
- `bg-[#3a3530]` (dark button on cream) → `bg-[#e8e2d9]`
- `text-[#faf8f4]` (button text) → `text-[#1c1917]`
- `hover:bg-[#2e2b26]` → `hover:bg-[#d5cfc6]`
- Old `bg-[#6c63ff]` → `bg-[#e8e2d9]`, `text-[#1c1917]`
- Old `hover:bg-[#5a52e0]` → `hover:bg-[#d5cfc6]`

### Status colors
- `text-[#6a9e80]` → `text-[#5a8a6a]`
- `text-[#d97757]` → `text-[#b85a3a]`
- `text-[#c4956a]` → `text-[#a07848]`
- Old `bg-green-900/40 text-green-300` → `bg-[#1e2e22] text-[#5a8a6a]`
- Old `bg-red-900/40 text-red-300` → `bg-[#2e1e1a] text-[#b85a3a]`
- Old `text-red-400 hover:text-red-300` → `text-[#b85a3a] hover:text-[#c86a4a]`

### Focus
- `focus:border-[#a09890]` → `focus:border-[#5a5248]`
- Old `focus:border-[#6c63ff]` → `focus:border-[#5a5248]`

### Active nav / selected states
- `bg-[#3a353012]` → `bg-[#2e2a26]`
- `hover:bg-[#3a35300a]` → `hover:bg-[#252220]`
- `stroke-[#3a3530]` (active icon) → `stroke-[#e8e2d9]`
- `stroke-[#c8c0b8]` (inactive icon) → `stroke-[#4a4540]`
- Old `bg-[#6c63ff] text-white` (active toggle) → `bg-[#e8e2d9] text-[#1c1917]`
- Old `bg-[#1a1a2e] text-gray-400 hover:text-white` (inactive toggle) → `bg-[#1e1b18] text-[#7a7268] hover:text-[#e8e2d9]`

### Misc
- `bg-[#e8e2d9]` (avatar bg) → `bg-[#2e2a26]`
- `border-dashed border-[#e0d9d0]` → `border-dashed border-[#2e2a26]`
- Modal overlay `bg-black/60` → stays as-is

## Constraints

- Zero logic changes
- Zero domain/application/infrastructure changes
- No new components
- No layout changes
- TypeScript strict mode — no `any`
