import type { HourEntry } from '../entities/HourEntry'

/**
 * A recurring project+service pattern derived deterministically from the last 4
 * weeks of bookings. This replaces the LLM's eyeballed pattern detection (see
 * ADR-0004): counting weeks and averaging durations is arithmetic, so TypeScript
 * owns it. The LLM may only select and label from these candidates.
 */
export interface TrendPattern {
  projectId: string
  serviceId: string
  /** Distinct weeks (of the last 4 before the target date) this combo appears in. */
  weeksPresent: number
  /** Distinct days this combo was booked on in the window. */
  daysActive: number
  /** Typical hours booked per active day — used to size growth and fill blocks. */
  avgDurationHours: number
  /** This combo's share of all booked hours in the window (0..1). Weights proportional growth. */
  historicalShare: number
  /** True when the pattern plausibly recurs on the target date (near-daily, or same weekday ≥2 weeks). */
  cadenceMatchesTarget: boolean
  /** weeksPresent ≥ 3 AND cadence matches — the only patterns allowed to introduce a no-activity project as fill. */
  isStrong: boolean
}

export interface TrendPatternsResult {
  /** All combos, highest historical share first. */
  patterns: TrendPattern[]
  /** Lookup by `${projectId}__${serviceId}`. */
  byKey: Map<string, TrendPattern>
  /** Strong recurring patterns only, strongest first. */
  strong: TrendPattern[]
}

const WINDOW_DAYS = 28

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** Whole days from `earlier` to `later` (positive when `later` is after `earlier`). */
function daysBetween(earlier: string, later: string): number {
  const ms = parseDate(later).getTime() - parseDate(earlier).getTime()
  return Math.round(ms / 86_400_000)
}

function key(projectId: string, serviceId: string): string {
  return `${projectId}__${serviceId}`
}

/**
 * Derives recurring project+service patterns from historical bookings.
 *
 * Only the 28 days strictly before `targetDate` count — the target day's own
 * entries are observed activity, not a trend. Weeks are 7-day buckets counting
 * back from the target.
 */
export function computeTrendPatterns(entries: HourEntry[], targetDate: string): TrendPatternsResult {
  const targetWeekday = parseDate(targetDate).getDay()

  interface Acc {
    projectId: string
    serviceId: string
    totalHours: number
    weeks: Set<number>
    days: Set<string>
    targetWeekdayWeeks: Set<number>
  }
  const accByKey = new Map<string, Acc>()

  for (const e of entries) {
    const diff = daysBetween(e.startDate, targetDate)
    // diff <= 0: the target day itself or the future — not a trend.
    // diff > WINDOW_DAYS: outside the 4-week window.
    if (diff <= 0 || diff > WINDOW_DAYS) continue

    const week = Math.floor((diff - 1) / 7) // 0..3
    const k = key(e.projectId, e.projectServiceId)
    let acc = accByKey.get(k)
    if (!acc) {
      acc = {
        projectId: e.projectId,
        serviceId: e.projectServiceId,
        totalHours: 0,
        weeks: new Set(),
        days: new Set(),
        targetWeekdayWeeks: new Set(),
      }
      accByKey.set(k, acc)
    }
    acc.totalHours += e.hours
    acc.weeks.add(week)
    acc.days.add(e.startDate)
    if (parseDate(e.startDate).getDay() === targetWeekday) acc.targetWeekdayWeeks.add(week)
  }

  const totalHoursAll = [...accByKey.values()].reduce((s, a) => s + a.totalHours, 0)

  const patterns: TrendPattern[] = [...accByKey.values()].map(a => {
    const weeksPresent = a.weeks.size
    const daysActive = a.days.size
    // Near-daily work (≥3 active days/week on average) plausibly recurs on any
    // weekday; otherwise require the same weekday in at least 2 of the weeks.
    const nearDaily = daysActive >= weeksPresent * 3
    const sameWeekday = a.targetWeekdayWeeks.size >= 2
    const cadenceMatchesTarget = nearDaily || sameWeekday
    return {
      projectId: a.projectId,
      serviceId: a.serviceId,
      weeksPresent,
      daysActive,
      avgDurationHours: a.totalHours / daysActive,
      historicalShare: totalHoursAll > 0 ? a.totalHours / totalHoursAll : 0,
      cadenceMatchesTarget,
      isStrong: weeksPresent >= 3 && cadenceMatchesTarget,
    }
  })

  patterns.sort((a, b) => b.historicalShare - a.historicalShare)

  const byKey = new Map(patterns.map(p => [key(p.projectId, p.serviceId), p]))
  const strong = patterns
    .filter(p => p.isStrong)
    .sort((a, b) => b.weeksPresent - a.weeksPresent || b.historicalShare - a.historicalShare)

  return { patterns, byKey, strong }
}

export const trendPatternKey = key
