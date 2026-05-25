import { describe, it, expect, vi } from 'vitest'
import { UpdateHourEntryUseCase } from './UpdateHourEntryUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function makeRepo(): ISimplicateRepository {
  return {
    bookHours: vi.fn(),
    getHourEntries: vi.fn(),
    getProjects: vi.fn(),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
    deleteHourEntry: vi.fn(),
    updateHourEntry: vi.fn().mockResolvedValue(undefined),
  } as unknown as ISimplicateRepository
}

function validEntry(): HourEntry {
  return {
    id: 'hours:abc123',
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-25',
    startTime: '09:00',
    endTime: '11:00',
    note: '',
  }
}

describe('UpdateHourEntryUseCase', () => {
  it('roept updateHourEntry aan op de repository met het volledige entry object', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = validEntry()
    await useCase.execute(entry)
    expect(repo.updateHourEntry).toHaveBeenCalledWith(entry)
  })

  it('gooit een fout als id ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = { ...validEntry(), id: undefined }
    await expect(useCase.execute(entry)).rejects.toThrow('id ontbreekt')
  })

  it('gooit een fout als id leeg is', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = { ...validEntry(), id: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('id ontbreekt')
  })

  it('gooit een fout als projectId ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = { ...validEntry(), projectId: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('projectId')
  })

  it('gooit een fout als startDate ontbreekt', async () => {
    const repo = makeRepo()
    const useCase = new UpdateHourEntryUseCase(repo)
    const entry = { ...validEntry(), startDate: '' }
    await expect(useCase.execute(entry)).rejects.toThrow('startDate')
  })
})
