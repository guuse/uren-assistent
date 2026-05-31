import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProcessWeekUseCase } from '../ProcessWeekUseCase'
import type { IGitHubRepository } from '../../repositories/IGitHubRepository'
import type { ILinearRepository } from '../../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../../repositories/IHistoryStore'
import type { ICopilotRepository } from '../../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../../repositories/IMappingCacheRepository'
import type { ISimplicateRepository } from '../../repositories/ISimplicateRepository'
import type { GitHubCommit } from '../../entities/GitHubCommit'
import type { LinearIssue } from '../../entities/LinearIssue'

const mockCommit: GitHubCommit = {
  sha: 'abc', message: 'feat: test', repo: 'octocat/r', branch: 'main',
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
const simplicateRepo: ISimplicateRepository = {
  getActiveProjects: vi.fn().mockResolvedValue([]),
  getProjects: vi.fn().mockResolvedValue([]),
  getHourEntries: vi.fn().mockResolvedValue([]),
  getServices: vi.fn().mockResolvedValue([]),
  getHourTypes: vi.fn().mockResolvedValue([]),
  getEmployee: vi.fn().mockResolvedValue({}),
  bookHours: vi.fn().mockResolvedValue(undefined),
} as unknown as ISimplicateRepository

describe('ProcessWeekUseCase', () => {
  beforeEach(() => {
    // Clear call history (keep implementations) on the shared mocks so per-test
    // call-count assertions don't see calls accumulated by earlier tests.
    for (const repo of [githubRepo, linearRepo, calendarRepo, historyStore, copilotRepo, cacheRepo, simplicateRepo] as unknown as Record<string, unknown>[]) {
      for (const fn of Object.values(repo)) {
        if (typeof fn === 'function' && 'mockClear' in fn) (fn as ReturnType<typeof vi.fn>).mockClear()
      }
    }
  })

  it('loads services for each project booked in the window and maps hour-type labels', async () => {
    const entries = [
      { employeeId: 'employee-1', projectId: 'P1', projectServiceId: 's1', hourTypeId: 'ht1', hours: 1, startDate: '2026-05-19', startTime: '09:00', endTime: '10:00', note: '' },
      { employeeId: 'employee-1', projectId: 'P2', projectServiceId: 's2', hourTypeId: 'ht2', hours: 1, startDate: '2026-05-20', startTime: '09:00', endTime: '10:00', note: '' },
    ]
    const simplicate: ISimplicateRepository = {
      getActiveProjects: vi.fn().mockResolvedValue([]),
      getProjects: vi.fn().mockResolvedValue([]),
      getHourEntries: vi.fn().mockResolvedValue(entries),
      getServices: vi.fn().mockResolvedValue([
        { id: 's1', name: 'Dev', projectId: 'P1', hourTypeIds: ['ht1', 'unknown-ht'] },
      ]),
      getHourTypes: vi.fn().mockResolvedValue([{ id: 'ht1', label: 'Development' }]),
      getEmployee: vi.fn().mockResolvedValue({}),
      bookHours: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISimplicateRepository

    const useCase = new ProcessWeekUseCase(
      githubRepo, linearRepo, calendarRepo, historyStore, copilotRepo, cacheRepo,
      [], [], 'octocat', simplicate, 'employee-1',
    )
    const phases: string[] = []
    for await (const p of useCase.execute('2026-05-19', '2026-05-23')) phases.push(p.phase)

    expect(phases[phases.length - 1]).toBe('done')
    // One getServices call per distinct booked project (P1, P2).
    expect(simplicate.getServices).toHaveBeenCalledTimes(2)
    expect(simplicate.getServices).toHaveBeenCalledWith('P1', '2026-05-23')
    expect(simplicate.getServices).toHaveBeenCalledWith('P2', '2026-05-23')
  })

  it('yields an error phase for a day whose ProcessDay run fails', async () => {
    const failingHistory: IHistoryStore = {
      load: vi.fn().mockResolvedValue(undefined),
      getBlocksForDate: vi.fn().mockRejectedValue(new Error('history down')),
      setBlocksForDate: vi.fn().mockResolvedValue(undefined),
      removeBlock: vi.fn().mockResolvedValue(undefined),
      hasDataForDate: vi.fn().mockResolvedValue(false),
      hasHistoryForWeek: vi.fn().mockResolvedValue(false),
    }
    const useCase = new ProcessWeekUseCase(
      githubRepo, linearRepo, calendarRepo, failingHistory, copilotRepo, cacheRepo,
      [], [], 'octocat', simplicateRepo, 'employee-1',
    )
    const progress: { phase: string; error?: string }[] = []
    for await (const p of useCase.execute('2026-05-19', '2026-05-23')) progress.push(p)

    const errors = progress.filter(p => p.phase === 'error')
    expect(errors).toHaveLength(5)
    expect(errors[0]!.error).toBe('history down')
    expect(progress[progress.length - 1]!.phase).toBe('done')
  })

  it('yields progress for each day (fetches github/linear once for week + once per day via ProcessDayUseCase)', async () => {
    const useCase = new ProcessWeekUseCase(
      githubRepo, linearRepo, calendarRepo, historyStore, copilotRepo, cacheRepo,
      [], [], 'octocat', simplicateRepo, 'employee-1',
    )

    const phases: string[] = []
    for await (const progress of useCase.execute('2026-05-19', '2026-05-23')) {
      phases.push(progress.phase)
    }

    expect(phases).toContain('fetching-github')
    expect(phases).toContain('fetching-linear')
    expect(phases.filter(p => p === 'classifying-day')).toHaveLength(5)
    expect(phases).toContain('done')
    // Hoisted: each of these is fetched exactly once for the whole week and sliced per day.
    expect(githubRepo.getCommitsForWeek).toHaveBeenCalledTimes(1)
    expect(linearRepo.getCompletedIssuesForWeek).toHaveBeenCalledTimes(1)
    expect(simplicateRepo.getProjects).toHaveBeenCalledTimes(1)
    expect(simplicateRepo.getHourEntries).toHaveBeenCalledTimes(1)
    // Genuinely per-day fetches still run for each of the 5 days.
    expect(calendarRepo.fetchEvents).toHaveBeenCalledTimes(5)
    expect(historyStore.getBlocksForDate).toHaveBeenCalledTimes(5)
    expect(historyStore.setBlocksForDate).toHaveBeenCalledTimes(5)
  })
})
