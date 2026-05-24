import { describe, it, expect, vi } from 'vitest'
import { ProcessWeekUseCase } from '../ProcessWeekUseCase'
import type { IGitHubRepository } from '../../repositories/IGitHubRepository'
import type { ILinearRepository } from '../../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../../repositories/IHistoryStore'
import type { ICopilotRepository } from '../../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../../repositories/IMappingCacheRepository'
import type { GitHubCommit } from '../../entities/GitHubCommit'
import type { LinearIssue } from '../../entities/LinearIssue'

const mockCommit: GitHubCommit = {
  sha: 'abc', message: 'feat: test', repo: 'guuse/r', branch: 'main',
  timestamp: '2026-05-19T10:00:00Z', time: '10:00', date: '2026-05-19',
}
const mockIssue: LinearIssue = {
  identifier: 'ENG-1', title: 'Test issue', completedAt: '2026-05-19T14:00:00Z',
  url: 'https://linear.app/eng/issue/ENG-1',
}

const githubRepo: IGitHubRepository = { getCommitsForWeek: vi.fn().mockResolvedValue([mockCommit]) }
const linearRepo: ILinearRepository = { getCompletedIssuesForWeek: vi.fn().mockResolvedValue([mockIssue]) }
const calendarRepo: IGoogleCalendarRepository = {
  fetchEvents: vi.fn().mockResolvedValue([]),
  hasCalendarScope: vi.fn().mockResolvedValue(true),
}
const historyStore: IHistoryStore = {
  load: vi.fn().mockResolvedValue(undefined),
  getBlocksForDate: vi.fn().mockResolvedValue([]),
  setBlocksForDate: vi.fn().mockResolvedValue(undefined),
  removeBlock: vi.fn().mockResolvedValue(undefined),
  hasDataForDate: vi.fn().mockResolvedValue(false),
  hasHistoryForWeek: vi.fn().mockResolvedValue(false),
}
const copilotRepo: ICopilotRepository = {
  classify: vi.fn().mockResolvedValue([]),
  classifyDay: vi.fn().mockResolvedValue([]),
}
const cacheRepo: IMappingCacheRepository = {
  get: vi.fn().mockReturnValue(undefined),
  getAll: vi.fn().mockReturnValue({}),
  set: vi.fn(),
}

describe('ProcessWeekUseCase', () => {
  it('yields progress for each day (fetches github/linear once for week + once per day via ProcessDayUseCase)', async () => {
    const useCase = new ProcessWeekUseCase(
      githubRepo, linearRepo, calendarRepo, historyStore, copilotRepo, cacheRepo,
      [], [], 'guuse',
    )

    const phases: string[] = []
    for await (const progress of useCase.execute('2026-05-19', '2026-05-23')) {
      phases.push(progress.phase)
    }

    expect(phases).toContain('fetching-github')
    expect(phases).toContain('fetching-linear')
    expect(phases.filter(p => p === 'classifying-day')).toHaveLength(5)
    expect(phases).toContain('done')
    expect(githubRepo.getCommitsForWeek).toHaveBeenCalledTimes(6) // 1 week + 5 days (ProcessDayUseCase fetches per day)
    expect(linearRepo.getCompletedIssuesForWeek).toHaveBeenCalledTimes(6) // 1 week + 5 days
    expect(historyStore.setBlocksForDate).toHaveBeenCalledTimes(5)
  })
})
