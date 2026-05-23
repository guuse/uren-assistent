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

export type TimelineRow = {
  startTime: string
  endTime: string
  left: TimelineBlock
  right?: TimelineBlock
}

export function mergeConceptsIntoTimeline(
  entries: HourEntry[],
  concepts: ClassifiedBlock[],
  dayStart: string,
  dayEnd: string,
): TimelineBlock[] {
  type EntryItem = { kind: 'entry'; startTime: string; endTime: string; entry: HourEntry }
  type ConceptItem = { kind: 'concept'; startTime: string; endTime: string; block: ClassifiedBlock; overlapping: boolean }
  type Item = EntryItem | ConceptItem

  // Concepts that overlap with a booked entry are marked as overlapping (not filtered out).
  const annotatedConcepts: ConceptItem[] = concepts.map(concept => {
    const cStart = timeToMinutes(concept.startTime)
    const cEnd = timeToMinutes(concept.endTime)
    const overlapping = entries.some(entry => {
      const eStart = timeToMinutes(entry.startTime)
      const eEnd = timeToMinutes(entry.endTime)
      return cStart < eEnd && cEnd > eStart
    })
    return { kind: 'concept' as const, startTime: concept.startTime, endTime: concept.endTime, block: concept, overlapping }
  })

  // Non-overlapping concepts join the main timeline stream
  const nonOverlappingConcepts = annotatedConcepts.filter(c => !c.overlapping)

  const items: Item[] = [
    ...entries.map(e => ({ kind: 'entry' as const, startTime: e.startTime, endTime: e.endTime, entry: e })),
    ...nonOverlappingConcepts,
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

  // Attach overlapping concepts as metadata on their entry blocks
  for (const c of annotatedConcepts.filter(c => c.overlapping)) {
    const cStart = timeToMinutes(c.startTime)
    const cEnd = timeToMinutes(c.endTime)
    const entryBlock = blocks.find(b => {
      if (b.type !== 'entry') return false
      const bStart = timeToMinutes(b.startTime)
      const bEnd = timeToMinutes(b.endTime)
      return cStart < bEnd && cEnd > bStart
    })
    if (entryBlock && entryBlock.type === 'entry') {
      ;(entryBlock as TimelineBlock & { overlappingConcept?: ClassifiedBlock }).overlappingConcept = c.block
    }
  }

  return blocks
}

/**
 * Converts a flat list of TimelineBlocks into TimelineRows suitable for two-column rendering.
 * Entry blocks that have an overlappingConcept attached get a `right` column with that concept.
 */
export function buildTimelineRows(blocks: TimelineBlock[]): TimelineRow[] {
  return blocks.map(block => {
    const extended = block as TimelineBlock & { overlappingConcept?: ClassifiedBlock }
    if (block.type === 'entry' && extended.overlappingConcept) {
      const concept = extended.overlappingConcept
      return {
        startTime: block.startTime,
        endTime: block.endTime,
        left: block,
        right: {
          type: 'concept' as const,
          startTime: concept.startTime,
          endTime: concept.endTime,
          block: concept,
        },
      }
    }
    return {
      startTime: block.startTime,
      endTime: block.endTime,
      left: block,
    }
  })
}
