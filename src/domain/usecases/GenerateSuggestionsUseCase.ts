import type { HourEntry } from '../entities/HourEntry'
import type { HourEntrySuggestion } from '../entities/HourEntrySuggestion'

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]!
}

function combinationKey(e: HourEntry): string {
  return `${e.projectId}|${e.projectServiceId}|${e.hourTypeId}`
}

export class GenerateSuggestionsUseCase {
  // targetDate: de dag waarvoor suggesties gegenereerd worden (YYYY-MM-DD)
  // historicalEntries: alle entries van de afgelopen 4+ weken (al gefilterd op medewerker)
  execute(targetDate: string, historicalEntries: HourEntry[]): HourEntrySuggestion[] {
    // Bereken de 4 vorige gelijke weekdagen
    const previousSameDays = [7, 14, 21, 28].map((daysBack) =>
      subtractDays(targetDate, daysBack),
    )
    const lastWeekDate = previousSameDays[0]!

    // Filter entries die op een van de 4 vorige gelijke weekdagen vallen
    const relevantEntries = historicalEntries.filter((e) =>
      previousSameDays.includes(e.startDate),
    )

    // Groepeer per combinatie
    type CombinationData = {
      dates: Set<string>
      mostRecentDate: string
      mostRecentEntry: HourEntry
    }
    const byKey = new Map<string, CombinationData>()

    for (const entry of relevantEntries) {
      const key = combinationKey(entry)
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, {
          dates: new Set([entry.startDate]),
          mostRecentDate: entry.startDate,
          mostRecentEntry: entry,
        })
      } else {
        existing.dates.add(entry.startDate)
        if (entry.startDate > existing.mostRecentDate) {
          existing.mostRecentDate = entry.startDate
          existing.mostRecentEntry = entry
        }
      }
    }

    const suggestions: HourEntrySuggestion[] = []

    for (const [key, data] of byKey.entries()) {
      const isLastWeek = data.dates.has(lastWeekDate)
      const isPattern = data.dates.size >= 2

      if (!isLastWeek && !isPattern) continue

      const [projectId, projectServiceId, hourTypeId] = key.split('|') as [string, string, string]
      suggestions.push({
        projectId,
        projectServiceId,
        hourTypeId,
        startTime: data.mostRecentEntry.startTime,
        endTime: data.mostRecentEntry.endTime,
        reason: isLastWeek ? 'last-week' : 'pattern',
        occurrences: data.dates.size,
      })
    }

    // Sorteer: last-week eerst, dan op occurrences desc
    suggestions.sort((a, b) => {
      if (a.reason === 'last-week' && b.reason !== 'last-week') return -1
      if (b.reason === 'last-week' && a.reason !== 'last-week') return 1
      return b.occurrences - a.occurrences
    })

    return suggestions
  }
}
