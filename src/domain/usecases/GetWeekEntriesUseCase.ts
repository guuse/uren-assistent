import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

export class GetWeekEntriesUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  // weekStart: ISO datum van de maandag van de gewenste week (YYYY-MM-DD)
  async execute(employeeId: string, weekStart: string): Promise<Record<string, HourEntry[]>> {
    const weekEnd = addDays(weekStart, 4) // vrijdag
    const entries = await this.simplicateRepo.getHourEntries(employeeId, weekStart, weekEnd)
    const grouped: Record<string, HourEntry[]> = {}
    for (const entry of entries) {
      const date = entry.startDate
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(entry)
    }
    return grouped
  }
}
