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
    // Simplicate stores start_date as 'YYYY-MM-DD HH:MM:SS'. The [le] filter does a
    // string comparison, so 'YYYY-MM-DD HH:MM:SS' > 'YYYY-MM-DD' — friday entries
    // would be excluded. Use saturday as exclusive upper bound instead.
    const weekEndInclusive = addDays(weekStart, 5) // zaterdag als exclusieve bovengrens
    const entries = await this.simplicateRepo.getHourEntries(employeeId, weekStart, weekEndInclusive)
    const grouped: Record<string, HourEntry[]> = {}
    for (const entry of entries) {
      const date = entry.startDate
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(entry)
    }
    return grouped
  }
}
