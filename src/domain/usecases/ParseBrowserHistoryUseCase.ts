import type { HistoryBlock } from '../entities/HistoryBlock'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const EXPECTED_HEADERS = ['Order', 'ID', 'Last Visit Time', 'Title']

const WINDOW_MINUTES = 30

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean).slice(0, 3)
    return [parsed.hostname, ...segments].join('/')
  } catch {
    return url
  }
}

function roundToHalf(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  // Round to nearest :00 or :30, cap at 23:30 (no cross-day rollover)
  if (m < 15) return `${String(h).padStart(2, '0')}:00`
  if (m < 45) return `${String(h).padStart(2, '0')}:30`
  if (h === 23) return '23:30'   // cap: don't roll over to next day
  return `${String(h + 1).padStart(2, '0')}:00`
}

function roundHoursDuration(minutes: number): number {
  return Math.max(0.5, Math.round(minutes / 60 * 2) / 2)
}

function parseDateTime(raw: string): Date | null {
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

interface RawRow {
  visitTime: Date
  title: string
  normalisedUrl: string
  visitCount: number
}

export class ParseBrowserHistoryUseCase {
  async execute(csv: string, minVisits: number): Promise<HistoryBlock[]> {
    const lines = csv.trim().split('\n')
    if (lines.length === 0) return []

    const headerCols = parseCsvLine(lines[0]!)
    for (const expected of EXPECTED_HEADERS) {
      if (!headerCols.includes(expected)) {
        throw new ParseError(
          `Invalid CSV format. Expected header "${expected}" not found. Make sure this is a Chrome browser history export.`
        )
      }
    }

    const timeIdx = headerCols.indexOf('Last Visit Time')
    const titleIdx = headerCols.indexOf('Title')
    const urlIdx = headerCols.findIndex(h => h === 'URL')
    const visitsIdx = headerCols.findIndex(
      (_, i) => i > titleIdx && headerCols[i]?.includes('times') && !headerCols[i]?.includes('address')
    )
    // visitsIdx may be -1 if the column pattern doesn't match; cols[-1] is undefined, so visitCount safely falls back to 1
    const rows: RawRow[] = []
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = parseCsvLine(line)
      const visitTime = parseDateTime(cols[timeIdx] ?? '')
      if (!visitTime) continue
      const url = cols[urlIdx] ?? ''
      if (!url) continue
      rows.push({
        visitTime,
        title: cols[titleIdx] ?? '',
        normalisedUrl: normaliseUrl(url),
        visitCount: parseInt(cols[visitsIdx] ?? '1', 10) || 1,
      })
    }

    // Sort rows by time
    rows.sort((a, b) => a.visitTime.getTime() - b.visitTime.getTime())

    // Group by day first, then apply time-window overlap within each day
    const byDay = new Map<string, RawRow[]>()
    for (const row of rows) {
      const d = row.visitTime
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!byDay.has(date)) byDay.set(date, [])
      byDay.get(date)!.push(row)
    }

    const blocks: HistoryBlock[] = []

    for (const [date, dayRows] of byDay) {
      // Sliding window: start new block when gap > WINDOW_MINUTES
      const windows: RawRow[][] = []
      let current: RawRow[] = []

      for (const row of dayRows) {
        if (current.length === 0) {
          current.push(row)
          continue
        }
        const lastTime = current[current.length - 1]!.visitTime.getTime()
        const gapMinutes = (row.visitTime.getTime() - lastTime) / 60000
        if (gapMinutes <= WINDOW_MINUTES) {
          current.push(row)
        } else {
          windows.push(current)
          current = [row]
        }
      }
      if (current.length > 0) windows.push(current)

      for (const windowRows of windows) {
        const totalVisits = windowRows.reduce((sum, r) => sum + r.visitCount, 0)
        if (totalVisits < minVisits) continue

        const first = windowRows[0]!
        const last = windowRows[windowRows.length - 1]!
        const diffMinutes = (last.visitTime.getTime() - first.visitTime.getTime()) / 60000
        const hours = roundHoursDuration(diffMinutes)

        // Collect unique URL patterns, track visit counts per pattern
        const urlCounts = new Map<string, number>()
        for (const r of windowRows) {
          urlCounts.set(r.normalisedUrl, (urlCounts.get(r.normalisedUrl) ?? 0) + r.visitCount)
        }
        const urls = [...urlCounts.keys()]
        // Primary pattern = most visited
        const urlPattern = [...urlCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0]

        const titles = [...new Set(windowRows.map(r => r.title).filter(Boolean))]

        blocks.push({
          date,
          urlPattern,
          urls,
          titles,
          visitCount: totalVisits,
          firstVisitTime: roundToHalf(first.visitTime),
          lastVisitTime: roundToHalf(last.visitTime),
          hours,
        })
      }
    }

    return blocks.sort((a, b) =>
      a.date.localeCompare(b.date) || a.firstVisitTime.localeCompare(b.firstVisitTime)
    )
  }
}
