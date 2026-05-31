import type { ISimplicateRepository, SimplicateHourType, SimplicateProject, SimplicateService } from '../repositories/ISimplicateRepository'

export interface SimplicateData {
  projects: SimplicateProject[]
  services: SimplicateService[]
  hourTypes: SimplicateHourType[]
}

export class FetchSimplicateDataUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(): Promise<SimplicateData> {
    const [projects, hourTypes] = await Promise.all([
      this.simplicateRepo.getProjects(),
      this.simplicateRepo.getHourTypes(),
    ])
    // Services are fetched lazily per project to avoid N+1
    return { projects, services: [], hourTypes }
  }

  async fetchServicesForProject(projectId: string, date?: string): Promise<SimplicateService[]> {
    const forDate = date ?? new Date().toISOString().split('T')[0]!
    return this.simplicateRepo.getServices(projectId, forDate)
  }
}
