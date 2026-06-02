import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { HourEntry } from '../entities/HourEntry'
import type { TrendPatternsResult } from './computeTrendPatterns'

export interface PackDayOptions {
  /** Target booked hours for the day. Existing entries + meetings count toward it. Default 8. */
  targetHours?: number
  /** Time the packer starts placing movable blocks. Default '09:00'. */
  dayStart?: string
  /** Minute grid that start/end times snap to. Default 5. */
  gridMinutes?: number
  /**
   * End of the visible day. Movable work that can't start before this becomes a
   * leftover ('overflow') instead of being placed off-screen. Default '18:00'.
   */
  dayEnd?: string
  /**
   * Deterministic trend data (see ADR-0004). When supplied, the day is filled to
   * the target by first GROWING observed project blocks toward their historical
   * size, then adding fill blocks only for strong recurring patterns. When
   * omitted, no growth or fill happens — observed blocks are placed as-is.
   */
  trends?: TrendPatternsResult
}

interface Interval {
  start: number
  end: number
}

const EPSILON = 0.001

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const iv of sorted) {
    const last = merged[merged.length - 1]
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end)
    } else {
      merged.push({ ...iv })
    }
  }
  return merged
}

/** Earliest start >= `from` where a block of `duration` minutes fits without hitting any occupied interval. */
function nextFreeStart(from: number, duration: number, occupied: Interval[]): number {
  let cursor = from
  for (const iv of occupied) {
    if (cursor + duration <= iv.start) return cursor
    if (cursor < iv.end) cursor = iv.end
  }
  return cursor
}

const serviceKey = (b: { projectId?: string; serviceId?: string }): string => `${b.projectId}__${b.serviceId}`

const isMeeting = (b: ClassifiedBlock): boolean => !!b.overlappingMeetings && b.overlappingMeetings.length > 0

/**
 * Water-fills `gap` hours across growable blocks, proportional to each block's
 * weight, capped at each block's available room. Returns per-block growth (same
 * order as input) and the leftover gap that couldn't be absorbed.
 */
function distributeGrowth(
  items: { weight: number; room: number }[],
  gap: number,
): { growth: number[]; leftover: number } {
  const growth = items.map(() => 0)
  let remaining = gap
  let active = items.map((it, i) => (it.weight > EPSILON && it.room - growth[i]! > EPSILON ? i : -1)).filter(i => i >= 0)

  // At most one round per item: each round caps at least one block (or distributes the rest).
  for (let round = 0; round <= items.length && remaining > EPSILON && active.length > 0; round++) {
    const sumW = active.reduce((s, i) => s + items[i]!.weight, 0)
    if (sumW <= EPSILON) break
    let distributed = 0
    for (const i of active) {
      const want = (remaining * items[i]!.weight) / sumW
      const room = items[i]!.room - growth[i]!
      const add = Math.min(want, room)
      growth[i]! += add
      distributed += add
    }
    remaining -= distributed
    if (distributed <= EPSILON) break
    active = active.filter(i => items[i]!.room - growth[i]! > EPSILON)
  }

  return { growth, leftover: remaining }
}

/**
 * Lays a day's classified blocks onto the timeline so it reads as a clean, gap-free, ~8h day.
 *
 * - Anchors keep their fixed times: today's existing entries AND meeting blocks (calendar is the
 *   highest-priority source). Meetings may overlap each other — the timeline renders concurrent
 *   meetings side by side. Movable blocks (work, fill) flow around the union of all anchors.
 * - Concepts that duplicate an existing entry are dropped.
 * - With `trends` (ADR-0004): the gap to the target is filled FIRST by growing observed
 *   project blocks proportional to their historical share (capped at their historical average
 *   per-day duration), THEN — only if still short — by fill blocks for strong recurring patterns
 *   (≥3 of 4 weeks) whose project+service had no activity today.
 * - 8h is a floor, not a ceiling: real work is never trimmed.
 *
 * Existing entries are NOT returned — they're already booked; the packer only positions concepts.
 */
export interface PackedDay {
  /** Blocks laid onto the timeline. */
  placed: ClassifiedBlock[]
  /** Blocks classification found but the packer couldn't place — for the sidebar. */
  leftovers: ClassifiedBlock[]
}

export class PackDayUseCase {
  /** Backwards-compatible: returns only the placed blocks. */
  execute(blocks: ClassifiedBlock[], existingEntries: HourEntry[], options: PackDayOptions = {}): ClassifiedBlock[] {
    return this.executeWithLeftovers(blocks, existingEntries, options).placed
  }

  executeWithLeftovers(blocks: ClassifiedBlock[], existingEntries: HourEntry[], options: PackDayOptions = {}): PackedDay {
    const targetHours = options.targetHours ?? 8
    const dayStartMin = timeToMinutes(options.dayStart ?? '09:00')
    const dayEndMin = timeToMinutes(options.dayEnd ?? '18:00')
    const grid = options.gridMinutes ?? 5
    const trends = options.trends

    const snapDuration = (hours: number): number =>
      Math.max(grid, Math.round((hours * 60) / grid) * grid)

    const candidates = blocks.filter(b => b.origin === 'llm-pattern')
    // Everything else — including meeting blocks — is movable. Existing booked
    // entries are the only fixed anchors; even a meeting yields to a booked hour
    // rather than overlapping it, so the day stays in a single, overlap-free column.
    const concepts = blocks.filter(b => b.origin !== 'llm-pattern')

    // --- Dedup against already-booked entries ---
    const entriesByService = new Map<string, HourEntry[]>()
    for (const e of existingEntries) {
      const key = `${e.projectId}__${e.projectServiceId}`
      const list = entriesByService.get(key) ?? []
      list.push(e)
      entriesByService.set(key, list)
    }

    const isTimedConceptDuplicate = (b: ClassifiedBlock): boolean => {
      if (!b.projectId || !b.serviceId) return false
      const entries = entriesByService.get(serviceKey(b))
      if (!entries) return false
      const bs = timeToMinutes(b.startTime)
      const be = timeToMinutes(b.endTime)
      return entries.some(e => overlaps(bs, be, timeToMinutes(e.startTime), timeToMinutes(e.endTime)))
    }

    // Meetings are never dropped — calendar is the highest-priority source and the
    // user manually deselects what shouldn't be booked. Only non-meeting concepts
    // are deduplicated against already-booked entries.
    const keptConcepts = concepts.filter(b => isMeeting(b) || !isTimedConceptDuplicate(b))

    // Calendar is the highest-priority source: meeting blocks are anchored at
    // their real event times and never repacked. They may overlap each other —
    // the timeline renders concurrent meetings side by side (assignBlockColumns),
    // Google-Calendar style. Everything else is movable and flows around them.
    const anchoredMeetings = keptConcepts.filter(isMeeting)
    const movableConcepts = keptConcepts.filter(b => !isMeeting(b))

    const anchorHours = existingEntries.reduce((s, e) => s + e.hours, 0)
    const meetingHours = anchoredMeetings.reduce((s, b) => s + b.hours, 0)
    const movableObservedHours = movableConcepts.reduce((s, b) => s + b.hours, 0)
    const gap = targetHours - anchorHours - meetingHours - movableObservedHours

    // --- Grow phase: distribute the gap across observed (movable) project blocks ---
    // A meeting's duration is fixed by its calendar event, so meetings never grow.
    // A block without a historical average can't be sized, so it doesn't grow either.
    const grownMovable: ClassifiedBlock[] = movableConcepts.map(b => ({ ...b }))
    let leftoverGap = Math.max(0, gap)

    if (trends && gap > EPSILON) {
      const growable = grownMovable
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => b.projectId && b.serviceId && trends.byKey.has(serviceKey(b)))

      if (growable.length > 0) {
        const items = growable.map(({ b }) => {
          const pattern = trends.byKey.get(serviceKey(b))!
          const ceiling = Math.max(b.hours, pattern.avgDurationHours)
          return { weight: pattern.historicalShare, room: ceiling - b.hours }
        })
        const { growth, leftover } = distributeGrowth(items, gap)
        growable.forEach(({ i }, k) => {
          grownMovable[i]!.hours += growth[k]!
        })
        leftoverGap = leftover
      }
    }

    // --- Occupied zones: booked entries AND anchored meetings are fixed ---
    // Movable blocks flow around the union of both; meetings keep their own times
    // even where they overlap each other.
    let occupied: Interval[] = mergeIntervals([
      ...existingEntries.map(e => ({ start: timeToMinutes(e.startTime), end: timeToMinutes(e.endTime) })),
      ...anchoredMeetings.map(m => ({ start: timeToMinutes(m.startTime), end: timeToMinutes(m.endTime) })),
    ])

    let cursor = dayStartMin
    // Returns null when the block can't start before the day ends (overflow).
    const place = (hours: number): { startTime: string; endTime: string; minutes: number } | null => {
      const durMin = snapDuration(hours)
      const start = nextFreeStart(cursor, durMin, occupied)
      if (start >= dayEndMin) return null
      occupied = mergeIntervals([...occupied, { start, end: start + durMin }])
      cursor = start + durMin
      return { startTime: minutesToTime(start), endTime: minutesToTime(start + durMin), minutes: durMin }
    }

    const leftovers: ClassifiedBlock[] = []

    // Anchored meetings keep their real calendar times unchanged — never leftovers.
    const placedMeetings = anchoredMeetings.map(b => ({ ...b }))

    // --- Place movable concept blocks (with any growth) contiguously around fixed zones ---
    // Work that can no longer start before the day ends overflows to the sidebar
    // rather than being laid off-screen.
    const placedConcepts: ClassifiedBlock[] = []
    for (const b of [...grownMovable].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))) {
      const slot = place(b.hours)
      if (slot === null) {
        leftovers.push({ ...b, unplaced: true, leftoverReason: 'overflow' })
      } else {
        placedConcepts.push({ ...b, startTime: slot.startTime, endTime: slot.endTime, hours: slot.minutes / 60 })
      }
    }

    // --- Fill the remaining gap with strong recurring patterns only ---
    // A fill block is added only when the gap couldn't be absorbed by growing real
    // work, and only for a project+service that (a) is a strong recurring pattern,
    // (b) had no observed activity today, and (c) isn't already booked.
    const placedCandidates: ClassifiedBlock[] = []
    if (trends && leftoverGap > EPSILON) {
      const coveredKeys = new Set<string>(
        keptConcepts.filter(b => b.projectId && b.serviceId).map(serviceKey),
      )
      const eligible = candidates
        .filter(c => c.projectId && c.serviceId)
        .filter(c => !coveredKeys.has(serviceKey(c)))
        .filter(c => !entriesByService.has(serviceKey(c)))
        .filter(c => trends.byKey.get(serviceKey(c))?.isStrong === true)
        .sort((a, b) => {
          const pa = trends.byKey.get(serviceKey(a))!
          const pb = trends.byKey.get(serviceKey(b))!
          return pb.weeksPresent - pa.weeksPresent || pb.historicalShare - pa.historicalShare
        })

      for (const c of eligible) {
        if (leftoverGap <= EPSILON) break
        const pattern = trends.byKey.get(serviceKey(c))!
        const wanted = Math.min(pattern.avgDurationHours, leftoverGap)
        const slot = place(wanted)
        if (slot === null) break // day is full — remaining candidates surface as suggestions below
        placedCandidates.push({ ...c, startTime: slot.startTime, endTime: slot.endTime, hours: slot.minutes / 60 })
        leftoverGap -= slot.minutes / 60
      }
    }

    const placed = [...placedMeetings, ...placedConcepts, ...placedCandidates].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    )

    // --- Unused LLM suggestions become leftovers ---
    // Any candidate the day didn't need surfaces in the sidebar, deduped by
    // project+service against what's placed, already booked, or already collected.
    const placedKeys = new Set<string>(
      placed.filter(b => b.projectId && b.serviceId).map(serviceKey),
    )
    const seenSuggestion = new Set<string>()
    for (const c of candidates) {
      if (!c.projectId || !c.serviceId) continue
      const key = serviceKey(c)
      if (placedKeys.has(key) || entriesByService.has(key) || seenSuggestion.has(key)) continue
      seenSuggestion.add(key)
      leftovers.push({ ...c, unplaced: true, leftoverReason: 'suggestion' })
    }

    return { placed, leftovers }
  }
}
