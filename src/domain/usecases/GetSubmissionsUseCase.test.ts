import { describe, it, expect, vi } from 'vitest'
import { GetSubmissionsUseCase } from './GetSubmissionsUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourSubmission } from '../entities/HourSubmission'

const submissions: HourSubmission[] = [
  { id: 'sub1', startDate: '2026-05-18', endDate: '2026-05-24', status: 'submitted' } as unknown as HourSubmission,
]

function makeRepo(): ISimplicateRepository {
  return {
    getSubmissions: vi.fn().mockResolvedValue(submissions),
  } as unknown as ISimplicateRepository
}

describe('GetSubmissionsUseCase', () => {
  it('returns the submissions for the employee + date range', async () => {
    const repo = makeRepo()
    const uc = new GetSubmissionsUseCase(repo)
    const result = await uc.execute('emp1', '2026-05-18', '2026-05-24')
    expect(repo.getSubmissions).toHaveBeenCalledWith('emp1', '2026-05-18', '2026-05-24')
    expect(result).toBe(submissions)
  })

  it('short-circuits to an empty array when employeeId is empty', async () => {
    const repo = makeRepo()
    const uc = new GetSubmissionsUseCase(repo)
    const result = await uc.execute('', '2026-05-18', '2026-05-24')
    expect(result).toEqual([])
    expect(repo.getSubmissions).not.toHaveBeenCalled()
  })
})
