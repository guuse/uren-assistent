import { describe, it, expect, vi } from 'vitest'
import { BookHoursUseCase } from './BookHoursUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function makeRepo(): ISimplicateRepository {
  return {
    bookHours: vi.fn().mockResolvedValue(undefined),
    getHourEntries: vi.fn(),
    getProjects: vi.fn(),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
  } as unknown as ISimplicateRepository
}

function validEntry(): HourEntry {
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
  }
}

describe('BookHoursUseCase', () => {
  it('boekt een geldige entry via de repository', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    await useCase.execute(validEntry())
    expect(repo.bookHours).toHaveBeenCalledWith([validEntry()])
  })

  it('gooit een fout als projectId ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    const entry = { ...validEntry(), projectId: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('projectId')
  })

  it('gooit een fout als projectServiceId ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    const entry = { ...validEntry(), projectServiceId: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('projectServiceId')
  })

  it('gooit een fout als hourTypeId ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    const entry = { ...validEntry(), hourTypeId: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('hourTypeId')
  })

  it('gooit een fout als startDate ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new BookHoursUseCase(repo)
    const entry = { ...validEntry(), startDate: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('startDate')
  })
})
