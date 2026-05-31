import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { HourEntry } from '../entities/HourEntry'

export interface PackDayOptions {
  /** Target booked hours for the day. Existing entries + meetings count toward it. Default 8. */
  targetHours?: number
  /** Time the packer starts placing movable blocks. Default '09:00'. */
  dayStart?: string
  /** Minute grid that start/end times snap to. Default 5. */
  gridMinutes?: number
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

/**
 * Lays a day's classified blocks onto the timeline so it reads as a clean, gap-free, ~8h day.
 *
 * - Anchors (meeting blocks + today's existing entries) keep their fixed times.
 * - Concepts that duplicate an existing entry are dropped.
 * - Movable blocks are repacked contiguously from `dayStart`, flowing around anchors.
 * - Fill candidates (origin 'llm-pattern') top the day up to `targetHours`: confidence >= 2
 *   is genuine recurring work added regardless; confidence 1 is filler used only to reach the
 *   target (the last one trimmed to land exactly on it).
 *
 * Existing entries are NOT returned — they're already booked; the packer only positions concepts.
 */
export class PackDayUseCase {
  execute(blocks: ClassifiedBlock[], existingEntries: HourEntry[], options: PackDayOptions = {}): ClassifiedBlock[] {
    const targetHours = options.targetHours ?? 8
    const dayStartMin = timeToMinutes(options.dayStart ?? '09:00')
    const grid = options.gridMinutes ?? 5

    const snapDuration = (hours: number): number =>
      Math.max(grid, Math.round((hours * 60) / grid) * grid)

    const candidates = blocks.filter(b => b.origin === 'llm-pattern')
    const meetings = blocks.filter(b => b.origin !== 'llm-pattern' && (b.overlappingMeetings?.length ?? 0) > 0)
    const movable = blocks.filter(b => b.origin !== 'llm-pattern' && (b.overlappingMeetings?.length ?? 0) === 0)

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
      const entries = entriesByService.get(`${b.projectId}__${b.serviceId}`)
      if (!entries) return false
      const bs = timeToMinutes(b.startTime)
      const be = timeToMinutes(b.endTime)
      return entries.some(e => overlaps(bs, be, timeToMinutes(e.startTime), timeToMinutes(e.endTime)))
    }

    const keptMeetings = meetings.filter(b => !isTimedConceptDuplicate(b))
    const keptMovable = movable.filter(b => !isTimedConceptDuplicate(b))
    // Fill candidates have no real time: drop if their project+service is already booked at all today.
    const keptCandidates = candidates.filter(b => !b.projectId || !b.serviceId || !entriesByService.has(`${b.projectId}__${b.serviceId}`))

    // --- Occupied zones from fixed anchors ---
    let occupied: Interval[] = mergeIntervals([
      ...existingEntries.map(e => ({ start: timeToMinutes(e.startTime), end: timeToMinutes(e.endTime) })),
      ...keptMeetings.map(m => ({ start: timeToMinutes(m.startTime), end: timeToMinutes(m.endTime) })),
    ])

    let cursor = dayStartMin
    const place = (hours: number): { startTime: string; endTime: string; minutes: number } => {
      const durMin = snapDuration(hours)
      const start = nextFreeStart(cursor, durMin, occupied)
      occupied = mergeIntervals([...occupied, { start, end: start + durMin }])
      cursor = start + durMin
      return { startTime: minutesToTime(start), endTime: minutesToTime(start + durMin), minutes: durMin }
    }

    // --- Repack movable blocks contiguously, preserving chronological order ---
    const placedMovable = [...keptMovable]
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      .map(b => {
        const { startTime, endTime } = place(b.hours)
        return { ...b, startTime, endTime }
      })

    let bookedHours =
      existingEntries.reduce((s, e) => s + e.hours, 0) +
      keptMeetings.reduce((s, m) => s + m.hours, 0) +
      placedMovable.reduce((s, b) => s + b.hours, 0)

    // --- Top up to the target with fill candidates (highest confidence first) ---
    // Fill candidates are invented, not observed, so they NEVER push the day past
    // the target: once observed work + anchors reach it, none are added. The last
    // one placed is trimmed so the day lands exactly on the target.
    const placedCandidates: ClassifiedBlock[] = []
    const sortedCandidates = [...keptCandidates].sort((a, b) => b.confidence - a.confidence)
    for (const c of sortedCandidates) {
      const remaining = targetHours - bookedHours
      if (remaining <= EPSILON) break
      const trimmedHours = Math.min(c.hours, remaining)
      const { startTime, endTime, minutes } = place(trimmedHours)
      placedCandidates.push({ ...c, startTime, endTime, hours: minutes / 60 })
      bookedHours += minutes / 60
    }

    return [...keptMeetings, ...placedMovable, ...placedCandidates].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    )
  }
}
