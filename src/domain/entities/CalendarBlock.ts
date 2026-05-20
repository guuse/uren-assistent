import type { CalendarEvent } from './CalendarEvent'
import type { ClassifiedBlock } from './ClassifiedBlock'

/**
 * A bookable block sourced from a Google Calendar event.
 * Extends ClassifiedBlock so it can flow through the same review UI.
 * `urlPattern` is set to `calendar:<eventId>` — a stable synthetic key.
 */
export interface CalendarBlock extends ClassifiedBlock {
  origin: 'calendar'
  calendarEventId: string
}

export function calendarEventToBlock(event: CalendarEvent): CalendarBlock {
  const pad = (n: number) => String(n).padStart(2, '0')
  const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const hours = Math.max(0.5, Math.round(((event.end.getTime() - event.start.getTime()) / 3600000) * 2) / 2)
  const date = event.start.toISOString().slice(0, 10)

  return {
    // HistoryBlock fields
    date,
    urlPattern: `calendar:${event.id}`,
    urls: [],
    titles: [event.title],
    visitCount: 0,
    firstVisitTime: toTime(event.start),
    lastVisitTime: toTime(event.end),
    hours,
    // ClassifiedBlock fields
    blockName: event.title,
    summary: '',
    startTime: toTime(event.start),
    endTime: toTime(event.end),
    confidence: 0,
    origin: 'calendar',
    // CalendarBlock fields
    calendarEventId: event.id,
  }
}
