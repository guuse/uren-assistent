# Deterministic day-packer: LLM classifies, TypeScript places

The LLM returns only classification (name, project, service, confidence, fill candidates) — it never assigns block times. A deterministic TS packer (a domain use case) owns all time placement: it fixes anchors (meeting blocks + today's existing `HourEntry`s), drops concepts that duplicate an anchor, repacks the remaining movable blocks contiguously from 09:00 around the anchors, and pulls in ranked fill candidates until the day reaches an 8h fill target. 8h is a floor, not a ceiling: filler stops at 8h but real work is never dropped or trimmed.

This deliberately sacrifices fidelity to real activity timestamps for a clean, gap-free, full day — chosen because the user's priority is "create 8 bookable hours," not "show exactly when each thing happened." A future reader will see the LLM emit no times and a packer fabricate a tidy day that doesn't mirror the raw browser/calendar timeline; this is intentional.

## Considered options

- **Pure LLM placement** — extend the prompt + result contract so Gemini emits start/end/hours for every block. Rejected: LLMs are unreliable at no-overlap arithmetic and hitting exactly 8h, and it would still need today's bookings fed in.
- **Pure deterministic packer, prompt unchanged** — keep the LLM classifying only. Rejected: can't do "fit something based on last week's themes when unsure," which needs the LLM's judgment.

## Consequences

- `GroupAndClassifyDayUseCase` (or a new packing use case) gains today's `HourEntry`s as an input so it can anchor against and count existing hours toward 8h.
- The "pattern block" and new "filler" ideas are unified into one ranked fill-candidate list (see CONTEXT.md). High-confidence candidates are genuine recurring work; conf-1 candidates are filler used only to reach the target.
