# Uren-assistent

A Tauri desktop app that turns a developer's day (browser history, calendar, GitHub/Linear activity, booking history) into bookable time blocks in Simplicate. An LLM (Gemini Flash) classifies the day; the app lays the result out on a timeline and books it.

## Language

### The day

**Concept block**:
A proposed, not-yet-booked time block for a day, produced by classification. Carries a `confidence` of 1–5. Rendered green on the timeline.
_Avoid_: suggestion, block (when ambiguous)

**Existing hours**:
Time already booked for the day as a Simplicate `HourEntry`. Rendered blue ("geboekt"). Immovable — concept blocks must never overlap these.
_Avoid_: entry (when ambiguous with concept block), booking

**Meeting block**:
A concept block anchored to a calendar event; its start/end come from the event and are treated as fixed. Calendar is the highest-priority source. A meeting counts as attended unless you explicitly **declined** it (un-RSVP'd `needsAction` meetings — recurring team rituals — are kept). Every such meeting **always** produces a block — even if the classifier omits it (it then falls back to the event title / cached mapping, or stays unclassified). Concurrent meetings keep their real times and overlap each other; the timeline renders them side by side, Google-Calendar style.

**Source**:
An origin of evidence about the day. The five sources, in fixed priority order, are: **calendar** > **GitHub commits** > **browser history** > **Linear** > **trends**. The first four are _observed activity_; trends are historical bookings from prior weeks. A higher source outranks a lower one when they describe the same work.
_Avoid_: signal, input (when ambiguous)

**Absorption**:
A higher-priority source claiming related lower-priority activity that falls in its scope into a single concept block, instead of producing parallel blocks. A meeting absorbs the commits/browser activity in its window; a commit block absorbs the Linear issue it implements. Absorption only happens with **hard evidence** of a relationship (shared repo↔project mapping, a shared Linear issue ref, or clear keyword overlap) — never on time-overlap alone. Without evidence the activities stay separate blocks.

**Project block**:
The single concept block that all observed activity for one project+service on one day folds into. Several commit sessions / PR-merges and browser blocks on the same project+service become one block; the individual PRs/commits live on in its summary and note. Different services under the same project stay separate blocks (a service is a billable distinction), optionally grouped under a project header in the UI.
_Avoid_: PR block, commit block (those are now folded into this)

**Trends**:
Historical bookings from prior weeks, used only to reach the fill target — never to create or relabel observed work. Trends fill in two ways, in order: first by **growing** the day's existing project blocks toward their historical size; then, only if still short, by adding loose fill blocks for **strong recurring patterns**. Trends are the lowest-priority source.
_Avoid_: pattern block, filler block, fill candidate (all superseded by this term + Strong recurring pattern)

**Strong recurring pattern**:
A project+service booked in ≥ 3 of the last 4 weeks on a cadence that lands on the target date. This is the only trend allowed to introduce a project that had _no_ observed activity that day. Detected deterministically (counts + cadence + historical average duration computed in TypeScript); the LLM may select and label from the detected list but never invents one.

**Fill target**:
The amount of booked time a day should reach — 8.0h total (a floor, not a ceiling), counting existing hours and meeting blocks toward it. The packer reaches it by first placing observed (absorbed, consolidated) blocks, then growing those blocks toward their historical share via trends, then adding strong-recurring-pattern fill blocks. Real work is never trimmed to stay under the target.

**Anchor**:
A block whose time is fixed and must not move during layout: meeting blocks and existing hours. Everything else is movable and gets repacked contiguously from 09:00 around the anchors.

### The week

**Ingediende week** (submitted week):
A week whose booked hours have been submitted to Simplicate for review. Submission locks the week: existing hours can no longer be changed, added, or deleted, and the week is treated as read-only. The submitted status is owned by Simplicate (the submission resource), not inferred locally. A submitted week is "afgerond" (done).
_Avoid_: verwerkte week (that means classified, not submitted).

**Verwerken** vs **indienen**:
Two distinct week actions. _Verwerken_ runs classification (activity → concept blocks); it writes nothing to Simplicate and is reversible. _Indienen_ submits the already-booked hours to Simplicate; it locks the week and is the final step. Order: verwerken → boeken → indienen.
