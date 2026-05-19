import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookTemplateUseCase } from '../../../src/domain/usecases/BookTemplateUseCase'
import type { ISimplicateRepository } from '../../../src/domain/repositories/ISimplicateRepository'
import type { RecurringTemplate } from '../../../src/domain/entities/Template'

const mockRepo: ISimplicateRepository = {
  getProjects: vi.fn(),
  getServices: vi.fn(),
  getHourTypes: vi.fn(),
  getEmployee: vi.fn(),
  bookHours: vi.fn(),
}

const recurringTemplate: RecurringTemplate = {
  id: '1', name: 'Standup', type: 'recurring', color: '#6c63ff',
  startTime: '09:00', endTime: '09:30',
  projectId: 'p1', serviceId: 's1', hourTypeId: 'h1',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
}

describe('BookTemplateUseCase', () => {
  let useCase: BookTemplateUseCase

  beforeEach(() => {
    useCase = new BookTemplateUseCase(mockRepo)
    vi.clearAllMocks()
    vi.mocked(mockRepo.bookHours).mockResolvedValue(undefined)
  })

  it('books 5 entries for a recurring template (full week)', async () => {
    await useCase.execute({
      template: recurringTemplate,
      employeeId: 'emp1',
      note: 'Standup',
      weekStartDate: '2026-05-18', // Monday
    })
    expect(mockRepo.bookHours).toHaveBeenCalledTimes(1)
    const entries = vi.mocked(mockRepo.bookHours).mock.calls[0]?.[0] ?? []
    expect(entries).toHaveLength(5)
    expect(entries[0]).toMatchObject({
      employeeId: 'emp1',
      projectServiceId: 's1',
      hourTypeId: 'h1',
      startDate: '2026-05-18',
      startTime: '09:00',
      endTime: '09:30',
      note: 'Standup',
    })
    expect(entries[4]).toMatchObject({ startDate: '2026-05-22' })
  })

  it('throws when required fields are missing', async () => {
    const { projectId: _p, serviceId: _s, ...rest } = recurringTemplate
    const incomplete: typeof recurringTemplate = { ...rest } as typeof recurringTemplate
    await expect(
      useCase.execute({ template: incomplete, employeeId: 'emp1', note: '', weekStartDate: '2026-05-18' }),
    ).rejects.toThrow('Missing required fields: projectId, serviceId')
  })
})
