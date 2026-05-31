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
A concept block anchored to a calendar event; its start/end come from the event and are treated as fixed.

**Fill candidate**:
A concept block the LLM invents from recurring history (a project+service that recurs at regular intervals) rather than from observed activity. Origin `llm-pattern`. Returned as an ordered list with a confidence and `estimatedHours`. High-confidence candidates are genuine recurring work added regardless; the lowest-confidence ones (conf 1) are filler, pulled in only when the day is short of the fill target.
_Avoid_: pattern block, filler block (both are now this one concept)

**Fill target**:
The amount of booked time a day should reach — 8.0h total, counting existing hours and meeting blocks toward it. The packer fills the remainder with movable concept blocks, then with fill candidates until the target is met.

**Anchor**:
A block whose time is fixed and must not move during layout: meeting blocks and existing hours. Everything else is movable and gets repacked contiguously from 09:00 around the anchors.

### The week

**Ingediende week** (submitted week):
A week whose booked hours have been submitted to Simplicate for review. Submission locks the week: existing hours can no longer be changed, added, or deleted, and the week is treated as read-only. The submitted status is owned by Simplicate (the submission resource), not inferred locally. A submitted week is "afgerond" (done).
_Avoid_: verwerkte week (that means classified, not submitted).

**Verwerken** vs **indienen**:
Two distinct week actions. _Verwerken_ runs classification (activity → concept blocks); it writes nothing to Simplicate and is reversible. _Indienen_ submits the already-booked hours to Simplicate; it locks the week and is the final step. Order: verwerken → boeken → indienen.
