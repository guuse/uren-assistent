import { describe, it, expect, vi } from 'vitest'
import { ClassifyCalendarBlocksUseCase } from '../ClassifyCalendarBlocksUseCase'
import type { CalendarEvent } from '../../entities/CalendarEvent'
import type { Project, Service } from '../../repositories/ICopilotRepository'

const event: CalendarEvent = {
  id: 'evt1',
  title: 'Sprint Planning',
  start: new Date('2024-03-01T10:00:00'),
  end: new Date('2024-03-01T11:00:00'),
  attendees: ['alice@co.nl'],
  status: 'accepted',
}

const projects: Project[] = [{ id: 'p1', name: 'Acme' }]
const services: Service[] = [{ id: 's1', name: 'Development', projectId: 'p1' }]

describe('ClassifyCalendarBlocksUseCase', () => {
  it('returns a CalendarBlock for each event with pre-filled blockName', async () => {
    const classifyMock = vi.fn().mockResolvedValue([
      {
        urlPattern: 'calendar:evt1',
        blockName: 'Sprint Planning',
        summary: 'Sprint planning sessie',
        projectId: 'p1',
        serviceId: 's1',
        note: '',
        confidence: 0.8,
        origin: 'calendar' as const,
        date: '2024-03-01',
        urls: [],
        titles: ['Sprint Planning'],
        visitCount: 0,
        firstVisitTime: '10:00',
        lastVisitTime: '11:00',
        hours: 1,
        startTime: '10:00',
        endTime: '11:00',
      },
    ])
    const copilotRepo = { classify: classifyMock }
    const uc = new ClassifyCalendarBlocksUseCase(copilotRepo as never)
    const result = await uc.execute([event], projects, services)
    expect(result).toHaveLength(1)
    expect(result[0]!.calendarEventId).toBe('evt1')
    expect(result[0]!.origin).toBe('calendar')
    expect(result[0]!.blockName).toBe('Sprint Planning')
  })

  it('returns empty array for empty events input', async () => {
    const copilotRepo = { classify: vi.fn() }
    const uc = new ClassifyCalendarBlocksUseCase(copilotRepo as never)
    const result = await uc.execute([], projects, services)
    expect(result).toEqual([])
    expect(copilotRepo.classify).not.toHaveBeenCalled()
  })
})
