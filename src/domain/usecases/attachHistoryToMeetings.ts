import type { HistoryBlock } from '../entities/HistoryBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'

export interface MeetingGroup {
  event: CalendarEvent
  historyBlocks: HistoryBlock[]
}

export interface AttachResult {
  groups: MeetingGroup[]
  unclaimed: HistoryBlock[]
}

const ATTACH_MINUTES = 15

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return h * 60 + m
}

function eventToMinutes(ev: CalendarEvent): { start: number; end: number; mid: number } {
  const start = ev.start.getHours() * 60 + ev.start.getMinutes()
  const end = ev.end.getHours() * 60 + ev.end.getMinutes()
  return { start, end, mid: (start + end) / 2 }
}

export function attachHistoryToMeetings(
  blocks: HistoryBlock[],
  events: CalendarEvent[],
): AttachResult {
  if (events.length === 0) {
    return { groups: [], unclaimed: [...blocks] }
  }

  const eventWindows = events.map(ev => eventToMinutes(ev))
  const groups: MeetingGroup[] = events.map(event => ({ event, historyBlocks: [] }))
  const unclaimed: HistoryBlock[] = []

  for (const block of blocks) {
    // Commit-blocks (github.com/...) worden nooit aan meetings gekoppeld — altijd standalone
    if (block.urlPattern.startsWith('github.com/')) {
      unclaimed.push(block)
      continue
    }

    const blockStart = toMinutes(block.firstVisitTime)
    const blockEnd = toMinutes(block.lastVisitTime || block.firstVisitTime)
    const blockMid = (blockStart + blockEnd) / 2

    const candidates: { idx: number; distance: number }[] = []
    for (let i = 0; i < eventWindows.length; i++) {
      const ev = eventWindows[i]!
      // Attach if block overlaps the event window extended by ATTACH_MINUTES on each side.
      // This captures both: browsing *before* a meeting starts, and wrap-up *after* it ends.
      const attachable =
        blockStart < ev.end + ATTACH_MINUTES &&
        blockEnd > ev.start - ATTACH_MINUTES
      if (attachable) {
        candidates.push({ idx: i, distance: Math.abs(blockMid - ev.mid) })
      }
    }

    if (candidates.length === 0) {
      unclaimed.push(block)
      continue
    }

    candidates.sort((a, b) => a.distance - b.distance || a.idx - b.idx)
    groups[candidates[0]!.idx]!.historyBlocks.push(block)
  }

  return { groups, unclaimed }
}
