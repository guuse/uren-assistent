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
  SimplicateHourEntryResponse,
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

  private async delete(path: string): Promise<void> {
    const url = `${this.baseUrl}${path}`
    await invoke<string>('simplicate_request', {
      args: {
        method: 'DELETE',
        url,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        body: null,
      },
    })
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const json = await invoke<string>('simplicate_request', {
      args: {
        method: 'PUT',
        url,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        body: JSON.stringify(body),
      },
    })
    // Simplicate may answer a successful PUT with 204 No Content (empty body).
    return (json.trim() ? JSON.parse(json) : undefined) as T
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

  async getServices(projectId: string, date: string): Promise<SimplicateService[]> {
    const res = await this.get<SimplicateApiListResponse<SimplicateServiceResponse>>(
      `/projects/service?q%5Bproject_id%5D=${encodeURIComponent(projectId)}`,
    )
    return res.data
      .filter((s) => (!s.write_hours_start_date || s.write_hours_start_date <= date)
                  && (!s.write_hours_end_date   || s.write_hours_end_date   >= date))
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

  async getHourEntries(employeeId: string, from: string, to: string): Promise<HourEntry[]> {
    const data = await this.getPaginated<SimplicateHourEntryResponse>(
      `/hours/hours?q%5Bemployee.id%5D=${encodeURIComponent(employeeId)}&q%5Bstart_date%5D%5Bge%5D=${from}&q%5Bstart_date%5D%5Ble%5D=${to}`,
    )
    return data.map((h) => ({
      id: h.id,
      employeeId: h.employee.id,
      projectId: h.project.id,
      projectServiceId: h.projectservice.id,
      hourTypeId: h.type.id,
      hours: h.hours,
      startDate: h.start_date.slice(0, 10),
      startTime: h.start_date.slice(11, 16),
      endTime: h.end_date.slice(11, 16),
      note: h.note,
    }))
  }

  async deleteHourEntry(id: string): Promise<void> {
    await this.delete(`/hours/hours/${encodeURIComponent(id)}`)
  }

  async updateHourEntry(entry: HourEntry): Promise<void> {
    await this.put(`/hours/hours/${encodeURIComponent(entry.id!)}`, {
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
    })
  }
}
