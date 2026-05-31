// src/domain/usecases/ProcessDayUseCase.ts
import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import type { ISimplicateRepository, SimplicateProject } from '../repositories/ISimplicateRepository'
import type { GitHubCommit } from '../entities/GitHubCommit'
import type { LinearIssue } from '../entities/LinearIssue'
import type { HourEntry } from '../entities/HourEntry'
import { FetchGitHubContextUseCase } from './FetchGitHubContextUseCase'
import { FetchLinearContextUseCase } from './FetchLinearContextUseCase'
import { GroupAndClassifyDayUseCase } from './GroupAndClassifyDayUseCase'
import { GetActiveProjectsForDateUseCase, type ActiveProjectsResult } from './GetActiveProjectsForDateUseCase'
import { groupCommitsIntoBlocks } from './GroupCommitsIntoBlocks'
import { PackDayUseCase } from './PackDayUseCase'

export interface ProcessDayProgress {
  phase: 'fetching-context' | 'classifying-day' | 'done' | 'error'
  date?: string
  error?: string
}

/**
 * Week-level data fetched once and sliced per day, so a week run doesn't
 * re-fetch commits, issues, projects and the 28-day history window for each day.
 */
export interface DayPrefetch {
  weekCommits: GitHubCommit[]
  weekLinearIssues: LinearIssue[]
  historicalSuperset: HourEntry[]
  allProjects: SimplicateProject[]
}

export class ProcessDayUseCase {
  private readonly fetchGitHub: FetchGitHubContextUseCase
  private readonly fetchLinear: FetchLinearContextUseCase
  private readonly getActiveProjects: GetActiveProjectsForDateUseCase

  constructor(
    githubRepo: IGitHubRepository,
    linearRepo: ILinearRepository,
    private readonly calendarRepo: IGoogleCalendarRepository,
    private readonly historyStore: IHistoryStore,
    private readonly copilotRepo: ICopilotRepository,
    private readonly cacheRepo: IMappingCacheRepository,
    _availableProjects: Project[], // kept for call-site compat; active projects are fetched at runtime via getActiveProjects
    private readonly availableServices: Service[],
    private readonly githubUsername: string,
    simplicateRepo: ISimplicateRepository,
    private readonly simplicateEmployeeId: string,
  ) {
    this.fetchGitHub = new FetchGitHubContextUseCase(githubRepo)
    this.fetchLinear = new FetchLinearContextUseCase(linearRepo)
    this.getActiveProjects = new GetActiveProjectsForDateUseCase(simplicateRepo)
  }

  async *execute(date: string, prefetch?: DayPrefetch): AsyncGenerator<ProcessDayProgress> {
    yield { phase: 'fetching-context', date }

    try {
      const dayStart = new Date(date + 'T00:00:00')
      const dayEnd = new Date(date + 'T23:59:59')

      // Calendar events and browser history are genuinely per-day; commits,
      // issues, projects and the history window are sliced from week-level data
      // when a prefetch is supplied (week run), else fetched for this day alone.
      const [calendarEvents, historyBlocks] = await Promise.all([
        this.calendarRepo.fetchEvents(dayStart, dayEnd),
        this.historyStore.getBlocksForDate(date),
      ])

      let allCommits: GitHubCommit[]
      let linearIssues: LinearIssue[]
      let activeProjectsResult: ActiveProjectsResult
      if (prefetch) {
        allCommits = prefetch.weekCommits.filter(c => c.date === date)
        linearIssues = prefetch.weekLinearIssues.filter(i => i.completedAt.slice(0, 10) === date)
        activeProjectsResult = GetActiveProjectsForDateUseCase.computeFromData(
          date,
          prefetch.historicalSuperset,
          prefetch.allProjects,
        )
      } else {
        const [commits, issues, active] = await Promise.all([
          this.fetchGitHub.execute(this.githubUsername, date, date),
          this.fetchLinear.execute(date, date),
          this.getActiveProjects.execute(date, this.simplicateEmployeeId),
        ])
        allCommits = commits
        linearIssues = issues
        activeProjectsResult = active
      }

      yield { phase: 'classifying-day', date }

      const commitBlocks = groupCommitsIntoBlocks(allCommits, date)
      const allBlocks = [...historyBlocks, ...commitBlocks]

      const groupAndClassify = new GroupAndClassifyDayUseCase(
        this.copilotRepo,
        this.cacheRepo,
        activeProjectsResult.activeProjects,
        this.availableServices,
        activeProjectsResult.historicalEntries,
      )

      // Hours already booked for the target day. The fetch window now includes
      // `date`, so these surface here; the LLM gets them (to avoid re-classifying)
      // and the packer anchors against them and counts them toward the 8h target.
      const existingEntries = activeProjectsResult.historicalEntries.filter(e => e.startDate === date)

      const classified = await groupAndClassify.execute(
        date,
        allBlocks,
        calendarEvents,
        { commits: allCommits, linearIssues },
        existingEntries,
      )

      const packed = new PackDayUseCase().execute(classified, existingEntries)

      await this.historyStore.setBlocksForDate(date, packed)
    } catch (err) {
      yield {
        phase: 'error',
        date,
        error: err instanceof Error ? err.message : String(err),
      }
      return
    }

    yield { phase: 'done', date }
  }
}
