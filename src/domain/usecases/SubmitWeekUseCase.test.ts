import { describe, it, expect, vi } from 'vitest'
import { SubmitWeekUseCase } from './SubmitWeekUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

function makeRepo(): ISimplicateRepository {
  return {
    submitHours: vi.fn().mockResolvedValue(undefined),
    getSubmissions: vi.fn(),
  } as unknown as ISimplicateRepository
}

describe('SubmitWeekUseCase', () => {
  it('submits the Monday–Friday range for the employee', async () => {
    const repo = makeRepo()
    await new SubmitWeekUseCase(repo).execute('emp1', '2026-05-25', '2026-05-29')
    expect(repo.submitHours).toHaveBeenCalledWith('emp1', '2026-05-25', '2026-05-29')
  })

  it('throws when no employee is given', async () => {
    const repo = makeRepo()
    await expect(new SubmitWeekUseCase(repo).execute('', '2026-05-25', '2026-05-29'))
      .rejects.toThrow('medewerker')
    expect(repo.submitHours).not.toHaveBeenCalled()
  })

  it('throws when week bounds are missing', async () => {
    const repo = makeRepo()
    await expect(new SubmitWeekUseCase(repo).execute('emp1', '', ''))
      .rejects.toThrow('Weekgrenzen')
    expect(repo.submitHours).not.toHaveBeenCalled()
  })
})
