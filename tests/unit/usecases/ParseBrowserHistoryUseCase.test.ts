import { describe, it, expect } from 'vitest'
import { ParseBrowserHistoryUseCase, ParseError } from '../../../src/domain/usecases/ParseBrowserHistoryUseCase'

const HEADER = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'

function makeRow(order: number, visitTime: string, title: string, url: string, visits = 3): string {
  return `${order},${order + 1000},"${visitTime}","${title}",${visits},"${url}","0"`
}

describe('ParseBrowserHistoryUseCase', () => {
  const useCase = new ParseBrowserHistoryUseCase()

  it('returns empty array for CSV with only header', async () => {
    const result = await useCase.execute(HEADER, 3)
    expect(result).toEqual([])
  })

  it('throws ParseError for wrong headers', async () => {
    await expect(useCase.execute('wrong,headers', 3)).rejects.toThrow(ParseError)
  })

  it('groups visits by day and URL pattern', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'Eindhoven Doet', 'https://github.com/Harborn-digital/eindhoven-doet/pull/1', 5),
      makeRow(2, '2026-05-11 09:30:00', 'Eindhoven Doet PR', 'https://github.com/Harborn-digital/eindhoven-doet/pull/2', 5),
      makeRow(3, '2026-05-11 10:00:00', 'Google', 'https://www.google.com/search?q=test', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    const ghBlock = result.find(b => b.urlPattern === 'github.com/Harborn-digital/eindhoven-doet/pull')
    expect(ghBlock).toBeDefined()
    expect(ghBlock!.date).toBe('2026-05-11')
    expect(ghBlock!.visitCount).toBe(10)
  })

  it('filters blocks with fewer visits than minVisits', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'Something', 'https://example.com/page', 2),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result).toEqual([])
  })

  it('normalises URL: removes protocol, query, fragment, limits to 3 path segments', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'Title', 'https://github.com/org/repo/pull/123?diff=unified#files', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result[0]!.urlPattern).toBe('github.com/org/repo/pull')
  })

  it('calculates hours from first to last visit, rounded to 0.25, minimum 0.25', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'A', 'https://github.com/org/repo/work/item1', 5),
      makeRow(2, '2026-05-11 09:30:00', 'B', 'https://github.com/org/repo/work/item2', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result[0]!.hours).toBe(1.5)
    expect(result[0]!.firstVisitTime).toBe('08:00')
  })

  it('sets minimum 0.25 hours when all visits at same time', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'A', 'https://github.com/org/repo/a', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result[0]!.hours).toBe(0.25)
  })

  it('splits blocks by day', async () => {
    const csv = [
      HEADER,
      makeRow(1, '2026-05-11 08:00:00', 'A', 'https://github.com/org/repo/a', 5),
      makeRow(2, '2026-05-12 09:00:00', 'A', 'https://github.com/org/repo/a', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result).toHaveLength(2)
    expect(result.map(b => b.date).sort()).toEqual(['2026-05-11', '2026-05-12'])
  })

  it('skips rows with invalid dates', async () => {
    const csv = [
      HEADER,
      `1,1001,"not-a-date","Title",5,"https://github.com/org/repo/a","0"`,
      makeRow(2, '2026-05-11 08:00:00', 'Valid', 'https://github.com/org/repo/b', 5),
    ].join('\n')

    const result = await useCase.execute(csv, 3)
    expect(result.every(b => b.date === '2026-05-11')).toBe(true)
  })
})
