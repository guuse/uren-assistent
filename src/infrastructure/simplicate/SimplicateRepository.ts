import { invoke } from '@tauri-apps/api/core'
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
    const json = await invoke<string>('simplicate_request', {
      args: { method: 'GET', url, api_key: this.apiKey, api_secret: this.apiSecret, body: null },
    })
    return JSON.parse(json) as T
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const json = await invoke<string>('simplicate_request', {
      args: {
        method: 'POST',
        url,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        body: JSON.stringify(body),
      },
    })
    return JSON.parse(json) as T
  }

  private async getPaginated<T>(path: string): Promise<T[]> {
    const limit = 100
    const results: T[] = []
    let offset = 0
    const separator = path.includes('?') ? '&' : '?'
    while (true) {
      const res = await this.get<SimplicateApiListResponse<T>>(
        `${path}${separator}limit=${limit}&offset=${offset}`,
      )
      results.push(...res.data)
      if (res.data.length < limit) break
      offset += limit
    }
    return results
  }

  async getProjects(): Promise<SimplicateProject[]> {
    const data = await this.getPaginated<SimplicateProjectResponse>('/projects/project')
    return data
      .filter((p) => p.project_status.label !== 'tab_pclosed')
      .map((p) => ({
        id: p.id,
        name: p.name,
        organizationName: p.organization.name,
      }))
  }

  async getServices(projectId: string): Promise<SimplicateService[]> {
    const today = new Date().toISOString().split('T')[0]!
    const res = await this.get<SimplicateApiListResponse<SimplicateServiceResponse>>(
      `/projects/service?q%5Bproject_id%5D=${encodeURIComponent(projectId)}`,
    )
    return res.data
      .filter((s) => !s.write_hours_end_date || s.write_hours_end_date >= today)
      .map((s) => ({
        id: s.id,
        name: s.name,
        projectId: s.project_id,
        hourTypeIds: s.hour_types
          .filter((ht) => !ht.hourstype.blocked)
          .map((ht) => ht.hourstype.id),
      }))
  }

  async getHourTypes(): Promise<SimplicateHourType[]> {
    const res = await this.get<SimplicateApiListResponse<SimplicateHourTypeResponse>>('/hours/hourstype')
    return res.data.map((h) => ({ id: h.id, label: h.label }))
  }

  async getEmployee(email: string): Promise<SimplicateEmployee> {
    const res = await this.get<SimplicateApiListResponse<SimplicateEmployeeResponse>>('/hrm/employee')
    const employee = res.data.find((e) => e.work_email === email)
    if (!employee) throw new Error(`Employee not found for email: ${email}`)
    return { id: employee.id, name: employee.name, email: employee.work_email }
  }

  async bookHours(entries: HourEntry[]): Promise<void> {
    await Promise.all(
      entries.map((entry) =>
        this.post('/hours/hours', {
          employee_id: entry.employeeId,
          project_id: entry.projectId,
          projectservice_id: entry.projectServiceId,
          type_id: entry.hourTypeId,
          hours: entry.hours,
          start_date: `${entry.startDate} ${entry.startTime}:00`,
          end_date: `${entry.startDate} ${entry.endTime}:00`,
          note: entry.note,
          is_time_defined: true,
          is_recurring: false,
        }),
      ),
    )
  }
}
