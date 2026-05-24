// src/domain/usecases/ProcessDayUseCase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ProcessDayUseCase } from './ProcessDayUseCase'
import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { IGoogleCalendarRepository } from '../repositories/IGoogleCalendarRepository'
import type { IHistoryStore } from '../repositories/IHistoryStore'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

function makeGitHub(): IGitHubRepository {
  return { fetchCommits: vi.fn().mockResolvedValue([]) } as unknown as IGitHubRepository
}
function makeLinear(): ILinearRepository {
  return { fetchIssues: vi.fn().mockResolvedValue([]) } as unknown as ILinearRepository
}
function makeCalendar(): IGoogleCalendarRepository {
  return { fetchEvents: vi.fn().mockResolvedValue([]) } as unknown as IGoogleCalendarRepository
}
function makeHistoryStore(): IHistoryStore {
  return {
    load: vi.fn(),
    getBlocksForDate: vi.fn().mockResolvedValue([]),
    setBlocksForDate: vi.fn().mockResolvedValue(undefined),
    removeBlock: vi.fn(),
    hasDataForDate: vi.fn().mockResolvedValue(false),
    hasHistoryForWeek: vi.fn().mockResolvedValue(false),
  }
}
function makeCopilot(): ICopilotRepository {
  return {
    classify: vi.fn().mockResolvedValue([]),
    complete: vi.fn().mockResolvedValue('[]'),
  } as unknown as ICopilotRepository
}
function makeCache(): IMappingCacheRepository {
  return { get: vi.fn().mockReturnValue(undefined), set: vi.fn(), getAll: vi.fn().mockReturnValue({}) } as unknown as IMappingCacheRepository
}
function makeSimplicateRepo(): ISimplicateRepository {
  return {
    getActiveProjects: vi.fn().mockResolvedValue([]),
  } as unknown as ISimplicateRepository
}

describe('ProcessDayUseCase', () => {
  it('yields classifying-day and done for a single date', async () => {
    const useCase = new ProcessDayUseCase(
      makeGitHub(),
      makeLinear(),
      makeCalendar(),
      makeHistoryStore(),
      makeCopilot(),
      makeCache(),
      [] as Project[],
      [] as Service[],
      'testuser',
      makeSimplicateRepo(),
      'employee-1',
    )

    const phases: string[] = []
    for await (const progress of useCase.execute('2026-05-19')) {
      phases.push(progress.phase)
    }

    expect(phases).toContain('classifying-day')
    expect(phases[phases.length - 1]).toBe('done')
  })

  it('yields error phase when calendar throws', async () => {
    const calendar = makeCalendar()
    ;(calendar.fetchEvents as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('calendar down'))

    const useCase = new ProcessDayUseCase(
      makeGitHub(),
      makeLinear(),
      calendar,
      makeHistoryStore(),
      makeCopilot(),
      makeCache(),
      [] as Project[],
      [] as Service[],
      'testuser',
      makeSimplicateRepo(),
      'employee-1',
    )

    const phases: string[] = []
    for await (const progress of useCase.execute('2026-05-19')) {
      phases.push(progress.phase)
    }

    expect(phases).toContain('error')
  })
})
