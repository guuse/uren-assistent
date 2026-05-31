import { describe, it, expect } from 'vitest'
import { ParseBrowserHistoryUseCase, ParseError } from './ParseBrowserHistoryUseCase'

function makeCsv(rows: Array<{ time: string; title: string; url: string; visits?: number }>): string {
  const header = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'
  const lines = rows.map((r, i) =>
    `${i + 1},id${i},${r.time},"${r.title}",${r.visits ?? 3},${r.url},0`
  )
  return [header, ...lines].join('\n')
}

describe('ParseBrowserHistoryUseCase', () => {
  const uc = new ParseBrowserHistoryUseCase()

  it('throws ParseError on invalid header', async () => {
    await expect(uc.execute('not,a,valid,csv', 1)).rejects.toBeInstanceOf(ParseError)
  })

  it('returns empty array for empty csv', async () => {
    const csv = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar\n'
    const result = await uc.execute(csv, 1)
    expect(result).toEqual([])
  })

  it('groups URLs within 30-minute window into one block', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub PR', url: 'https://github.com/org/repo/pull/1', visits: 3 },
      { time: '2024-05-13T09:15:00', title: 'Localhost', url: 'http://localhost:3000/app', visits: 3 },
      { time: '2024-05-13T09:25:00', title: 'Docs', url: 'https://docs.google.com/document/d/abc', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.urls).toHaveLength(3)
  })

  it('creates separate blocks for visits more than 30 minutes apart', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
      { time: '2024-05-13T11:00:00', title: 'Localhost', url: 'http://localhost:3000', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(2)
  })

  it('separates blocks by day even if times are close', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T23:50:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
      { time: '2024-05-14T00:05:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(2)
    expect(result[0]!.date).toBe('2024-05-13')
    expect(result[1]!.date).toBe('2024-05-14')
  })

  it('filters out blocks with fewer visits than minVisits', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 1 },
      { time: '2024-05-13T10:00:00', title: 'Localhost', url: 'http://localhost:3000', visits: 5 },
    ])
    const result = await uc.execute(csv, 3)
    expect(result).toHaveLength(1)
    expect(result[0]!.urls[0]).toContain('localhost')
  })

  it('rounds start and end times to half hour', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:07:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.firstVisitTime).toBe('09:00')
    expect(result[0]!.lastVisitTime).toBe('09:00')
  })

  it('rounds hours to nearest 0.5, minimum 0.5', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.hours).toBe(0.5)
  })

  it('sets urlPattern to the most-visited url in the block', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 10 },
      { time: '2024-05-13T09:10:00', title: 'Localhost', url: 'http://localhost:3000', visits: 2 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.urlPattern).toContain('github.com')
  })

  it('returns blocks sorted by date then firstVisitTime', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T11:00:00', title: 'B', url: 'https://b.com', visits: 3 },
      { time: '2024-05-13T09:00:00', title: 'A', url: 'https://a.com', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.firstVisitTime).toBe('09:00')
    expect(result[1]!.firstVisitTime).toBe('11:00')
  })

  it('caps time rounding at 23:30, does not roll over to next day', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T23:47:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.firstVisitTime).toBe('23:30')
    expect(result[0]!.date).toBe('2024-05-13')
  })

  it('keeps an unparseable URL verbatim (normaliseUrl catch branch)', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:00:00', title: 'Weird', url: 'not a url', visits: 5 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.urlPattern).toBe('not a url')
  })

  it('skips blank lines and rows without a URL', async () => {
    const header = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'
    const csv = [
      header,
      '1,id1,2024-05-13T09:00:00,"Has URL",5,https://github.com/org/repo,0',
      '',                                              // blank line → skipped
      '2,id2,2024-05-13T09:05:00,"No URL",5,,0',       // empty URL → skipped
      '   ',                                           // whitespace-only line → skipped
    ].join('\n')
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.urlPattern).toContain('github.com')
  })

  it('rounds m>=45 up to the next hour when not at 23:00', async () => {
    const csv = makeCsv([
      { time: '2024-05-13T09:50:00', title: 'GitHub', url: 'https://github.com/org/repo', visits: 3 },
    ])
    const result = await uc.execute(csv, 1)
    expect(result[0]!.firstVisitTime).toBe('10:00')
  })

  it('defaults visit count to 1 when the visits column is absent or non-numeric', async () => {
    // Header WITHOUT a "{{times}}" visits column → visitsIdx is -1, count falls back to 1.
    const header = 'Order,ID,Last Visit Time,Title,URL'
    const csv = [
      header,
      '1,id1,2024-05-13T09:00:00,"A",https://github.com/org/repo',
      '2,id2,2024-05-13T09:10:00,"B",https://github.com/org/repo',
    ].join('\n')
    const result = await uc.execute(csv, 2)
    expect(result).toHaveLength(1)
    expect(result[0]!.visitCount).toBe(2) // 1 + 1
  })

  it('skips a row whose columns are truncated before the time field', async () => {
    const header = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'
    const csv = [
      header,
      '1,id1', // truncated row — cols[timeIdx] is undefined → skipped
      '2,id2,2024-05-13T09:00:00,"Good",5,https://example.com,0',
    ].join('\n')
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.urlPattern).toContain('example.com')
  })

  it('treats a non-numeric visit count as 1', async () => {
    const header = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'
    const csv = [
      header,
      '1,id1,2024-05-13T09:00:00,"A",abc,https://github.com/org/repo,0', // visits "abc" → NaN → 1
      '2,id2,2024-05-13T09:10:00,"B",xyz,https://github.com/org/repo,0', // visits "xyz" → NaN → 1
    ].join('\n')
    const result = await uc.execute(csv, 2)
    expect(result).toHaveLength(1)
    expect(result[0]!.visitCount).toBe(2) // 1 + 1
  })

  it('skips a row that has a time but is truncated before the URL column', async () => {
    const header = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'
    const csv = [
      header,
      '1,id1,2024-05-13T09:00:00,"Title only",5', // no URL column present → cols[urlIdx] undefined → skipped
      '2,id2,2024-05-13T09:00:00,"Good",5,https://example.com,0',
    ].join('\n')
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.urlPattern).toContain('example.com')
  })

  it('skips rows with an unparseable visit time', async () => {
    const header = 'Order,ID,Last Visit Time,Title,Link visited {{times}} times,URL,Typed {{times}} times in the address bar'
    const csv = [
      header,
      '1,id1,not-a-date,"Bad time",5,https://github.com/org/repo,0',  // invalid time → skipped
      '2,id2,2024-05-13T09:00:00,"Good",5,https://example.com,0',
    ].join('\n')
    const result = await uc.execute(csv, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.urlPattern).toContain('example.com')
  })
})
