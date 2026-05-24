import type { ISimplicateRepository, SimplicateProject } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface ActiveProjectsResult {
  activeProjects: SimplicateProject[]
  historicalEntries: HourEntry[]
}

export class GetActiveProjectsForDateUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(targetDate: string, employeeId: string): Promise<ActiveProjectsResult> {
    const windowStart = subtractDays(targetDate, 28)

    const [historicalEntries, allProjects] = await Promise.all([
      this.simplicateRepo.getHourEntries(employeeId, windowStart, targetDate),
      this.simplicateRepo.getProjects(),
    ])

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
}
