// src/domain/usecases/ProcessDayUseCase.ts
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

export interface ProcessDayProgress {
  phase: 'fetching-context' | 'classifying-day' | 'done' | 'error'
  date?: string
  error?: string
}

export class ProcessDayUseCase {
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

  async *execute(date: string): AsyncGenerator<ProcessDayProgress> {
    yield { phase: 'fetching-context', date }

    try {
      const dayStart = new Date(date + 'T00:00:00')
      const dayEnd = new Date(date + 'T23:59:59')

      const [allCommits, linearIssues, calendarEvents, historyBlocks] = await Promise.all([
        this.fetchGitHub.execute(this.githubUsername, date, date),
        this.fetchLinear.execute(date, date),
        this.calendarRepo.fetchEvents(dayStart, dayEnd),
        this.historyStore.getBlocksForDate(date),
      ])

      yield { phase: 'classifying-day', date }

      const commitBlocks = groupCommitsIntoBlocks(allCommits, date)
      const allBlocks = [...historyBlocks, ...commitBlocks]

      const groupAndClassify = new GroupAndClassifyDayUseCase(
        this.copilotRepo,
        this.cacheRepo,
        this.availableProjects,
        this.availableServices,
      )

      const classified = await groupAndClassify.execute(date, allBlocks, calendarEvents, {
        commits: allCommits,
        linearIssues,
      })

      await this.historyStore.setBlocksForDate(date, classified)
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
