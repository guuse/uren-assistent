import { describe, it, expect, vi } from 'vitest'
import { FetchCalendarEventsUseCase } from '../FetchCalendarEventsUseCase'
import type { IGoogleCalendarRepository } from '../../repositories/IGoogleCalendarRepository'
import type { CalendarEvent } from '../../entities/CalendarEvent'

const start = new Date('2024-03-01T00:00:00')
const end = new Date('2024-03-01T23:59:59')

const mockEvent: CalendarEvent = {
  id: 'evt1',
  title: 'Sprint Planning',
  start: new Date('2024-03-01T10:00:00'),
  end: new Date('2024-03-01T11:00:00'),
  attendees: ['alice@co.nl'],
  status: 'accepted',
}

function makeRepo(overrides?: Partial<IGoogleCalendarRepository>): IGoogleCalendarRepository {
  return {
    fetchEvents: vi.fn().mockResolvedValue([mockEvent]),
    hasCalendarScope: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('FetchCalendarEventsUseCase', () => {
  it('returns events from repository', async () => {
    const repo = makeRepo()
    const uc = new FetchCalendarEventsUseCase(repo)
    const result = await uc.execute(start, end)
    expect(result).toEqual([mockEvent])
    expect(repo.fetchEvents).toHaveBeenCalledWith(start, end)
  })

  it('returns empty array when scope is missing', async () => {
    const repo = makeRepo({ hasCalendarScope: vi.fn().mockResolvedValue(false) })
    const uc = new FetchCalendarEventsUseCase(repo)
    const result = await uc.execute(start, end)
    expect(result).toEqual([])
    expect(repo.fetchEvents).not.toHaveBeenCalled()
  })

  it('returns empty array when fetchEvents throws', async () => {
    const repo = makeRepo({ fetchEvents: vi.fn().mockRejectedValue(new Error('network')) })
    const uc = new FetchCalendarEventsUseCase(repo)
    const result = await uc.execute(start, end)
    expect(result).toEqual([])
  })
})
