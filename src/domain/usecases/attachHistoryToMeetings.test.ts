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
    const blocks = [makeBlock('10:05', '10:10')]
    const events = [
      makeEvent('Morning', '09:30', '10:00'),  // ends 10:00, gap to block = 5min (within window)
      makeEvent('Midday', '10:15', '10:45'),   // starts 10:15, gap from block = 5min (within window)
    ]
    const { groups } = attachHistoryToMeetings(blocks, events)
    // block mid 10:07.5 — equidistant from Morning (09:45) and Midday (10:30), both 22.5 min
    // tie broken by earlier event = Morning
    expect(groups[0]!.historyBlocks).toHaveLength(1) // Morning gets it (earlier, tie)
    expect(groups[1]!.historyBlocks).toHaveLength(0) // Midday gets nothing
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

  it('claims a block within 15 min after a meeting ends', () => {
    const blocks = [makeBlock('09:20', '09:25')]
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, events)
    expect(groups[0]!.historyBlocks).toHaveLength(1)
    expect(unclaimed).toHaveLength(0)
  })

  it('never attaches a github.com commit-block to a meeting — always unclaimed', () => {
    // A commit block overlapping a meeting in time still stays standalone.
    const blocks = [makeBlock('09:00', '09:15', 'github.com/org/repo@09:00')]
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings(blocks, events)
    expect(groups[0]!.historyBlocks).toHaveLength(0)
    expect(unclaimed).toHaveLength(1)
    expect(unclaimed[0]!.urlPattern).toContain('github.com')
  })

  it('falls back to firstVisitTime when lastVisitTime is empty', () => {
    const block = { ...makeBlock('09:00', ''), lastVisitTime: '' }
    const events = [makeEvent('Standup', '09:00', '09:15')]
    const { groups, unclaimed } = attachHistoryToMeetings([block], events)
    expect(groups[0]!.historyBlocks).toHaveLength(1)
    expect(unclaimed).toHaveLength(0)
  })
})
