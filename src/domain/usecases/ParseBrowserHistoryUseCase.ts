import type { HistoryBlock } from '../entities/HistoryBlock'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const EXPECTED_HEADERS = [
  'Order', 'ID', 'Last Visit Time', 'Title',
]

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean).slice(0, 2)
    return [parsed.hostname, ...segments].join('/')
  } catch {
    return url
  }
}

function roundToQuarter(hours: number): number {
  return Math.max(0.25, Math.round(hours * 4) / 4)
}

function parseDateTime(raw: string): Date | null {
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  url: string
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
    const visitsIdx = headerCols.findIndex((_, i) => i > titleIdx && headerCols[i]?.includes('times') && !headerCols[i]?.includes('address'))

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
        url,
        visitCount: parseInt(cols[visitsIdx] ?? '1', 10) || 1,
      })
    }

    // Group by date + normalised URL pattern
    type Key = string
    const groups = new Map<Key, { rows: RawRow[] }>()

    for (const row of rows) {
      const date = row.visitTime.toISOString().split('T')[0]!
      const pattern = normaliseUrl(row.url)
      const key = `${date}__${pattern}`
      if (!groups.has(key)) groups.set(key, { rows: [] })
      groups.get(key)!.rows.push(row)
    }

    const blocks: HistoryBlock[] = []

    for (const [key, { rows: groupRows }] of groups) {
      const totalVisits = groupRows.reduce((sum, r) => sum + r.visitCount, 0)
      if (totalVisits < minVisits) continue

      const [date, pattern] = key.split('__') as [string, string]
      const sorted = groupRows.slice().sort((a, b) => a.visitTime.getTime() - b.visitTime.getTime())
      const first = sorted[0]!
      const last = sorted[sorted.length - 1]!

      const diffMinutes = (last.visitTime.getTime() - first.visitTime.getTime()) / 60000
      const hours = roundToQuarter(diffMinutes / 60)

      const titles = [...new Set(groupRows.map(r => r.title).filter(Boolean))]

      blocks.push({
        date,
        urlPattern: pattern,
        titles,
        visitCount: totalVisits,
        firstVisitTime: toHHMM(first.visitTime),
        hours,
      })
    }

    return blocks.sort((a, b) => a.date.localeCompare(b.date) || a.firstVisitTime.localeCompare(b.firstVisitTime))
  }
}
