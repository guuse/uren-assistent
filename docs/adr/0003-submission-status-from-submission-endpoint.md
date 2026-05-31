# Week submission status comes from the submission resource, not from hour-entry flags

Whether a week is submitted ("ingediend") — and therefore locked and read-only in the app — is read exclusively from Simplicate's submission resource (`GET /hours/submission`, status by date for an employee). The app does **not** infer submission from the `locked` or `approvalstatus_id` fields that also appear on individual `HourEntry` records. Submitting itself goes through `POST /hours/submission` (employee + start/end date). Simplicate enforces a full calendar week here: `start_date` must be a Monday and `end_date` a Sunday, so submission is week-granular (not per-day).

This is deliberate: the submission resource models exactly the concept we expose ("is this week submitted?") at week granularity, whereas the per-entry flags are about an entry's own lifecycle and can be set or cleared for reasons unrelated to a week submission (approval workflow, individual locks). A future reader will see hour entries carrying a `locked`/`approvalstatus_id` they could have keyed off and wonder why we ignore them — this is intentional.

## Considered options

- **Infer from per-entry `locked` / `approvalstatus_id`** — derive "submitted" by scanning the week's `HourEntry`s. Rejected: an empty week has no entries to inspect (yet must be submittable and showable as submitted), the mapping from per-entry flags to a week-level state is ambiguous, and it couples our week concept to an approval lifecycle we don't otherwise model.
- **Track submission locally** — persist a "submitted" flag in the app's own store after a successful POST. Rejected: it drifts from reality when a week is submitted or withdrawn in the Simplicate UI; the user explicitly wants submitted weeks fetched from Simplicate.

## Consequences

- A new read against `GET /hours/submission` is needed; status is fetched per visible month and cached (in memory), refreshed when the month changes. The contract is verified against the live API: it requires exact `q[employee_id]`, `q[start_date]` and `q[end_date]` params (`[ge]`/`[le]` operators and `q[employee.id]` are rejected) and returns one record per day — `{ employee_id, date, status }` — where `status` is `submitted`/`approved`/`open`/`no_registrations`. A day counts as ingediend when its status is `submitted` or `approved`.
- The submission resource is the single source of truth: the read-only lock, the "Ingediend ✓" badge, and the calendar-dropdown week markings all derive from it.
- Submitting is week-granular (Monday–Sunday). The UI normalises any selected range to its full Mon–Sun week before calling the API; per-day submission is not possible because Simplicate requires `end_date` to be a Sunday.
- Withdrawal ("intrekken") is NOT supported through the public API and is therefore not offered in the app. Verified live: `DELETE /hours/submission` (with body or query) returns 422, `DELETE /hours/submit` returns 422, and `POST /hours/submission` with a `status` field returns 400; the docs expose no `delete-hours-submission` page and no `/hours/submission/{id}`. A submitted week shows a read-only "Ingediend" badge with the hint that withdrawing is done in Simplicate itself.
- After a submit, the affected month(s) are re-fetched from the submission resource rather than mutated optimistically, keeping Simplicate as the single source of truth.
- If Simplicate's per-entry `locked` ever diverges from submission status, the app follows the submission resource — booking attempts that Simplicate still rejects surface as API errors rather than being pre-empted by entry flags.
