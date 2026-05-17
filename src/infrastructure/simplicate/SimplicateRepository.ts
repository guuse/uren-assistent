import type {
  ISimplicateRepository,
  SimplicateEmployee,
  SimplicateHourType,
  SimplicateProject,
  SimplicateService,
} from '../../domain/repositories/ISimplicateRepository'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type {
  SimplicateApiListResponse,
  SimplicateEmployeeResponse,
  SimplicateHourTypeResponse,
  SimplicateProjectResponse,
  SimplicateServiceResponse,
} from './simplicate.types'

export class SimplicateRepository implements ISimplicateRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`
    const response = await fetch(url, {
      headers: {
        Authentication: `App ${this.apiKey}:${this.apiSecret}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(`Simplicate API error: ${response.status}`)
    }
    return response.json() as Promise<T>
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authentication: `App ${this.apiKey}:${this.apiSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Simplicate API error: ${response.status} — ${JSON.stringify(error)}`)
    }
    return response.json() as Promise<T>
  }

  async getProjects(): Promise<SimplicateProject[]> {
    const res = await this.get<SimplicateApiListResponse<SimplicateProjectResponse>>('/projects/project')
    return res.data.map((p) => ({
      id: p.id,
      name: p.name,
      organizationName: p.organization.name,
    }))
  }

  async getServices(projectId: string): Promise<SimplicateService[]> {
    const res = await this.get<SimplicateApiListResponse<SimplicateServiceResponse>>(
      `/projects/service?project_id=${projectId}`,
    )
    return res.data.map((s) => ({
      id: s.id,
      name: s.name,
      projectId: s.project.id,
    }))
  }

  async getHourTypes(): Promise<SimplicateHourType[]> {
    const res = await this.get<SimplicateApiListResponse<SimplicateHourTypeResponse>>('/hours/hourtypes')
    return res.data.map((h) => ({ id: h.id, label: h.label }))
  }

  async getEmployee(email: string): Promise<SimplicateEmployee> {
    const res = await this.get<SimplicateApiListResponse<SimplicateEmployeeResponse>>(
      `/hrm/employee?work_email=${encodeURIComponent(email)}`,
    )
    const employee = res.data[0]
    if (!employee) throw new Error(`Employee not found for email: ${email}`)
    return { id: employee.id, name: employee.name, email: employee.work_email }
  }

  async bookHours(entries: HourEntry[]): Promise<void> {
    await Promise.all(
      entries.map((entry) =>
        this.post('/hours/hours', {
          employee: { id: entry.employeeId },
          projectservice: { id: entry.projectServiceId },
          type: { id: entry.hourTypeId },
          hours: entry.hours,
          start_date: entry.startDate,
          start_time: entry.startTime,
          end_time: entry.endTime,
          note: entry.note,
        }),
      ),
    )
  }
}
