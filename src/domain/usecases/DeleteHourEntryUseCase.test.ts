import { describe, it, expect, vi } from 'vitest'
import { DeleteHourEntryUseCase } from './DeleteHourEntryUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

function makeRepo(): ISimplicateRepository {
  return {
    bookHours: vi.fn(),
    getHourEntries: vi.fn(),
    getProjects: vi.fn(),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
    deleteHourEntry: vi.fn().mockResolvedValue(undefined),
  } as unknown as ISimplicateRepository
}

describe('DeleteHourEntryUseCase', () => {
  it('roept deleteHourEntry aan op de repository met het gegeven id', async () => {
    const repo = makeRepo()
    const useCase = new DeleteHourEntryUseCase(repo)
    await useCase.execute('hours:abc123')
    expect(repo.deleteHourEntry).toHaveBeenCalledWith('hours:abc123')
  })

  it('gooit een fout als id leeg is', async () => {
    const repo = makeRepo()
    const useCase = new DeleteHourEntryUseCase(repo)
    await expect(useCase.execute('')).rejects.toThrow('id ontbreekt')
  })

  it('gooit een fout als id undefined is', async () => {
    const repo = makeRepo()
    const useCase = new DeleteHourEntryUseCase(repo)
    await expect(useCase.execute(undefined as unknown as string)).rejects.toThrow('id ontbreekt')
  })
})
