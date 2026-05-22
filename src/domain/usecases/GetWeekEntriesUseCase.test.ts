import { describe, it, expect, vi } from 'vitest'
import { GetWeekEntriesUseCase } from './GetWeekEntriesUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function makeEntry(overrides: Partial<HourEntry> = {}): HourEntry {
  return {
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-19',
    startTime: '09:00',
    endTime: '11:00',
    note: '',
    ...overrides,
  }
}

function makeRepo(entries: HourEntry[]): ISimplicateRepository {
  return {
    getHourEntries: vi.fn().mockResolvedValue(entries),
    getProjects: vi.fn(),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
    bookHours: vi.fn(),
  } as unknown as ISimplicateRepository
}

describe('GetWeekEntriesUseCase', () => {
  it('groepeert entries per datum', async () => {
    const entries = [
      makeEntry({ startDate: '2026-05-19' }),
      makeEntry({ startDate: '2026-05-19', startTime: '13:00', endTime: '15:00' }),
      makeEntry({ startDate: '2026-05-20' }),
    ]
    const repo = makeRepo(entries)
    const useCase = new GetWeekEntriesUseCase(repo)
    const result = await useCase.execute('emp1', '2026-05-18')

    expect(result['2026-05-19']).toHaveLength(2)
    expect(result['2026-05-20']).toHaveLength(1)
  })

  it('roept repo aan met maandag tot vrijdag van de gegeven week', async () => {
    const repo = makeRepo([])
    const useCase = new GetWeekEntriesUseCase(repo)
    await useCase.execute('emp1', '2026-05-18')

    expect(repo.getHourEntries).toHaveBeenCalledWith('emp1', '2026-05-18', '2026-05-22')
  })

  it('geeft lege records terug als er geen entries zijn', async () => {
    const repo = makeRepo([])
    const useCase = new GetWeekEntriesUseCase(repo)
    const result = await useCase.execute('emp1', '2026-05-18')

    expect(result).toEqual({})
  })
})
