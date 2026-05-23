import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import { FetchGitHubContextUseCase } from './FetchGitHubContextUseCase'
import { FetchLinearContextUseCase } from './FetchLinearContextUseCase'
import { GroupAndClassifyDayUseCase } from './GroupAndClassifyDayUseCase'
import type { GitHubCommit } from '../entities/GitHubCommit'

export interface ProcessWeekProgress {
  phase: 'fetching-github' | 'fetching-linear' | 'classifying-day' | 'done' | 'error'
  day?: string
  dayIndex?: number
  error?: string
}

function weekDays(weekStart: string): string[] {
  const days: string[] = []
  const start = new Date(weekStart)
  for (let i = 0; i < 5; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d.toISOString().split('T')[0]!)
  }
  return days
}

export class ProcessWeekUseCase {
  private readonly fetchGitHub: FetchGitHubContextUseCase
  private readonly fetchLinear: FetchLinearContextUseCase

  constructor(
    githubRepo: IGitHubRepository,
    linearRepo: ILinearRepository,
    private readonly calendarRepo: IGoogleCalendarRepository,
    private readonly historyStore: IHistoryStore,
    private readonly copilotRepo: ICopilotRepository,
    private readonly cacheRepo: IMappingCacheRepository,
    private readonly availableProjects: Project[],
    private readonly availableServices: Service[],
    private readonly githubUsername: string,
  ) {
    this.fetchGitHub = new FetchGitHubContextUseCase(githubRepo)
    this.fetchLinear = new FetchLinearContextUseCase(linearRepo)
  }

  async *execute(weekStart: string, weekEnd: string): AsyncGenerator<ProcessWeekProgress> {
    yield { phase: 'fetching-github' }
    const allCommits = await this.fetchGitHub.execute(this.githubUsername, weekStart, weekEnd)

    yield { phase: 'fetching-linear' }
    const linearIssues = await this.fetchLinear.execute(weekStart, weekEnd)

    const days = weekDays(weekStart)
    const groupAndClassify = new GroupAndClassifyDayUseCase(
      this.copilotRepo,
      this.cacheRepo,
      this.availableProjects,
      this.availableServices,
    )

    for (let i = 0; i < days.length; i++) {
      const day = days[i]!
      yield { phase: 'classifying-day', day, dayIndex: i }

      try {
        const dayCommits: GitHubCommit[] = allCommits.filter(c => c.timestamp.slice(0, 10) === day)

        const dayStart = new Date(day + 'T00:00:00')
        const dayEnd = new Date(day + 'T23:59:59')
        const [historyBlocks, calendarEvents] = await Promise.all([
          this.historyStore.getBlocksForDate(day),
          this.calendarRepo.fetchEvents(dayStart, dayEnd),
        ])

        const classified = await groupAndClassify.execute(day, historyBlocks, calendarEvents, {
          commits: dayCommits,
          linearIssues,
        })

        await this.historyStore.setBlocksForDate(day, classified)
      } catch (err) {
        yield { phase: 'error', day, dayIndex: i, error: err instanceof Error ? err.message : String(err) }
      }
    }

    yield { phase: 'done' }
  }
}
