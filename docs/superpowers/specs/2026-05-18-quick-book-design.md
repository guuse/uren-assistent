# Quick Book — Design Spec

**Date:** 2026-05-18  
**Status:** Approved

## Summary

Add a "+ Boeken" button in the Home header that opens the existing BookingModal in a "quick book" mode — no template required. The user picks a date, start time, end time (quarter-hour dropdowns), project, service, hour type, and note, then books directly.

---

## Entry Point

`Home.tsx` header gets a "+ Boeken" button on the right side, next to the title row.

Clicking it sets `bookingTemplate` to a **synthetic empty SingleTemplate**:

```ts
const QUICK_BOOK_TEMPLATE: SingleTemplate = {
  id: '__quick__',
  name: 'Vrij boeken',
  type: 'single',
  color: '#6c63ff',
  startTime: '09:00',
  endTime: '09:30',
  // no projectId, serviceId, hourTypeId, defaultNote
}
```

This is a module-level constant — not stored, not persisted.

---

## BookingModal changes

`BookingModal` receives an optional `isQuickBook` prop (derived from `template.id === '__quick__'` at the call site, passed explicitly to avoid magic string leaking into the modal).

When `isQuickBook` is true, the modal shows two extra fields **above** the existing project/service/hourtype selectors:

### Date picker
- `<input type="date">` defaulting to today (`new Date().toISOString().split('T')[0]`)
- Label: "Datum"

### Time dropdowns
- Two `<select>` dropdowns: "Van" and "Tot"
- Options: 07:00–20:00 in 15-minute steps (53 options each)
- Default: "Van" = 09:00, "Tot" = 09:30
- "Tot" options are filtered to only show times after "Van"
- Hours are computed client-side from the two times (existing `hoursFromTimes` logic)

These replace the week selector (which is hidden for quick book).

---

## useBooking changes

Add optional initial values for date and times:

```ts
interface UseBookingOptions {
  initialDate?: string   // YYYY-MM-DD, defaults to today
  initialStartTime?: string  // HH:mm
  initialEndTime?: string    // HH:mm
}
```

`useBooking(template, options?)` — when options are provided, they override the template's `startTime`/`endTime` and the `weekStartDate`.

For quick book, `weekStartDate` is set to the chosen date directly (not derived from a Monday calculation). `BookTemplateUseCase` already uses `weekStartDate` as the `startDate` for `single` type entries — no use case change needed.

---

## Data flow

```
Home "+ Boeken" click
  → bookingTemplate = QUICK_BOOK_TEMPLATE
  → <BookingModal template={QUICK_BOOK_TEMPLATE} isQuickBook={true} />
    → useBooking(template, { initialDate: today, initialStartTime: '09:00', initialEndTime: '09:30' })
      → user picks date, times, project, service, hourType, note
      → book() calls BookTemplateUseCase with weekStartDate = chosen date
        → POST /hours/hours with start_date = "2026-05-18 09:00:00", end_date = "2026-05-18 09:30:00"
```

---

## What does NOT change

- `BookTemplateUseCase` — no changes
- `HourEntry` entity — no changes
- `SimplicateRepository` — no changes
- Template storage — `__quick__` is never saved
- Existing template booking flow — fully unchanged

---

## Constraints

- Quarter-hour steps only (07:00–20:00)
- End time must be after start time — enforced by filtering "Tot" options
- All existing validation (missing project/service/hourtype) applies unchanged
- No "save as template" shortcut in this iteration (YAGNI)
