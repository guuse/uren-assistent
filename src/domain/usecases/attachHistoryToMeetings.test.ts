import { describe, it, expect } from 'vitest'
import { attachHistoryToMeetings } from './attachHistoryToMeetings'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'

function makeBlock(firstVisitTime: string, lastVisitTime: string, urlPattern = 'example.com'): HistoryBlock {
  return {
    date: '2026-05-20',
    urlPattern,
    urls: [urlPattern],
    titles: ['Test'],
    visitCount: 5,
    firstVisitTime,
    lastVisitTime,
    hours: 0.5,
  }
}

function makeEvent(title: string, startHHMM: string, endHHMM: string): CalendarEvent {
  const [sh, sm] = startHHMM.split(':').map(Number) as [number, number]
  const [eh, em] = endHHMM.split(':').map(Number) as [number, number]
  const base = new Date('2026-05-20T00:00:00')
  const start = new Date(base); start.setHours(sh, sm, 0, 0)
  const end = new Date(base); end.setHours(eh, em, 0, 0)
  return { id: title, title, start, end, attendees: [], status: 'accepted' }
}

describe('attachHistoryToMeetings', () => {
  it('claims a block that overlaps a meeting', () => {
    const blocks = [makeBlock('09:00', '09:15')]
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, events)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.historyBlocks).toHaveLength(1)
    expect(unclaimed).toHaveLength(0)
  })

  it('claims a block within 15 min before a meeting', () => {
    const blocks = [makeBlock('08:50', '08:55')]
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, events)
    expect(groups[0]!.historyBlocks).toHaveLength(1)
    expect(unclaimed).toHaveLength(0)
  })

  it('leaves a block outside 15 min window as unclaimed', () => {
    const blocks = [makeBlock('08:00', '08:30')]
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, events)
    expect(groups[0]!.historyBlocks).toHaveLength(0)
    expect(unclaimed).toHaveLength(1)
  })

  it('assigns a block to the nearest of two meetings', () => {
    const blocks = [makeBlock('10:00', '10:05')]
    const events = [
      makeEvent('Morning', '09:00', '09:30'),  // midpoint 09:15, distance to block mid 10:02 = 47min
      makeEvent('Midday', '10:30', '11:00'),   // midpoint 10:45, distance = 43min
    ]
    const { groups } = attachHistoryToMeetings(blocks, events)
    // block midpoint 10:02 — closer to Midday (10:45) than Morning (09:15)
    expect(groups[0]!.historyBlocks).toHaveLength(0) // Morning gets nothing
    expect(groups[1]!.historyBlocks).toHaveLength(1) // Midday gets it
  })

  it('handles zero events — all blocks unclaimed', () => {
    const blocks = [makeBlock('10:00', '10:30')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, [])
    expect(groups).toHaveLength(0)
    expect(unclaimed).toHaveLength(1)
  })

  it('handles zero blocks — groups have empty historyBlocks', () => {
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings([], events)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.historyBlocks).toHaveLength(0)
    expect(unclaimed).toHaveLength(0)
  })

  it('each block is claimed by at most one meeting', () => {
    const blocks = [makeBlock('09:10', '09:20')]
    const events = [
      makeEvent('A', '09:00', '09:15'),
      makeEvent('B', '09:15', '09:30'),
    ]
    const { groups } = attachHistoryToMeetings(blocks, events)
    const totalClaimed = groups.reduce((sum, g) => sum + g.historyBlocks.length, 0)
    expect(totalClaimed).toBe(1)
  })
})
