---
status: accepted (amends ADR-0002)
---

# Deterministic pattern engine and grow-first fill

[ADR-0002](0002-deterministic-day-packer.md) deliberately kept trend/pattern judgment in the LLM (it rejected a pure deterministic packer because it "can't fit something based on last week's themes when unsure"). In practice the LLM over-detected patterns — it eyeballed weekly intervals from a text list of historical bookings and emitted a large `patternBlocks` fill list, so days filled up mostly from trends and genuine observed work got drowned out. We are moving pattern detection to deterministic TypeScript (a **hybrid** engine) and changing how the day is filled to the target.

The same reasoning ADR-0002 used to keep _placement_ deterministic ("LLMs are unreliable at no-overlap arithmetic and hitting exactly 8h") applies to pattern detection: "booked in ≥3 of the last 4 weeks on a matching cadence" and "historical average duration" are arithmetic, not judgment.

## Decision

- **Hybrid pattern engine.** TypeScript computes, per project+service over the last 4 weeks: occurrence count, whether its cadence lands on the target date, average duration, and historical daily share. The LLM may only _select and label_ from this computed list — it no longer invents `patternBlocks` or estimates durations.
- **A trend is the lowest-priority source.** It never creates or relabels observed work. It only reaches the 8h fill target, in this order:
  1. **Grow first** — distribute the gap to 8h across the day's existing observed project blocks, proportional to each project+service's historical share (blocks with no history get an equal share).
  2. **Then strong-pattern fill** — only if still short, add loose fill blocks for **strong recurring patterns** (booked ≥3 of last 4 weeks on matching cadence). This is the only path by which a project with _no_ observed activity that day may appear.
- The 8h target remains a floor, not a ceiling (unchanged from ADR-0002): observed work is never trimmed to stay under it.

## Considered options

- **Keep the LLM detecting patterns, just with stricter prompt rules** (count weeks, require cadence). Rejected: still arithmetic done by an LLM at temperature 0.1 over a truncated text list — the exact unreliability ADR-0002 cites for placement.
- **Fully deterministic patterns, no LLM involvement.** Rejected: contextual fit ("does this recurring booking actually make sense today?") is judgment worth keeping, so the LLM selects/labels from the computed candidates.

## Consequences

- The `classify-day` prompt no longer asks for a ranked `patternBlocks` fill list with `estimatedHours`/confidence; that contract is replaced by a TS-computed candidate list the LLM picks from. The prompt skill (`uren-classificatie`) and `GeminiRepository.classifyDay` change accordingly.
- `PackDayUseCase` gains the grow-first fill logic and the historical-share inputs; the old "ranked fill candidates until target" loop (and the ADR-0002 note that confidence ≥2 candidates are "added regardless") is superseded.
- "Fill candidate" disappears from the domain language, replaced by **Trends** + **Strong recurring pattern** (see CONTEXT.md).
