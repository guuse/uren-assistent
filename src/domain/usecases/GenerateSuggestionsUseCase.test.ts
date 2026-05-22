import { describe, it, expect } from 'vitest'
import { GenerateSuggestionsUseCase } from './GenerateSuggestionsUseCase'
import type { HourEntry } from '../entities/HourEntry'

function makeEntry(overrides: Partial<HourEntry> = {}): HourEntry {
  return {
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'ht1',
    hours: 2,
    startDate: '2026-05-19',
    startTime: '09:00',
    endTime: '11:00',
    note: '',
    ...overrides,
  }
}

describe('GenerateSuggestionsUseCase', () => {
  const useCase = new GenerateSuggestionsUseCase()

  it('geeft last-week suggestie terug voor entries van exact vorige week', () => {
    // targetDate = dinsdag 2026-05-19, vorige week dinsdag = 2026-05-12
    const entries = [makeEntry({ startDate: '2026-05-12', projectId: 'p1' })]
    const result = useCase.execute('2026-05-19', entries)

    expect(result).toHaveLength(1)
    expect(result[0]!.reason).toBe('last-week')
    expect(result[0]!.projectId).toBe('p1')
  })

  it('geeft pattern suggestie als combinatie op ≥2 van de 4 vorige gelijke weekdagen voorkomt', () => {
    // targetDate = dinsdag 2026-05-19
    // Vorige dinsdagen: 2026-05-12, 2026-05-05, 2026-04-28, 2026-04-21
    const entries = [
      makeEntry({ startDate: '2026-05-05', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    expect(result.some((s) => s.projectId === 'p2' && s.reason === 'pattern')).toBe(true)
  })

  it('geeft geen pattern suggestie als combinatie op slechts 1 vorige weekdag voorkomt', () => {
    const entries = [
      makeEntry({ startDate: '2026-05-05', projectId: 'p3', projectServiceId: 's3', hourTypeId: 'ht3' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    expect(result.some((s) => s.projectId === 'p3')).toBe(false)
  })

  it('samenvoegt last-week en pattern voor dezelfde combinatie, last-week wint', () => {
    // p1/s1/ht1 staat op vorige week EN op 3 weken daarvoor (dus ook pattern)
    const entries = [
      makeEntry({ startDate: '2026-05-12', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
      makeEntry({ startDate: '2026-05-05', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    const matches = result.filter((s) => s.projectId === 'p1')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.reason).toBe('last-week')
  })

  it('neemt startTime/endTime over van de meest recente boeking', () => {
    const entries = [
      makeEntry({ startDate: '2026-05-12', startTime: '10:00', endTime: '12:00' }),
      makeEntry({ startDate: '2026-05-05', startTime: '09:00', endTime: '11:00' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    expect(result[0]!.startTime).toBe('10:00')
    expect(result[0]!.endTime).toBe('12:00')
  })

  it('geeft lege array terug bij geen historische entries', () => {
    const result = useCase.execute('2026-05-19', [])
    expect(result).toEqual([])
  })

  it('sorteert op occurrences desc', () => {
    const entries = [
      makeEntry({ startDate: '2026-05-05', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-04-21', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-05-12', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
      makeEntry({ startDate: '2026-05-05', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
    ]
    const result = useCase.execute('2026-05-19', entries)

    // p2 heeft 3 occurrences, p1 heeft 2 (last-week + pattern)
    // last-week (p1) staat boven pattern (p2) bij gelijke occurrences
    expect(result[0]!.projectId).toBe('p1') // last-week
    expect(result[1]!.projectId).toBe('p2') // pattern, 3 occurrences
  })
})
