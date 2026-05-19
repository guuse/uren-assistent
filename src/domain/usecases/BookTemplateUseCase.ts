import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { Template } from '../entities/Template'
import type { HourEntry } from '../entities/HourEntry'
import { isRecurringTemplate, isSingleTemplate, isWeeklyBlockTemplate } from '../entities/Template'

const DAY_OFFSETS: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]!
}

function hoursFromTimes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return ((eh! * 60 + em!) - (sh! * 60 + sm!)) / 60
}

interface BookTemplateInput {
  template: Template
  employeeId: string
  note: string
  weekStartDate: string // YYYY-MM-DD, always a Monday or selected date
  overrides?: {
    projectId?: string
    serviceId?: string
    hourTypeId?: string
  }
}

export class BookTemplateUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(input: BookTemplateInput): Promise<void> {
    const { template, employeeId, note, weekStartDate, overrides = {} } = input

    const projectId = overrides.projectId ?? template.projectId
    const serviceId = overrides.serviceId ?? template.serviceId
    const hourTypeId = overrides.hourTypeId ?? template.hourTypeId
    const startTime = template.startTime
    const endTime = template.endTime

    const missing: string[] = []
    if (!projectId) missing.push('projectId')
    if (!serviceId) missing.push('serviceId')
    if (!hourTypeId) missing.push('hourTypeId')
    if (!startTime) missing.push('startTime')
    if (!endTime) missing.push('endTime')
    if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`)

    const baseEntry = {
      employeeId,
      projectId: projectId!,
      projectServiceId: serviceId!,
      hourTypeId: hourTypeId!,
      hours: hoursFromTimes(startTime!, endTime!),
      startTime: startTime!,
      endTime: endTime!,
      note,
    }

    let entries: HourEntry[] = []

    if (isRecurringTemplate(template)) {
      entries = template.days.map((day) => ({
        ...baseEntry,
        startDate: addDays(weekStartDate, DAY_OFFSETS[day]!),
      }))
    } else if (isSingleTemplate(template)) {
      entries = [{ ...baseEntry, startDate: weekStartDate }]
    } else if (isWeeklyBlockTemplate(template)) {
      entries = [{ ...baseEntry, startDate: addDays(weekStartDate, DAY_OFFSETS[template.day]!) }]
    } else {
      const _exhaustive: never = template
      throw new Error(`Unknown template type: ${(_exhaustive as { type: string }).type}`)
    }

    await this.simplicateRepo.bookHours(entries)
  }
}
