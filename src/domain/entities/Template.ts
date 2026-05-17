export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type TemplateType = 'recurring' | 'single' | 'weekly-block'

export interface BaseTemplate {
  id: string
  name: string
  type: TemplateType
  color: string
  projectId?: string
  serviceId?: string
  hourTypeId?: string
  defaultNote?: string
  startTime: string // HH:mm
  endTime: string   // HH:mm
}

export interface RecurringTemplate extends BaseTemplate {
  type: 'recurring'
  days: Day[]
}

export interface SingleTemplate extends BaseTemplate {
  type: 'single'
}

export interface WeeklyBlockTemplate extends BaseTemplate {
  type: 'weekly-block'
  day: Day
}

export type Template = RecurringTemplate | SingleTemplate | WeeklyBlockTemplate

export function isRecurringTemplate(t: Template): t is RecurringTemplate {
  return t.type === 'recurring'
}

export function isSingleTemplate(t: Template): t is SingleTemplate {
  return t.type === 'single'
}

export function isWeeklyBlockTemplate(t: Template): t is WeeklyBlockTemplate {
  return t.type === 'weekly-block'
}
