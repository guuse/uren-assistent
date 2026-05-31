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

  it('sorteert twee pattern-suggesties puur op occurrences (geen last-week betrokken)', () => {
    // Geen enkele combinatie staat op vorige week (2026-05-12); beide zijn pattern.
    // De comparator raakt zo de tak waar b.reason !== last-week (regel 78 false).
    const entries = [
      makeEntry({ startDate: '2026-05-05', projectId: 'pa', projectServiceId: 'sa', hourTypeId: 'hta' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'pa', projectServiceId: 'sa', hourTypeId: 'hta' }),
      makeEntry({ startDate: '2026-04-21', projectId: 'pa', projectServiceId: 'sa', hourTypeId: 'hta' }),
      makeEntry({ startDate: '2026-05-05', projectId: 'pb', projectServiceId: 'sb', hourTypeId: 'htb' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'pb', projectServiceId: 'sb', hourTypeId: 'htb' }),
    ]
    const result = useCase.execute('2026-05-19', entries)
    expect(result.every((s) => s.reason === 'pattern')).toBe(true)
    expect(result[0]!.projectId).toBe('pa') // 3 occurrences > pb's 2
    expect(result[1]!.projectId).toBe('pb')
  })

  it('tilt last-week boven pattern ook als de pattern-suggestie eerst is opgebouwd', () => {
    // Twee pattern-combinaties (p6, p8) staan vooraan in de invoer, de last-week
    // (p7) achteraan. Met meerdere elementen roept de sort de comparator in beide
    // richtingen aan, inclusief a=pattern/b=last-week → regel 78 return 1.
    const entries = [
      // pattern p6 first, then last-week p7, then pattern p8 — last-week sandwiched
      // so the comparator sees it as both a and b across pairs.
      makeEntry({ startDate: '2026-05-05', projectId: 'p6', projectServiceId: 's6', hourTypeId: 'ht6' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p6', projectServiceId: 's6', hourTypeId: 'ht6' }),
      makeEntry({ startDate: '2026-05-12', projectId: 'p7', projectServiceId: 's7', hourTypeId: 'ht7' }),
      makeEntry({ startDate: '2026-05-05', projectId: 'p8', projectServiceId: 's8', hourTypeId: 'ht8' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p8', projectServiceId: 's8', hourTypeId: 'ht8' }),
      makeEntry({ startDate: '2026-04-21', projectId: 'p8', projectServiceId: 's8', hourTypeId: 'ht8' }),
    ]
    const result = useCase.execute('2026-05-19', entries)
    expect(result[0]!.projectId).toBe('p7') // last-week bovenaan ondanks meer pattern-occurrences
    expect(result[0]!.reason).toBe('last-week')
    expect(result.slice(1).every((s) => s.reason === 'pattern')).toBe(true)
  })

  it('valt terug op occurrences-sortering wanneer beide suggesties last-week zijn', () => {
    // Twee verschillende combinaties die beide op vorige week (2026-05-12) staan,
    // p4 ook op een eerdere dag (meer occurrences). Beide reason=last-week dus de
    // comparator valt door naar de occurrences-tak (regel 79).
    const entries = [
      makeEntry({ startDate: '2026-05-12', projectId: 'p4', projectServiceId: 's4', hourTypeId: 'ht4' }),
      makeEntry({ startDate: '2026-05-05', projectId: 'p4', projectServiceId: 's4', hourTypeId: 'ht4' }),
      makeEntry({ startDate: '2026-05-12', projectId: 'p5', projectServiceId: 's5', hourTypeId: 'ht5' }),
    ]
    const result = useCase.execute('2026-05-19', entries)
    expect(result.every((s) => s.reason === 'last-week')).toBe(true)
    expect(result[0]!.projectId).toBe('p4') // 2 occurrences > p5's 1
    expect(result[1]!.projectId).toBe('p5')
  })

  it('kiest de meest recente boeking als latere datum na een vroegere binnenkomt', () => {
    // Zelfde combinatie, eerst de oudere datum, dan de nieuwere — dwingt de
    // mostRecentDate/mostRecentEntry-update af (regel 48-51).
    const entries = [
      makeEntry({ startDate: '2026-05-05', startTime: '08:00', endTime: '09:00', projectId: 'p9', projectServiceId: 's9', hourTypeId: 'ht9' }),
      makeEntry({ startDate: '2026-05-12', startTime: '13:00', endTime: '15:00', projectId: 'p9', projectServiceId: 's9', hourTypeId: 'ht9' }),
    ]
    const result = useCase.execute('2026-05-19', entries)
    const match = result.find((s) => s.projectId === 'p9')!
    expect(match.startTime).toBe('13:00')
    expect(match.endTime).toBe('15:00')
  })

  it('sorteert pattern vóór niets en last-week boven pattern (beide comparator-takken)', () => {
    // p2 = pattern (3x), p1 = last-week. p2 wordt vóór p1 ingevoerd zodat de
    // sort beide takken raakt: a=pattern/b=last-week én a=last-week/b=pattern.
    const entries = [
      makeEntry({ startDate: '2026-05-05', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-04-28', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-04-21', projectId: 'p2', projectServiceId: 's2', hourTypeId: 'ht2' }),
      makeEntry({ startDate: '2026-05-12', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
    ]
    const result = useCase.execute('2026-05-19', entries)
    expect(result[0]!.projectId).toBe('p1') // last-week wint ondanks minder occurrences
    expect(result[0]!.reason).toBe('last-week')
    expect(result[1]!.projectId).toBe('p2')
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
