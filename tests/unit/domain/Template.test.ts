import { describe, it, expect } from 'vitest'
import {
  isRecurringTemplate,
  isSingleTemplate,
  isWeeklyBlockTemplate,
  type RecurringTemplate,
  type SingleTemplate,
  type WeeklyBlockTemplate,
} from '../../../src/domain/entities/Template'

describe('Template type guards', () => {
  it('identifies recurring templates', () => {
    const t: RecurringTemplate = {
      id: '1', name: 'Standup', type: 'recurring', color: '#6c63ff',
      startTime: '09:00', endTime: '09:30', days: ['mon', 'tue'],
    }
    expect(isRecurringTemplate(t)).toBe(true)
    expect(isSingleTemplate(t)).toBe(false)
  })

  it('identifies single templates', () => {
    const t: SingleTemplate = {
      id: '2', name: 'Code review', type: 'single', color: '#63ffb4',
      startTime: '10:00', endTime: '11:00',
    }
    expect(isSingleTemplate(t)).toBe(true)
    expect(isWeeklyBlockTemplate(t)).toBe(false)
  })

  it('identifies weekly-block templates', () => {
    const t: WeeklyBlockTemplate = {
      id: '3', name: 'Sprint planning', type: 'weekly-block', color: '#63c5ff',
      startTime: '10:00', endTime: '11:00', day: 'mon',
    }
    expect(isWeeklyBlockTemplate(t)).toBe(true)
    expect(isRecurringTemplate(t)).toBe(false)
  })
})
