import { describe, it, expect } from 'vitest'
import { GetActiveProjectsForDateUseCase, subtractDays } from './GetActiveProjectsForDateUseCase'
import type { HourEntry } from '../entities/HourEntry'
import type { SimplicateProject } from '../repositories/ISimplicateRepository'

const entry = (startDate: string, projectId: string): HourEntry => ({
  employeeId: 'e1',
  projectId,
  projectServiceId: 'svc',
  hourTypeId: 'ht',
  hours: 1,
  startDate,
  startTime: '09:00',
  endTime: '10:00',
  note: '',
})

const projects: SimplicateProject[] = [
  { id: 'p1', name: 'One' },
  { id: 'p2', name: 'Two' },
  { id: 'p3', name: 'Three' },
] as unknown as SimplicateProject[]

describe('subtractDays', () => {
  it('subtracts across month boundaries', () => {
    expect(subtractDays('2026-03-05', 28)).toBe('2026-02-05')
  })
})

describe('GetActiveProjectsForDateUseCase.computeFromData', () => {
  it('only counts entries within the 28-day window up to and including the target date', () => {
    const superset = [
      entry('2026-05-19', 'p1'), // target day — in window
      entry('2026-04-21', 'p2'), // exactly 28 days before — in window
      entry('2026-04-20', 'p3'), // 29 days before — out of window
      entry('2026-05-20', 'p3'), // after target — out of window
    ]
    const { activeProjects, historicalEntries } = GetActiveProjectsForDateUseCase.computeFromData('2026-05-19', superset, projects)

    expect(historicalEntries.map(e => e.projectId).sort()).toEqual(['p1', 'p2'])
    expect(activeProjects.map(p => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('ranks active projects by booking frequency, descending', () => {
    const superset = [
      entry('2026-05-19', 'p2'),
      entry('2026-05-18', 'p2'),
      entry('2026-05-18', 'p2'),
      entry('2026-05-17', 'p1'),
    ]
    const { activeProjects } = GetActiveProjectsForDateUseCase.computeFromData('2026-05-19', superset, projects)
    expect(activeProjects.map(p => p.id)).toEqual(['p2', 'p1'])
  })
})
