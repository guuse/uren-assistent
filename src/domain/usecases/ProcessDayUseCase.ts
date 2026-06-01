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
import { groupLinearIssuesIntoBlocks } from './groupLinearIssuesIntoBlocks'
import { PackDayUseCase } from './PackDayUseCase'
import { computeTrendPatterns } from './computeTrendPatterns'

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
  // Services (with hour types) per project id, prefetched once for the week.
  servicesByProjectId: Record<string, Service[]>
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
    private readonly simplicateRepo: ISimplicateRepository,
    private readonly simplicateEmployeeId: string,
  ) {
    this.fetchGitHub = new FetchGitHubContextUseCase(githubRepo)
    this.fetchLinear = new FetchLinearContextUseCase(linearRepo)
    this.getActiveProjects = new GetActiveProjectsForDateUseCase(simplicateRepo)
  }

  /**
   * Loads the services (with their hour types + labels) for the given projects.
   * Services aren't in the global store (fetched lazily per project), so the
   * classifier loads them here for the day's active projects — this is what lets
   * the LLM pick a valid project, service AND hour type ("urensoort").
   */
  private async buildServicesForProjects(projectIds: string[], date: string): Promise<Service[]> {
    const hourTypes = await this.simplicateRepo.getHourTypes()
    const labelById = new Map(hourTypes.map(h => [h.id, h.label]))
    const lists = await Promise.all(projectIds.map(id => this.simplicateRepo.getServices(id, date)))
    return lists.flat().map(s => ({
      id: s.id,
      name: s.name,
      projectId: s.projectId,
      hourTypes: s.hourTypeIds.map(htId => ({ id: htId, label: labelById.get(htId) ?? htId })),
    }))
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
      // Completed Linear issues not already explained by a commit become their
      // own blocks (Linear is the 4th source, above trends — see ADR/CONTEXT).
      const linearBlocks = groupLinearIssuesIntoBlocks(linearIssues, allCommits, date)
      const allBlocks = [...historyBlocks, ...commitBlocks, ...linearBlocks]

      // Services for the day's active projects, with their hour types — the
      // global store keeps no services, so load (or slice from the prefetch) here.
      const activeProjectIds = activeProjectsResult.activeProjects.map(p => p.id)
      const availableServices: Service[] = prefetch
        ? activeProjectIds.flatMap(id => prefetch.servicesByProjectId[id] ?? [])
        : await this.buildServicesForProjects(activeProjectIds, date)

      const groupAndClassify = new GroupAndClassifyDayUseCase(
        this.copilotRepo,
        this.cacheRepo,
        activeProjectsResult.activeProjects,
        availableServices.length > 0 ? availableServices : this.availableServices,
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

      // Deterministic trend patterns from the 28-day history window drive both
      // growth (proportional to historical share) and strong-pattern fill — see
      // ADR-0004. The LLM no longer decides what gets filled or how big.
      const trends = computeTrendPatterns(activeProjectsResult.historicalEntries, date)
      const packed = new PackDayUseCase().execute(classified, existingEntries, { trends })

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
