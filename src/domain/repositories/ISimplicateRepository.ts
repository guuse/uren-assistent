import type { HourEntry } from '../entities/HourEntry'

export interface SimplicateProject {
  id: string
  name: string
  organizationName: string
}

export interface SimplicateService {
  id: string
  name: string
  projectId: string
}

export interface SimplicateHourType {
  id: string
  label: string
}

export interface SimplicateEmployee {
  id: string
  name: string
  email: string
}

export interface ISimplicateRepository {
  getProjects(): Promise<SimplicateProject[]>
  getServices(projectId: string): Promise<SimplicateService[]>
  getHourTypes(): Promise<SimplicateHourType[]>
  getEmployee(email: string): Promise<SimplicateEmployee>
  bookHours(entries: HourEntry[]): Promise<void>
}
