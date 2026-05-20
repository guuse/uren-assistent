# Google Calendar Integration — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

---

## Overview

Add Google Calendar integration so that when a user imports browser history, calendar meetings for those same days are:

1. Fetched automatically using the existing Google OAuth token (with an added `calendar.readonly` scope)
2. Shown as their own bookable blocks in the import review UI (alongside browser history blocks)
3. Used as context by the AI (Copilot/GPT-4o) when classifying browser history blocks — both as a full-day meeting summary and as per-block overlap highlights

If the user has not granted the calendar scope, the import flow continues without calendar data (graceful degradation).

---

## Domain & Data Model

### New entity: `CalendarEvent`
**File:** `src/domain/entities/CalendarEvent.ts`

```ts
interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  attendees: string[]   // email addresses
  status: 'accepted' | 'tentative'
}
```

### New entity: `CalendarBlock`
**File:** `src/domain/entities/CalendarBlock.ts`

Same shape as `ClassifiedBlock` — blockName, summary, projectId, serviceId, confidence, origin — but with `origin: 'calendar'` and its time window set directly from the calendar event's start/end. Goes through the same review UI as `ClassifiedBlock`.

### Updated `ClassifiedBlock`
Add optional field: `overlappingMeetings?: CalendarEvent[]`  
Used only during classification, not persisted or booked.

### New repository interface: `IGoogleCalendarRepository`
**File:** `src/domain/repositories/IGoogleCalendarRepository.ts`

```ts
interface IGoogleCalendarRepository {
  fetchEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>
}
```

---

## Infrastructure & Auth

### `GoogleCalendarRepository`
**File:** `src/infrastructure/googlecalendar/GoogleCalendarRepository.ts`

- Implements `IGoogleCalendarRepository`
- Reads the Google access token from `KeychainRepository`
- Calls `GET https://www.googleapis.com/calendar/v3/calendars/primary/events` with `timeMin`, `timeMax`, `singleEvents=true`
- Filters to events where the user's `attendees[].self.responseStatus` is `accepted` or `tentative`
- Handles token refresh using the same pattern as `useAuth.ts`

### OAuth scope change
**File:** `src/ui/hooks/useAuth.ts` and the Tauri OAuth Rust command

- Add scope: `https://www.googleapis.com/auth/calendar.readonly`
- On first launch after this change, check stored token scopes via Google's `tokeninfo` endpoint
- If `calendar.readonly` is missing, do not force re-auth silently — surface an opt-in banner in the import UI instead

---

## Use Cases

### New: `FetchCalendarEventsUseCase`
**File:** `src/domain/usecases/FetchCalendarEventsUseCase.ts`

- Input: `startDate: Date`, `endDate: Date`
- Calls `IGoogleCalendarRepository.fetchEvents()`
- Returns `CalendarEvent[]`
- Never throws — returns empty array on scope missing, network error, or any failure

### Updated: `ClassifyHistoryBlocksUseCase`
**File:** `src/domain/usecases/ClassifyHistoryBlocksUseCase.ts`

- New optional parameter: `calendarEvents: CalendarEvent[]`
- For each `HistoryBlock`, compute `overlappingMeetings`: events whose time window intersects the block's time window
- Pass to `CopilotRepository`:
  - Full day meeting list (all events for that day) in the prompt
  - Per-block overlapping meetings highlighted in the per-block prompt section

### New: `ClassifyCalendarBlocksUseCase`
**File:** `src/domain/usecases/ClassifyCalendarBlocksUseCase.ts`

- Input: `CalendarEvent[]`, available projects/services
- Sends each event to the AI with title, duration, and attendees as context
- AI attempts to map meeting title → Simplicate project/service (low confidence is acceptable — user reviews in UI)
- Returns `CalendarBlock[]` with `origin: 'calendar'`

### Updated Copilot prompt structure

The enriched prompt for browser history block classification will include two new sections:

```
## Today's meetings
- 10:00–11:00 Sprint Planning (attendees: alice@co.nl, bob@co.nl)
- 14:00–14:30 1:1 with Jan

## Meetings overlapping this block
- 10:00–11:00 Sprint Planning
```

---

## UI & Wiring

### Import page flow
**File:** `src/ui/pages/ImportPage.tsx` (or equivalent)

1. User drops browser history CSV
2. App parses file, extracts date range
3. App checks if `calendar.readonly` scope is granted:
   - **Yes:** Fetch calendar events for those dates in parallel with history parsing (silent, no extra step)
   - **No:** Show inline banner — "Connect Google Calendar for richer AI classification" with a re-auth button. Import continues without calendar data.
4. `CalendarBlock[]` and `ClassifiedBlock[]` merged into a single list, sorted by time
5. Calendar blocks visually distinguished with a calendar icon or "Meeting" badge

No new page or modal required.

### New hook: `useCalendarEvents`
**File:** `src/ui/hooks/useCalendarEvents.ts`

```ts
{
  events: CalendarEvent[]
  loading: boolean
  error: string | null
  hasCalendarScope: boolean
}
```

`hasCalendarScope: false` triggers the inline re-auth banner.

### Container wiring
**File:** `src/application/container.ts`

- Register `GoogleCalendarRepository`
- Register `FetchCalendarEventsUseCase`
- Register `ClassifyCalendarBlocksUseCase`
- Pass `calendarEvents` into `ClassifyHistoryBlocksUseCase`

---

## Error Handling & Graceful Degradation

| Scenario | Behavior |
|---|---|
| Calendar scope not granted | Show inline banner; import proceeds without calendar data |
| Calendar API request fails | Log error; return empty `CalendarEvent[]`; no user-visible error |
| Token expired during calendar fetch | Attempt refresh; if refresh fails, treat as scope-missing |
| No events found for date range | Normal — calendar blocks list is empty, import continues |

---

## Out of Scope

- Multiple calendars (only primary calendar)
- Recurring event expansion beyond what Google returns with `singleEvents=true`
- Manual calendar event entry
- Caching calendar events between sessions
