import type { HourEntry } from '../entities/HourEntry'
import type { HourSubmission } from '../entities/HourSubmission'

export interface SimplicateProject {
  id: string
  name: string
  organizationName: string
}

export interface SimplicateService {
  id: string
  name: string
  projectId: string
  hourTypeIds: string[]  // hourstype ids available on this service
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
  getServices(projectId: string, date: string): Promise<SimplicateService[]>
  getHourTypes(): Promise<SimplicateHourType[]>
  getEmployee(email: string): Promise<SimplicateEmployee>
  bookHours(entries: HourEntry[]): Promise<void>
  getHourEntries(employeeId: string, from: string, to: string): Promise<HourEntry[]>
  deleteHourEntry(id: string): Promise<void>
  updateHourEntry(entry: HourEntry): Promise<void>
  /** Submit ("indienen") all of the employee's hours in the inclusive date range, locking them. */
  submitHours(employeeId: string, startDate: string, endDate: string): Promise<void>
  /** Withdraw ("intrekken") a submitted period in the inclusive date range, unlocking it. */
  withdrawHours(employeeId: string, startDate: string, endDate: string): Promise<void>
  /** Fetch submission status for the employee within the inclusive date range. */
  getSubmissions(employeeId: string, from: string, to: string): Promise<HourSubmission[]>
}
