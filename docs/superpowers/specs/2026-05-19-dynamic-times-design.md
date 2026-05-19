# Dynamic Times in Templates — Design Spec

**Date:** 2026-05-19
**Status:** Approved

## Goal

Allow templates to have optional start/end times. When times are not filled in, the user picks them at booking time via the same `TimeSelect` dropdowns used in quick book.

## Scope

All three template types: `recurring`, `single`, `weekly-block`.

---

## Datamodel changes

### `BaseTemplate` in `src/domain/entities/Template.ts`

Make `startTime` and `endTime` optional:

```ts
startTime?: string  // HH:mm — undefined means user must pick at booking time
endTime?: string    // HH:mm — undefined means user must pick at booking time
```

Both fields change from `string` to `string | undefined`. They remain on `BaseTemplate` (all three template types share this behaviour).

---

## Template form (`TemplateForm.tsx`)

The time fields get a "leeg laten" toggle per field. Implementation:

- Each field has a checkbox labelled "Dynamisch" (or a wis-knop ✕ next to the input).
- When toggled on: the time input is hidden, state is set to `undefined`, stored as absent from the template object.
- When toggled off (default): the time input is shown with a sensible default (`09:00` / `09:30`).
- On load of an existing template: if `startTime`/`endTime` is absent, the toggle starts checked.

**UI sketch:**

```
STARTTIJD             EINDTIJD
[09:00]  [✕ Dynamisch]   [09:30]  [✕ Dynamisch]
```

When "Dynamisch" is active:

```
STARTTIJD             EINDTIJD
[Dynamisch ✓]           [Dynamisch ✓]
```

The toggle is a simple styled checkbox or toggle button — consistent with the existing dark theme.

---

## Booking modal (`BookingModal.tsx` + `useBooking.ts`)

### When times are missing from the template

Show `TimeSelect` dropdowns for Van/Tot — same as `isQuickBook` mode. Default values: `09:00` / `09:30`.

### When times are present on the template

No time UI shown. Times are used as-is (current behaviour).

### Implementation detail

`useBooking` already has `startTime`/`endTime` state and `UseBookingOptions`. The condition to show time pickers changes from `isQuickBook` to:

```ts
const showTimePickers = isQuickBook || !template.startTime || !template.endTime
```

This is the only change needed in `BookingModal.tsx`.

`useBooking` initial values also need a fallback when template times are absent:

```ts
const [startTime, setStartTime] = useState<string>(
  options.initialStartTime ?? template.startTime ?? '09:00'
)
const [endTime, setEndTime] = useState<string>(
  options.initialEndTime ?? template.endTime ?? '09:30'
)
```

---

## Use case (`BookTemplateUseCase.ts`)

`hoursFromTimes` is currently called with `template.startTime` and `template.endTime` unconditionally. After the datamodel change these are `string | undefined`.

The use case must validate that times are present before building entries. Times always arrive via the `effectiveTemplate` spread in `useBooking.book()` (which already merges `startTime`/`endTime` state into the template), so at use case level they should always be present — but add a guard for safety:

```ts
const startTime = template.startTime
const endTime = template.endTime
if (!startTime || !endTime) throw new Error('Start- en eindtijd zijn verplicht')
```

---

## `BookTemplateUseCase` input change

`weekStartDate` is already used as the date for `single` templates. For quick book with dynamic times the same field carries the selected date — no change needed here.

---

## Files changed

| File | Change |
|------|--------|
| `src/domain/entities/Template.ts` | `startTime?`, `endTime?` on `BaseTemplate` |
| `src/domain/usecases/BookTemplateUseCase.ts` | Guard for missing times; use local vars not `template.startTime` directly |
| `src/ui/hooks/useBooking.ts` | Fallback `?? '09:00'` / `?? '09:30'` in useState |
| `src/ui/pages/BookingModal.tsx` | `showTimePickers` condition instead of `isQuickBook` check |
| `src/ui/pages/Settings/TemplateForm.tsx` | "Dynamisch" toggle per time field; save `undefined` when toggled |

---

## What does NOT change

- `QUICK_BOOK_TEMPLATE` — already has explicit times, unaffected
- Existing templates with times stored — continue to work as before
- `BookTemplateUseCase` booking logic for recurring/single/weekly-block — unchanged
- `TimeSelect` component — unchanged
