import { describe, it, expect, vi } from 'vitest'
import { FetchGitHubContextUseCase } from '../FetchGitHubContextUseCase'
import type { IGitHubRepository } from '../../repositories/IGitHubRepository'
import type { GitHubCommit } from '../../entities/GitHubCommit'

const mockCommits: GitHubCommit[] = [
  { sha: 'abc', message: 'feat: add ESC close', repo: 'guuse/uren-schrijven', branch: 'main', timestamp: '2026-05-20T10:23:00Z', time: '10:23' },
  { sha: 'def', message: 'fix: drag logic', repo: 'guuse/uren-schrijven', branch: 'main', timestamp: '2026-05-21T11:47:00Z', time: '11:47' },
]

const mockRepo: IGitHubRepository = {
  getCommitsForWeek: vi.fn().mockResolvedValue(mockCommits),
}

describe('FetchGitHubContextUseCase', () => {
  it('delegates to repository and returns commits', async () => {
    const useCase = new FetchGitHubContextUseCase(mockRepo)
    const result = await useCase.execute('guuse', '2026-05-19', '2026-05-23')
    expect(result).toEqual(mockCommits)
    expect(mockRepo.getCommitsForWeek).toHaveBeenCalledWith('guuse', '2026-05-19', '2026-05-23')
  })

  it('returns empty array when repository throws', async () => {
    const failRepo: IGitHubRepository = {
      getCommitsForWeek: vi.fn().mockRejectedValue(new Error('401')),
    }
    const useCase = new FetchGitHubContextUseCase(failRepo)
    const result = await useCase.execute('guuse', '2026-05-19', '2026-05-23')
    expect(result).toEqual([])
  })
})
