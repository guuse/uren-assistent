# Design: Meeting-Centric Classification

**Date:** 2026-05-20  
**Status:** Approved

---

## Problem

The current classification pipeline has two independent LLM calls — one for browser history blocks, one for calendar events. The LLM never sees both together, so it cannot:

- Summarise browser activity in the context of the meeting it surrounded
- Use a meeting title to improve project matching for adjacent browser work
- Produce a coherent day narrative instead of two disconnected lists

The result: many small history blocks, plus separate meeting blocks, with weak project matches ("default urenpost") and no connection between them.

---

## Goal

Produce one coherent output per day:
- Each **accepted/tentative meeting** becomes an anchor block, annotated with a summary of surrounding browser activity
- Browser activity with **no nearby meeting** stays as a standalone block (unchanged behaviour)
- Solo meetings (no nearby browser activity) remain as their own block with meeting duration
- Project matching improves because the LLM sees meeting title + browser context together

---

## Architecture

### New use case: `GroupAndClassifyDayUseCase`

Replaces the separate `ClassifyHistoryBlocksUseCase` + `ClassifyCalendarBlocksUseCase` calls in `useImport`.

**Input:**
- `historyBlocks: HistoryBlock[]` — one day's parsed browser blocks
- `calendarEvents: CalendarEvent[]` — all events for the day
- `projects: Project[]`
- `services: Service[]`
- `cache: IMappingCacheRepository`

**Output:** `ClassifiedBlock[]` — sorted by `startTime`, mix of meeting-anchored and standalone blocks

**Steps:**
1. Split history blocks into "claimed" (overlap/adjacent to a meeting) and "unclaimed"
2. For each meeting, build a `MeetingGroup` — the event + its claimed history blocks
3. Resolve cache hits for both meeting groups and unclaimed blocks
4. Send uncached items to a single LLM prompt per day
5. Map LLM results back, merge with cache hits, return sorted

### Grouping logic

A history block is **claimed by a meeting** if its time window overlaps or is within `ATTACH_MINUTES = 15` minutes of the meeting's start or end.

```
meeting:    [====== 09:00–09:15 ======]
attach:  [--15min--][   meeting   ][--15min--]
         08:45                        09:30
```

A history block is claimed by the **nearest** meeting if multiple meetings could claim it. If equidistant, claimed by the earlier meeting.

Each history block can only be claimed by one meeting.

### Prompt structure

One prompt per day, structured as:

```
You are a time-tracking assistant. Today is YYYY-MM-DD.

For each item below, return one booking block. Meeting items represent calendar events
and should use the meeting duration. Standalone items use their browser activity duration.

## Meetings with browser context

### [1] Standup (09:00–09:15)
Browser activity during/around this meeting:
- github.com/org/repo (12x) — "PR #42 fix login", "Code review"
- jira.atlassian.com (3x) — "Sprint board"

### [2] Sprint Review (14:00–15:00)
Browser activity during/around this meeting:
- figma.com/file/xxx (8x) — "Design v2"
- notion.so (2x) — "Sprint notes"

### [3] Telefonisch overleg klant (10:00–10:30)
(geen browser-activiteit rondom deze meeting)

## Standalone browser activity

### [4] 11:30–12:00 (0.5u)
- stackoverflow.com (5x) — "React hooks", "useEffect cleanup"
- mdn.mozilla.org (2x) — "Promise.all"

---

Available projects: ...
Available services: ...
Cache hints (previously booked patterns):
- github.com/org/repo → project: "Harborn", service: "Development"
- standup:github.com/org/repo → project: "Harborn", service: "Development"

Return a JSON array, one item per numbered block above...
```

### Cache key scheme

| Block type | Cache key | Example |
|---|---|---|
| Meeting with browser activity | `meetingTitle:dominantUrlPattern` | `standup:github.com/org/repo` |
| Meeting without browser activity | `meetingTitle:_solo` | `telefonisch overleg klant:_solo` |
| Standalone history block | `urlPattern` (unchanged) | `github.com/org/repo` |

Cache keys are normalised: lowercase, leading/trailing whitespace stripped, max 120 chars.

Cache hints are injected into the prompt as a read-only reference — the LLM uses them to inform its choice but the final decision is always the LLM's. Hard cache hits (exact key match) skip the LLM entirely and get `origin: 'cache'`, same as now.

### Output block structure

Meeting-anchored blocks:
- `startTime` / `endTime` / `hours` — from the **calendar event** (not browser activity)
- `blockName` — LLM-generated, e.g. "Standup — PR review"
- `summary` — LLM-generated summary of what was done, Dutch preferred
- `projectId` / `serviceId` — LLM match
- `origin: 'calendar'`
- `calendarEventId` — preserved
- `urlPattern` — `meetingTitle:dominantUrlPattern` or `meetingTitle:_solo`

Standalone blocks:
- Unchanged from current behaviour
- `origin: 'llm'` or `'cache'`

### `ClassifiedBlock` entity change

No structural change needed. The existing `origin: 'calendar'` value is reused. The `urlPattern` for meeting-anchored blocks now uses the composite cache key format instead of `calendar:<eventId>`.

---

## What is removed

- `ClassifyCalendarBlocksUseCase` — no longer needed (replaced by `GroupAndClassifyDayUseCase`)
- The separate `calendarBlocks` classification step in `useImport`
- The per-block `overlappingMeetings` annotation on history blocks (replaced by grouping)

The `CalendarBlock` entity and `calendarEventToBlock` factory are retained for the `MeetingGroup` intermediate representation.

---

## Data flow (updated `useImport`)

```
parse CSV
  → historyBlocks[]

fetch calendar events
  → calendarEvents[]

group by day:
  for each day:
    GroupAndClassifyDayUseCase.execute(
      dayHistoryBlocks,
      dayCalendarEvents,
      projects, services, cache
    )
  → ClassifiedBlock[]

sort all blocks by date + startTime
setBlocks(allBlocks)
```

---

## Error handling

- If calendar fetch fails: `calendarEvents = []`, grouping proceeds with standalone-only mode (no meetings, all history blocks are standalone). Behaviour identical to pre-feature.
- If LLM call fails: throw, caught by `useImport`, sets `error` state (same as now).
- If a day has only meetings and no history: meetings are solo blocks, all resolved via cache or LLM.
- If a day has only history and no meetings: all blocks are standalone (same as pre-feature).

---

## Cache migration

Existing cache entries (keyed on bare `urlPattern`) remain valid and will still be matched for standalone history blocks. No migration needed. New meeting-composite keys are additive.

---

## Testing

- Unit tests for grouping logic (`attachHistoryToMeetings`) — edge cases: overlapping meetings, block claimed by two meetings, zero meetings, zero history
- Unit tests for `GroupAndClassifyDayUseCase` — cache hit path, LLM path, mixed day
- Existing `ClassifyHistoryBlocksUseCase` tests remain (it is not deleted, just no longer called from `useImport`)
- Mock `ICopilotRepository` in all use case tests

---

## Files affected

| File | Change |
|---|---|
| `src/domain/usecases/GroupAndClassifyDayUseCase.ts` | **New** |
| `src/domain/usecases/GroupAndClassifyDayUseCase.test.ts` | **New** |
| `src/infrastructure/copilot/CopilotRepository.ts` | Update `classify()` — new prompt format, cache hints injection |
| `src/domain/repositories/ICopilotRepository.ts` | Add `classifyDay()` method signature |
| `src/ui/hooks/useImport.ts` | Replace dual classify calls with `GroupAndClassifyDayUseCase` |
| `src/domain/usecases/ClassifyCalendarBlocksUseCase.ts` | Kept but no longer called from `useImport` |
