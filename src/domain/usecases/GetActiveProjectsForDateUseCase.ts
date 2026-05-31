import type { ISimplicateRepository, SimplicateProject } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

export function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addDays(dateStr: string, days: number): string {
  return subtractDays(dateStr, -days)
}

export interface ActiveProjectsResult {
  activeProjects: SimplicateProject[]
  historicalEntries: HourEntry[]
}

/**
 * Derives the projects a developer has booked on in the 28 days up to (and
 * including) `targetDate`, ranked by booking frequency, plus those entries.
 *
 * `computeFromData` is the pure core; `execute` fetches and delegates. The pure
 * variant lets a week run fetch the whole window once and slice it per day.
 */
export class GetActiveProjectsForDateUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  static computeFromData(
    targetDate: string,
    historicalSuperset: HourEntry[],
    allProjects: SimplicateProject[],
  ): ActiveProjectsResult {
    const windowStart = subtractDays(targetDate, 28)
    const historicalEntries = historicalSuperset.filter(
      e => e.startDate >= windowStart && e.startDate <= targetDate,
    )

    const bookingCountByProject = new Map<string, number>()
    for (const entry of historicalEntries) {
      bookingCountByProject.set(
        entry.projectId,
        (bookingCountByProject.get(entry.projectId) ?? 0) + 1,
      )
    }

    const activeProjectIds = new Set(bookingCountByProject.keys())

    const activeProjects = allProjects
      .filter(p => activeProjectIds.has(p.id))
      .sort((a, b) => (bookingCountByProject.get(b.id) ?? 0) - (bookingCountByProject.get(a.id) ?? 0))

    return { activeProjects, historicalEntries }
  }

  async execute(targetDate: string, employeeId: string): Promise<ActiveProjectsResult> {
    const windowStart = subtractDays(targetDate, 28)

    const [historicalEntries, allProjects] = await Promise.all([
      // Simplicate's [le] filter compares 'YYYY-MM-DD HH:MM:SS' against the bound,
      // so a date-only upper bound drops the target day's own entries. Use the next
      // day as an inclusive bound; computeFromData re-windows by date afterwards.
      this.simplicateRepo.getHourEntries(employeeId, windowStart, addDays(targetDate, 1)),
      this.simplicateRepo.getProjects(),
    ])

    return GetActiveProjectsForDateUseCase.computeFromData(targetDate, historicalEntries, allProjects)
  }
}
