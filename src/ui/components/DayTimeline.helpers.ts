import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

export type TimelineBlock =
  | { type: 'entry'; startTime: string; endTime: string; entry: HourEntry; suggestion?: never; block?: never }
  | { type: 'gap'; startTime: string; endTime: string; entry?: never; suggestion?: HourEntrySuggestion; block?: never }
  | { type: 'concept'; startTime: string; endTime: string; entry?: never; suggestion?: never; block: ClassifiedBlock }

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export function computeTimelineBlocks(
  entries: HourEntry[],
  suggestions: HourEntrySuggestion[],
  dayStart: string,
  dayEnd: string,
): TimelineBlock[] {
  const sorted = [...entries].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  )

  const blocks: TimelineBlock[] = []
  let cursor = timeToMinutes(dayStart)
  const end = timeToMinutes(dayEnd)

  for (const entry of sorted) {
    const entryStart = timeToMinutes(entry.startTime)
    const entryEnd = timeToMinutes(entry.endTime)

    if (entryStart > cursor) {
      blocks.push({ type: 'gap', startTime: minutesToTime(cursor), endTime: minutesToTime(entryStart) })
    }
    blocks.push({ type: 'entry', startTime: entry.startTime, endTime: entry.endTime, entry })
    cursor = entryEnd
  }

  if (cursor < end) {
    blocks.push({ type: 'gap', startTime: minutesToTime(cursor), endTime: minutesToTime(end) })
  }

  // Koppel suggesties aan gaten
  const usedSuggestions = new Set<number>()
  for (const block of blocks) {
    if (block.type !== 'gap') continue

    const gapStart = timeToMinutes(block.startTime)
    const gapEnd = timeToMinutes(block.endTime)

    // Zoek suggestie waarvan startTime in dit gat valt
    const matchIdx = suggestions.findIndex((s, i) => {
      if (usedSuggestions.has(i)) return false
      if (!s.startTime) return false
      const st = timeToMinutes(s.startTime)
      return st >= gapStart && st < gapEnd
    })

    if (matchIdx !== -1) {
      block.suggestion = suggestions[matchIdx]!
      usedSuggestions.add(matchIdx)
    } else {
      // Eerste ongebruikte suggestie zonder startTime (geen voorkeur voor gat)
      const firstIdx = suggestions.findIndex((s, i) => !usedSuggestions.has(i) && !s.startTime)
      if (firstIdx !== -1) {
        block.suggestion = suggestions[firstIdx]!
        usedSuggestions.add(firstIdx)
      }
    }
  }

  return blocks
}

export function mergeConceptsIntoTimeline(
  entries: HourEntry[],
  concepts: ClassifiedBlock[],
  dayStart: string,
  dayEnd: string,
): TimelineBlock[] {
  type Item =
    | { kind: 'entry'; startTime: string; endTime: string; entry: HourEntry }
    | { kind: 'concept'; startTime: string; endTime: string; block: ClassifiedBlock }

  const items: Item[] = [
    ...entries.map(e => ({ kind: 'entry' as const, startTime: e.startTime, endTime: e.endTime, entry: e })),
    ...concepts.map(c => ({ kind: 'concept' as const, startTime: c.startTime, endTime: c.endTime, block: c })),
  ].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

  const blocks: TimelineBlock[] = []
  let cursor = timeToMinutes(dayStart)
  const end = timeToMinutes(dayEnd)

  for (const item of items) {
    const itemStart = timeToMinutes(item.startTime)
    const itemEnd = timeToMinutes(item.endTime)
    if (itemStart > cursor) {
      blocks.push({ type: 'gap', startTime: minutesToTime(cursor), endTime: minutesToTime(itemStart) })
    }
    if (item.kind === 'entry') {
      blocks.push({ type: 'entry', startTime: item.startTime, endTime: item.endTime, entry: item.entry })
    } else {
      blocks.push({ type: 'concept', startTime: item.startTime, endTime: item.endTime, block: item.block })
    }
    cursor = Math.max(cursor, itemEnd)
  }

  if (cursor < end) {
    blocks.push({ type: 'gap', startTime: minutesToTime(cursor), endTime: minutesToTime(end) })
  }

  return blocks
}
