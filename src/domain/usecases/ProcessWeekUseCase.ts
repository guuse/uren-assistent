import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import { FetchGitHubContextUseCase } from './FetchGitHubContextUseCase'
import { FetchLinearContextUseCase } from './FetchLinearContextUseCase'
import { GroupAndClassifyDayUseCase } from './GroupAndClassifyDayUseCase'
import { groupCommitsIntoBlocks } from './GroupCommitsIntoBlocks'
import type { GitHubCommit } from '../entities/GitHubCommit'
import type { LinearIssue } from '../entities/LinearIssue'

export interface ProcessWeekProgress {
  phase: 'fetching-github' | 'fetching-linear' | 'context-ready' | 'classifying-day' | 'done' | 'error'
  day?: string
  dayIndex?: number
  error?: string
  // only on context-ready:
  commitsByDay?: Record<string, GitHubCommit[]>
  linearIssues?: LinearIssue[]
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

    // Build per-day commit map and emit context-ready so UI can store it
    const days = weekDays(weekStart)
    const commitsByDay: Record<string, GitHubCommit[]> = {}
    for (const day of days) {
      commitsByDay[day] = allCommits.filter(c => c.date === day)
    }
    yield { phase: 'context-ready', commitsByDay, linearIssues }

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
        const dayCommits: GitHubCommit[] = commitsByDay[day] ?? []

        const dayStart = new Date(day + 'T00:00:00')
        const dayEnd = new Date(day + 'T23:59:59')
        const [historyBlocks, calendarEvents] = await Promise.all([
          this.historyStore.getBlocksForDate(day),
          this.calendarRepo.fetchEvents(dayStart, dayEnd),
        ])

        const commitBlocks = groupCommitsIntoBlocks(dayCommits, day)
        const allBlocks = [...historyBlocks, ...commitBlocks]

        const classified = await groupAndClassify.execute(day, allBlocks, calendarEvents, {
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
