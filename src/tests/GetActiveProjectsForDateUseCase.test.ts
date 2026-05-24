import { describe, it, expect, vi } from 'vitest'
import { GetActiveProjectsForDateUseCase } from '../domain/usecases/GetActiveProjectsForDateUseCase'
import type { ISimplicateRepository, SimplicateProject } from '../domain/repositories/ISimplicateRepository'
import type { HourEntry } from '../domain/entities/HourEntry'

function makeRepo(entries: HourEntry[], projects: SimplicateProject[]): ISimplicateRepository {
  return {
    getHourEntries: vi.fn().mockResolvedValue(entries),
    getProjects: vi.fn().mockResolvedValue(projects),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
    bookHours: vi.fn(),
  } as unknown as ISimplicateRepository
}

function makeEntry(projectId: string, startDate: string): HourEntry {
  return {
    id: 'e1',
    employeeId: 'emp1',
    projectId,
    projectServiceId: 'svc1',
    hourTypeId: 'ht1',
    hours: 1,
    startDate,
    startTime: '09:00',
    endTime: '10:00',
    note: '',
  }
}

describe('GetActiveProjectsForDateUseCase', () => {
  it('fetches entries for [targetDate-28d, targetDate) window', async () => {
    const repo = makeRepo([], [])
    const uc = new GetActiveProjectsForDateUseCase(repo)
    await uc.execute('2026-05-24', 'emp1')
    expect(repo.getHourEntries).toHaveBeenCalledWith('emp1', '2026-04-26', '2026-05-24')
  })

  it('returns only projects that appear in the historical entries', async () => {
    const projects: SimplicateProject[] = [
      { id: 'P1', name: 'Actief', organizationName: 'Org' },
      { id: 'P2', name: 'Inactief', organizationName: 'Org' },
    ]
    const entries = [makeEntry('P1', '2026-05-10')]
    const repo = makeRepo(entries, projects)
    const uc = new GetActiveProjectsForDateUseCase(repo)
    const result = await uc.execute('2026-05-24', 'emp1')
    expect(result.activeProjects.map(p => p.id)).toEqual(['P1'])
    expect(result.activeProjects).toHaveLength(1)
  })

  it('sorts projects by booking count descending', async () => {
    const projects: SimplicateProject[] = [
      { id: 'P1', name: 'Weinig', organizationName: 'Org' },
      { id: 'P2', name: 'Veel', organizationName: 'Org' },
    ]
    const entries = [
      makeEntry('P1', '2026-05-10'),
      makeEntry('P2', '2026-05-10'),
      makeEntry('P2', '2026-05-11'),
      makeEntry('P2', '2026-05-12'),
    ]
    const repo = makeRepo(entries, projects)
    const uc = new GetActiveProjectsForDateUseCase(repo)
    const result = await uc.execute('2026-05-24', 'emp1')
    expect(result.activeProjects[0]!.id).toBe('P2')
    expect(result.activeProjects[1]!.id).toBe('P1')
  })

  it('returns all historical entries unchanged', async () => {
    const projects: SimplicateProject[] = [
      { id: 'P1', name: 'A', organizationName: 'Org' },
    ]
    const entries = [makeEntry('P1', '2026-05-10'), makeEntry('P1', '2026-05-11')]
    const repo = makeRepo(entries, projects)
    const uc = new GetActiveProjectsForDateUseCase(repo)
    const result = await uc.execute('2026-05-24', 'emp1')
    expect(result.historicalEntries).toHaveLength(2)
  })

  it('uses targetDate-relative window, not today', async () => {
    const repo = makeRepo([], [])
    const uc = new GetActiveProjectsForDateUseCase(repo)
    await uc.execute('2026-03-10', 'emp1')
    // 2026-03-10 - 28 days = 2026-02-10
    expect(repo.getHourEntries).toHaveBeenCalledWith('emp1', '2026-02-10', '2026-03-10')
  })
})
