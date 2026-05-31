import { describe, it, expect, vi, afterEach } from 'vitest'
import { FetchSimplicateDataUseCase } from './FetchSimplicateDataUseCase'
import type { ISimplicateRepository, SimplicateProject, SimplicateService, SimplicateHourType } from '../repositories/ISimplicateRepository'

const projects: SimplicateProject[] = [{ id: 'P1', name: 'Acme' } as unknown as SimplicateProject]
const hourTypes: SimplicateHourType[] = [{ id: 'ht1', label: 'Dev' } as unknown as SimplicateHourType]
const svcs: SimplicateService[] = [{ id: 's1', name: 'Development', projectId: 'P1', hourTypeIds: ['ht1'] } as unknown as SimplicateService]

function makeRepo(): ISimplicateRepository {
  return {
    getProjects: vi.fn().mockResolvedValue(projects),
    getHourTypes: vi.fn().mockResolvedValue(hourTypes),
    getServices: vi.fn().mockResolvedValue(svcs),
    getHourEntries: vi.fn(),
    getEmployee: vi.fn(),
    bookHours: vi.fn(),
    getSubmissions: vi.fn(),
  } as unknown as ISimplicateRepository
}

describe('FetchSimplicateDataUseCase', () => {
  afterEach(() => vi.useRealTimers())

  it('fetches projects and hour types in parallel and returns empty services', async () => {
    const repo = makeRepo()
    const uc = new FetchSimplicateDataUseCase(repo)
    const result = await uc.execute()
    expect(repo.getProjects).toHaveBeenCalledOnce()
    expect(repo.getHourTypes).toHaveBeenCalledOnce()
    expect(result).toEqual({ projects, services: [], hourTypes })
  })

  it('fetchServicesForProject passes the supplied date through', async () => {
    const repo = makeRepo()
    const uc = new FetchSimplicateDataUseCase(repo)
    const result = await uc.fetchServicesForProject('P1', '2026-05-19')
    expect(repo.getServices).toHaveBeenCalledWith('P1', '2026-05-19')
    expect(result).toBe(svcs)
  })

  it('fetchServicesForProject defaults to today when no date is given', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'))
    const repo = makeRepo()
    const uc = new FetchSimplicateDataUseCase(repo)
    await uc.fetchServicesForProject('P1')
    expect(repo.getServices).toHaveBeenCalledWith('P1', '2026-05-19')
  })
})
