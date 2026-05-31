import { describe, it, expect, vi } from 'vitest'
import { WithdrawSubmissionUseCase } from './WithdrawSubmissionUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

function makeRepo(): ISimplicateRepository {
  return {
    submitHours: vi.fn(),
    withdrawHours: vi.fn().mockResolvedValue(undefined),
    getSubmissions: vi.fn(),
  } as unknown as ISimplicateRepository
}

describe('WithdrawSubmissionUseCase', () => {
  it('withdraws the range for the employee', async () => {
    const repo = makeRepo()
    await new WithdrawSubmissionUseCase(repo).execute('emp1', '2026-05-25', '2026-05-29')
    expect(repo.withdrawHours).toHaveBeenCalledWith('emp1', '2026-05-25', '2026-05-29')
  })

  it('supports a single-day range', async () => {
    const repo = makeRepo()
    await new WithdrawSubmissionUseCase(repo).execute('emp1', '2026-05-27', '2026-05-27')
    expect(repo.withdrawHours).toHaveBeenCalledWith('emp1', '2026-05-27', '2026-05-27')
  })

  it('throws when no employee is given', async () => {
    const repo = makeRepo()
    await expect(new WithdrawSubmissionUseCase(repo).execute('', '2026-05-25', '2026-05-29'))
      .rejects.toThrow('medewerker')
    expect(repo.withdrawHours).not.toHaveBeenCalled()
  })

  it('throws when a week bound is missing', async () => {
    const repo = makeRepo()
    await expect(new WithdrawSubmissionUseCase(repo).execute('emp1', '', '2026-05-29'))
      .rejects.toThrow('Weekgrenzen')
    await expect(new WithdrawSubmissionUseCase(repo).execute('emp1', '2026-05-25', ''))
      .rejects.toThrow('Weekgrenzen')
    expect(repo.withdrawHours).not.toHaveBeenCalled()
  })
})
