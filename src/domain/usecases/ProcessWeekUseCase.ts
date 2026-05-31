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
import { ProcessDayUseCase, type DayPrefetch } from './ProcessDayUseCase'
import { subtractDays, addDays } from './GetActiveProjectsForDateUseCase'
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
    private readonly simplicateRepo: ISimplicateRepository,
    private readonly simplicateEmployeeId: string,
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

    // Haal de Simplicate-data die per dag identiek of afleidbaar is één keer op
    // voor de hele week: projecten en het 28-daagse historie-venster (gemeten
    // vanaf de vroegste dag). ProcessDay snijdt dit per dag uit.
    const [allProjects, historicalSuperset] = await Promise.all([
      this.simplicateRepo.getProjects(),
      // Inclusive upper bound (next day) so the last weekday's own entries are returned,
      // not dropped by Simplicate's date-only [le] comparison.
      this.simplicateRepo.getHourEntries(this.simplicateEmployeeId, subtractDays(weekStart, 28), addDays(weekEnd, 1)),
    ])
    const prefetch: DayPrefetch = {
      weekCommits: allCommits,
      weekLinearIssues: linearIssues,
      historicalSuperset,
      allProjects,
    }

    // Verwerk dagen in batches zodat er hooguit CONCURRENCY Gemini-calls tegelijk lopen.
    // De per-call 429-backoff in GeminiRepository blijft de quota bewaken.
    const CONCURRENCY = 3

    const runDay = async (day: string): Promise<string | undefined> => {
      let error: string | undefined
      for await (const progress of this.processDayUseCase.execute(day, prefetch)) {
        if (progress.phase === 'error') error = progress.error
        // fetching-context, classifying-day, done — geen forward nodig naar WeekPage
      }
      return error
    }

    for (let i = 0; i < days.length; i += CONCURRENCY) {
      const chunk = days.slice(i, i + CONCURRENCY)
      for (let j = 0; j < chunk.length; j++) {
        yield { phase: 'classifying-day', day: chunk[j]!, dayIndex: i + j }
      }

      const errors = await Promise.all(chunk.map(day => runDay(day)))

      for (let j = 0; j < chunk.length; j++) {
        const error = errors[j]
        if (error !== undefined) {
          yield { phase: 'error', day: chunk[j]!, dayIndex: i + j, error }
        }
      }
    }

    yield { phase: 'done' }
  }
}
