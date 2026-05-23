import { describe, it, expect, vi } from 'vitest'
import { FetchLinearContextUseCase } from '../FetchLinearContextUseCase'
import type { ILinearRepository } from '../../repositories/ILinearRepository'
import type { LinearIssue } from '../../entities/LinearIssue'

const mockIssues: LinearIssue[] = [
  { identifier: 'ENG-42', title: 'Booking modal redesign', completedAt: '2026-05-20T14:00:00Z', url: 'https://linear.app/eng/issue/ENG-42' },
]

const mockRepo: ILinearRepository = {
  getCompletedIssuesForWeek: vi.fn().mockResolvedValue(mockIssues),
}

describe('FetchLinearContextUseCase', () => {
  it('delegates to repository and returns issues', async () => {
    const useCase = new FetchLinearContextUseCase(mockRepo)
    const result = await useCase.execute('2026-05-19', '2026-05-23')
    expect(result).toEqual(mockIssues)
    expect(mockRepo.getCompletedIssuesForWeek).toHaveBeenCalledWith('2026-05-19', '2026-05-23')
  })

  it('returns empty array when repository throws', async () => {
    const failRepo: ILinearRepository = {
      getCompletedIssuesForWeek: vi.fn().mockRejectedValue(new Error('401')),
    }
    const useCase = new FetchLinearContextUseCase(failRepo)
    const result = await useCase.execute('2026-05-19', '2026-05-23')
    expect(result).toEqual([])
  })
})
