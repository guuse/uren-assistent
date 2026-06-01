import { invoke } from '@tauri-apps/api/core'
import { toConfidenceScore } from '../../domain/usecases/toConfidenceScore'
import type { ICopilotRepository, Project, Service, DayItem, DayClassificationResult, PatternBlock } from '../../domain/repositories/ICopilotRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'
import type { DayContext } from '../../domain/entities/DayContext'
import type { HourEntry } from '../../domain/entities/HourEntry'
import { loadPromptTemplate, renderPrompt } from './promptStore'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

interface GeminiPart {
  text: string
}

interface GeminiContent {
  parts: GeminiPart[]
  role?: string
}

interface GeminiCandidate {
  content: GeminiContent
}

interface GeminiResponse {
  candidates: GeminiCandidate[]
}

interface LLMBlockResult {
  urlPattern: string
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: number
}

async function callGemini(prompt: string): Promise<string> {
  // Routed through the Rust backend (`gemini_request`) rather than the webview's
  // `fetch`: the WebKit webview drops large/slow requests with a generic "Load
  // failed" error. The Rust side also retries transient failures (network
  // errors, 429, 5xx) with backoff and returns the raw response body, or
  // rejects with a "Gemini API error: <status> — <body>" / "Request failed: …"
  // message once retries are exhausted.
  let body: string
  try {
    body = await invoke<string>('gemini_request', {
      args: {
        url: GEMINI_URL,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || /quota/i.test(msg)) {
      throw new Error('Gemini quota uitgeput. Upgrade naar een betaald API-plan op https://ai.google.dev/ of probeer het later opnieuw.')
    }
    if (msg.startsWith('Request failed')) {
      throw new Error(`Gemini niet bereikbaar (netwerkfout na meerdere pogingen). ${msg}`)
    }
    throw new Error(msg.startsWith('Gemini') ? msg : `Gemini API error: ${msg}`)
  }

  const data = JSON.parse(body) as GeminiResponse
  const raw = data.candidates[0]?.content.parts[0]?.text ?? '[]'
  return raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
}

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return url
  }
}

function formatCalendarContext(calendarEvents: CalendarEvent[], blockDate: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

  const dayEvents = calendarEvents.filter(e => e.start.toISOString().slice(0, 10) === blockDate)
  if (dayEvents.length === 0) return ''

  const list = dayEvents
    .map(e => `- ${toTime(e.start)}–${toTime(e.end)} ${e.title}${e.attendees.length > 0 ? ` (${e.attendees.join(', ')})` : ''}`)
    .join('\n')

  return `\n## Today's meetings\n${list}\n`
}

function formatOverlappingMeetings(block: HistoryBlock & { overlappingMeetings?: CalendarEvent[] }): string {
  if (!block.overlappingMeetings || block.overlappingMeetings.length === 0) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const list = block.overlappingMeetings
    .map(e => `- ${toTime(e.start)}–${toTime(e.end)} ${e.title}`)
    .join('\n')
  return `\n  Overlapping meetings:\n${list}`
}

function formatDayContext(context: DayContext | undefined, date: string): string {
  if (!context) return ''
  const parts: string[] = []

  const commitsForDay = context.commits.filter(c => c.timestamp.slice(0, 10) === date)
  if (commitsForDay.length > 0) {
    const lines = commitsForDay.map(c => `- ${c.time} ${c.message} [${c.repo}]`).join('\n')
    parts.push(`## GitHub commits (${date})\n${lines}`)
  }

  if (context.linearIssues.length > 0) {
    const lines = context.linearIssues
      .map(i => `- ${i.identifier} · ${i.title} ✓ (afgerond ${i.completedAt.slice(0, 10)})`)
      .join('\n')
    parts.push(`## Linear issues (afgerond deze week)\n${lines}`)
  }

  return parts.length > 0 ? '\n' + parts.join('\n\n') + '\n' : ''
}

function formatHistoricalEntries(entries: HourEntry[], projects: Project[], services: Service[]): string {
  if (entries.length === 0) return ''

  const projectById = new Map(projects.map(p => [p.id, p.name]))
  const serviceById = new Map(services.map(s => [s.id, s.name]))

  const byDate = new Map<string, HourEntry[]>()
  for (const entry of entries) {
    const list = byDate.get(entry.startDate) ?? []
    list.push(entry)
    byDate.set(entry.startDate, list)
  }

  // Slim de prompt: alleen de meest recente boekdagen, en korte notities.
  // De volledige 4-weken-window blijft de actieve-projecten-detectie voeden;
  // de LLM heeft genoeg aan de recente dagen om patronen te herkennen.
  const MAX_DATES = 12
  const NOTE_MAX = 50
  const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, MAX_DATES)

  const lines: string[] = [`## Historische boekingen (meest recente ${sortedDates.length} boekdagen)\n`]
  for (const date of sortedDates) {
    lines.push(`${date}:`)
    for (const e of byDate.get(date)!) {
      const projectName = projectById.get(e.projectId) ?? e.projectId
      const serviceName = serviceById.get(e.projectServiceId) ?? e.projectServiceId
      const note = e.note.length > NOTE_MAX ? e.note.slice(0, NOTE_MAX) + '…' : e.note
      const noteStr = note ? ` | note: "${note}"` : ''
      lines.push(`  - ${e.startTime}–${e.endTime} | Project: ${projectName} (id: ${e.projectId}) / Dienst: ${serviceName} (id: ${e.projectServiceId})${noteStr}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function formatBookedEntries(entries: HourEntry[], projects: Project[], services: Service[]): string {
  if (entries.length === 0) return ''

  const projectById = new Map(projects.map(p => [p.id, p.name]))
  const serviceById = new Map(services.map(s => [s.id, s.name]))

  const lines = [...entries]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(e => {
      const projectName = projectById.get(e.projectId) ?? e.projectId
      const serviceName = serviceById.get(e.projectServiceId) ?? e.projectServiceId
      const noteStr = e.note ? ` | "${e.note}"` : ''
      return `- ${e.startTime}–${e.endTime} | ${projectName} / ${serviceName}${noteStr}`
    })
    .join('\n')

  return `## Al geboekt vandaag — NIET opnieuw classificeren\nDeze uren staan al geboekt. Maak hier GEEN blok of patternBlock voor; ze tellen al mee voor de 8 uur. Gebruik de omschrijvingen om te zien welk werk al gedekt is.\n${lines}\n\n`
}

export class GeminiRepository implements ICopilotRepository {
  async classify(
    blocks: (HistoryBlock & { overlappingMeetings?: CalendarEvent[] })[],
    availableProjects: Project[],
    availableServices: Service[],
    calendarEvents: CalendarEvent[] = [],
  ): Promise<ClassifiedBlock[]> {
    const projectList = availableProjects
      .map(p => `- id: "${p.id}", name: "${p.name}"`)
      .join('\n')
    const serviceList = availableServices
      .map(s => `- id: "${s.id}", name: "${s.name}", projectId: "${s.projectId}"`)
      .join('\n')
    const blockList = blocks
      .map(b =>
        `- urlPattern: "${b.urlPattern}", urls: [${b.urls.slice(0, 5).map(u => `"${u}"`).join(', ')}], titles: [${b.titles.slice(0, 3).map(t => `"${t}"`).join(', ')}], visitCount: ${b.visitCount}${formatOverlappingMeetings(b)}`
      )
      .join('\n')

    const blockDate = blocks[0]?.date ?? ''
    const calendarContext = formatCalendarContext(calendarEvents, blockDate)

    const template = await loadPromptTemplate('classify-blocks')
    const prompt = renderPrompt(template, {
      calendarContext,
      projectList,
      serviceList,
      blockList,
    })

    const content = await callGemini(prompt)

    let results: LLMBlockResult[]
    try {
      results = JSON.parse(content) as LLMBlockResult[]
    } catch {
      throw new Error('Gemini returned invalid JSON')
    }

    if (!Array.isArray(results)) {
      throw new Error('Gemini returned unexpected response format (not an array)')
    }

    const addHours = (time: string, hours: number): string => {
      const [h, m] = time.split(':').map(Number) as [number, number]
      const total = h * 60 + m + Math.round(hours * 60)
      return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    }

    return blocks.map(block => {
      const match = results.find(r => r.urlPattern === block.urlPattern)
      const classified: ClassifiedBlock = {
        ...block,
        blockName: match?.blockName ?? block.urlPattern,
        summary: match?.summary ?? '',
        startTime: block.firstVisitTime,
        endTime: block.lastVisitTime || addHours(block.firstVisitTime, block.hours),
        confidence: toConfidenceScore(match?.confidence),
        origin: 'llm' as const,
        rawTitles: block.titles.slice(0, 5),
        rawUrls: block.urls.slice(0, 5).map(sanitizeUrl),
      }
      if (match?.projectId) classified.projectId = match.projectId
      if (match?.serviceId) classified.serviceId = match.serviceId
      if (match?.note) classified.note = match.note
      return classified
    })
  }

  async classifyDay(
    date: string,
    items: DayItem[],
    availableProjects: Project[],
    availableServices: Service[],
    cacheHints: Record<string, { projectName: string; serviceName: string }>,
    context?: DayContext,
    historicalEntries?: HourEntry[],
    existingEntries?: HourEntry[],
  ): Promise<DayClassificationResult[]> {
    const pad = (n: number) => String(n).padStart(2, '0')
    const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

    const projectList = availableProjects
      .map(p => `- id: "${p.id}", name: "${p.name}"`)
      .join('\n')
    const serviceList = availableServices
      .map(s => {
        const hourTypes = (s.hourTypes ?? [])
          .map(ht => `{id: "${ht.id}", label: "${ht.label}"}`)
          .join(', ')
        const hourTypePart = hourTypes ? `, urensoorten: [${hourTypes}]` : ''
        return `- id: "${s.id}", name: "${s.name}", projectId: "${s.projectId}"${hourTypePart}`
      })
      .join('\n')

    const meetingItems = items.filter((i): i is DayItem & { kind: 'meeting' } => i.kind === 'meeting')
    const standaloneItems = items.filter((i): i is DayItem & { kind: 'standalone' } => i.kind === 'standalone')

    let meetingsSection = ''
    if (meetingItems.length > 0) {
      meetingsSection = '## Vergaderingen met browser-context\n\n'
      for (const item of meetingItems) {
        meetingsSection += `### [${item.index}] ${item.event.title} (${toTime(item.event.start)}–${toTime(item.event.end)})\n`
        if (item.historyBlocks.length === 0) {
          meetingsSection += `(geen browser-activiteit rondom deze vergadering)\n\n`
        } else {
          meetingsSection += `Browser-activiteit rondom deze vergadering:\n`
          for (const b of item.historyBlocks) {
            const titles = b.titles.slice(0, 3).join('", "')
            meetingsSection += `- ${b.urlPattern} (${b.visitCount}x) — "${titles}"\n`
          }
          meetingsSection += '\n'
        }
      }
    }

    let standaloneSection = ''
    if (standaloneItems.length > 0) {
      standaloneSection = '## Losse browser-activiteit\n\n'
      for (const item of standaloneItems) {
        const b = item.block
        standaloneSection += `### [${item.index}] ${b.firstVisitTime}–${b.lastVisitTime} (${b.hours}u)\n`
        for (const url of b.urls.slice(0, 5)) {
          standaloneSection += `- ${url} (${b.visitCount}x)\n`
        }
        const titles = b.titles.slice(0, 3).join('", "')
        if (titles) standaloneSection += `  Titels: "${titles}"\n`
        standaloneSection += '\n'
      }
    }

    const hintLines = Object.entries(cacheHints)
      .map(([key, val]) => `- ${key} → project: "${val.projectName}", dienst: "${val.serviceName}"`)
      .join('\n')
    const hintsSection = hintLines
      ? `## Cache-hints (eerder geboekte patronen)\n${hintLines}\n\n`
      : ''

    const contextSection = formatDayContext(context, date)

    const bookedSection = formatBookedEntries(existingEntries ?? [], availableProjects, availableServices)

    const historicalSection = historicalEntries && historicalEntries.length > 0
      ? formatHistoricalEntries(historicalEntries, availableProjects, availableServices) + '\n'
      : ''

    const sections = `${bookedSection}${meetingsSection}${standaloneSection}${hintsSection}${contextSection}${historicalSection}`
    const template = await loadPromptTemplate('classify-day')
    const prompt = renderPrompt(template, {
      date,
      sections,
      projectList,
      serviceList,
    })

    const content = await callGemini(prompt)

    interface ClassifyDayLLMResponse {
      blocks: DayClassificationResult[]
      patternBlocks?: PatternBlock[]
    }

    let parsed: ClassifyDayLLMResponse | DayClassificationResult[]
    try {
      parsed = JSON.parse(content) as ClassifyDayLLMResponse | DayClassificationResult[]
    } catch {
      throw new Error('Gemini returned invalid JSON for classifyDay')
    }

    if (Array.isArray(parsed)) {
      return parsed
    }

    if (!Array.isArray(parsed.blocks)) {
      throw new Error('Gemini classifyDay returned unexpected format')
    }

    const patternResults: DayClassificationResult[] = (parsed.patternBlocks ?? []).map((pb, i) => ({
      index: -1000 - i,
      blockName: pb.blockName,
      summary: pb.summary,
      projectId: pb.projectId,
      serviceId: pb.serviceId,
      hourTypeId: pb.hourTypeId ?? null,
      note: pb.note,
      confidence: toConfidenceScore(pb.confidence),
      relatedIssueIds: [],
      isPatternBlock: true,
      estimatedHours: pb.estimatedHours,
    }))

    return [...parsed.blocks, ...patternResults]
  }
}
