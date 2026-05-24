// src/domain/usecases/ProcessWeekUseCase.ts
import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import { FetchGitHubContextUseCase } from './FetchGitHubContextUseCase'
import { FetchLinearContextUseCase } from './FetchLinearContextUseCase'
import { ProcessDayUseCase } from './ProcessDayUseCase'
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
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y!, m! - 1, d!)
  for (let i = 0; i < 5; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`)
  }
  return days
}

export class ProcessWeekUseCase {
  private readonly fetchGitHub: FetchGitHubContextUseCase
  private readonly fetchLinear: FetchLinearContextUseCase
  private readonly processDayUseCase: ProcessDayUseCase

  constructor(
    githubRepo: IGitHubRepository,
    linearRepo: ILinearRepository,
    calendarRepo: IGoogleCalendarRepository,
    historyStore: IHistoryStore,
    copilotRepo: ICopilotRepository,
    cacheRepo: IMappingCacheRepository,
    availableProjects: Project[],
    availableServices: Service[],
    private readonly githubUsername: string,
    simplicateRepo: ISimplicateRepository,
    simplicateEmployeeId: string,
  ) {
    this.fetchGitHub = new FetchGitHubContextUseCase(githubRepo)
    this.fetchLinear = new FetchLinearContextUseCase(linearRepo)
    this.processDayUseCase = new ProcessDayUseCase(
      githubRepo,
      linearRepo,
      calendarRepo,
      historyStore,
      copilotRepo,
      cacheRepo,
      availableProjects,
      availableServices,
      githubUsername,
      simplicateRepo,
      simplicateEmployeeId,
    )
  }

  async *execute(weekStart: string, weekEnd: string): AsyncGenerator<ProcessWeekProgress> {
    yield { phase: 'fetching-github' }
    const allCommits = await this.fetchGitHub.execute(this.githubUsername, weekStart, weekEnd)

    yield { phase: 'fetching-linear' }
    const linearIssues = await this.fetchLinear.execute(weekStart, weekEnd)

    const days = weekDays(weekStart)
    const commitsByDay: Record<string, GitHubCommit[]> = {}
    for (const day of days) {
      commitsByDay[day] = allCommits.filter(c => c.date === day)
    }
    yield { phase: 'context-ready', commitsByDay, linearIssues }

    for (let i = 0; i < days.length; i++) {
      const day = days[i]!
      yield { phase: 'classifying-day', day, dayIndex: i }

      for await (const progress of this.processDayUseCase.execute(day)) {
        if (progress.phase === 'error') {
          yield { phase: 'error', day, dayIndex: i, ...(progress.error !== undefined ? { error: progress.error } : {}) }
        }
        // fetching-context, classifying-day, done — geen forward nodig naar WeekPage
      }
    }

    yield { phase: 'done' }
  }
}
