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
    getProjects: vi.fn().mockResolvedValue([]),
    getHourEntries: vi.fn().mockResolvedValue([]),
    getServices: vi.fn().mockResolvedValue([]),
    getHourTypes: vi.fn().mockResolvedValue([]),
    getEmployee: vi.fn().mockResolvedValue({}),
    bookHours: vi.fn().mockResolvedValue(undefined),
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

  it('uses prefetched week data instead of fetching per-day Simplicate data', async () => {
    const simplicate = makeSimplicateRepo()
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
      simplicate,
      'employee-1',
    )

    const phases: string[] = []
    for await (const progress of useCase.execute('2026-05-19', {
      weekCommits: [],
      weekLinearIssues: [],
      historicalSuperset: [],
      allProjects: [],
      servicesByProjectId: {},
    })) {
      phases.push(progress.phase)
    }

    expect(phases[phases.length - 1]).toBe('done')
    // Prefetch path must not hit Simplicate per day.
    expect(simplicate.getHourEntries).not.toHaveBeenCalled()
    expect(simplicate.getProjects).not.toHaveBeenCalled()
  })

  it('non-prefetch path builds services for active projects (with hour-type label fallback)', async () => {
    const simplicate = makeSimplicateRepo()
    const entry = {
      employeeId: 'employee-1', projectId: 'P1', projectServiceId: 's1', hourTypeId: 'ht1',
      hours: 1, startDate: '2026-05-19', startTime: '09:00', endTime: '10:00', note: '',
    }
    ;(simplicate.getHourEntries as ReturnType<typeof vi.fn>).mockResolvedValue([entry])
    ;(simplicate.getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'P1', name: 'Acme', organizationName: 'Org' }])
    ;(simplicate.getServices as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 's1', name: 'Dev', projectId: 'P1', hourTypeIds: ['ht1', 'missing-label'] },
    ])
    ;(simplicate.getHourTypes as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'ht1', label: 'Development' }])

    const useCase = new ProcessDayUseCase(
      makeGitHub(), makeLinear(), makeCalendar(), makeHistoryStore(), makeCopilot(),
      makeCache(), [] as Project[], [] as Service[], 'testuser', simplicate, 'employee-1',
    )
    const phases: string[] = []
    for await (const p of useCase.execute('2026-05-19')) phases.push(p.phase)

    expect(phases[phases.length - 1]).toBe('done')
    // Active project P1 had its services fetched at runtime.
    expect(simplicate.getServices).toHaveBeenCalledWith('P1', '2026-05-19')
    expect(simplicate.getHourTypes).toHaveBeenCalled()
  })

  it('prefetch path slices services from servicesByProjectId for active projects', async () => {
    const simplicate = makeSimplicateRepo()
    const entry = {
      employeeId: 'employee-1', projectId: 'P1', projectServiceId: 's1', hourTypeId: 'ht1',
      hours: 1, startDate: '2026-05-19', startTime: '09:00', endTime: '10:00', note: '',
    }
    const useCase = new ProcessDayUseCase(
      makeGitHub(), makeLinear(), makeCalendar(), makeHistoryStore(), makeCopilot(),
      makeCache(), [] as Project[], [] as Service[], 'testuser', simplicate, 'employee-1',
    )
    const phases: string[] = []
    for await (const p of useCase.execute('2026-05-19', {
      weekCommits: [],
      weekLinearIssues: [],
      historicalSuperset: [entry],
      allProjects: [{ id: 'P1', name: 'Acme', organizationName: 'Org' } as never],
      servicesByProjectId: { P1: [{ id: 's1', name: 'Dev', projectId: 'P1', hourTypes: [{ id: 'ht1', label: 'Dev' }] }] },
    })) phases.push(p.phase)

    expect(phases[phases.length - 1]).toBe('done')
    // Prefetch path must not load services or hour types at runtime.
    expect(simplicate.getServices).not.toHaveBeenCalled()
    expect(simplicate.getHourTypes).not.toHaveBeenCalled()
  })

  it('prefetch path falls back to an empty service list for a project missing from servicesByProjectId', async () => {
    const simplicate = makeSimplicateRepo()
    const entry = {
      employeeId: 'employee-1', projectId: 'P1', projectServiceId: 's1', hourTypeId: 'ht1',
      hours: 1, startDate: '2026-05-19', startTime: '09:00', endTime: '10:00', note: '',
    }
    const useCase = new ProcessDayUseCase(
      makeGitHub(), makeLinear(), makeCalendar(), makeHistoryStore(), makeCopilot(),
      makeCache(), [] as Project[], [{ id: 'fallback', name: 'F', projectId: 'X' }] as Service[], 'testuser', simplicate, 'employee-1',
    )
    const phases: string[] = []
    for await (const p of useCase.execute('2026-05-19', {
      weekCommits: [],
      weekLinearIssues: [],
      historicalSuperset: [entry],
      allProjects: [{ id: 'P1', name: 'Acme', organizationName: 'Org' } as never],
      servicesByProjectId: {}, // P1 absent → flatMap hits the `?? []` fallback
    })) phases.push(p.phase)
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

  it('stringifies a non-Error thrown value in the error phase', async () => {
    const calendar = makeCalendar()
    ;(calendar.fetchEvents as ReturnType<typeof vi.fn>).mockRejectedValue('plain string failure')

    const useCase = new ProcessDayUseCase(
      makeGitHub(), makeLinear(), calendar, makeHistoryStore(), makeCopilot(),
      makeCache(), [] as Project[], [] as Service[], 'testuser', makeSimplicateRepo(), 'employee-1',
    )
    let errorMsg: string | undefined
    for await (const progress of useCase.execute('2026-05-19')) {
      if (progress.phase === 'error') errorMsg = progress.error
    }
    expect(errorMsg).toBe('plain string failure')
  })
})
