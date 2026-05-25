import { invoke } from '@tauri-apps/api/core'
import { toConfidenceScore } from '../../domain/usecases/toConfidenceScore'
import type { ICopilotRepository, Project, Service, DayItem, DayClassificationResult, PatternBlock } from '../../domain/repositories/ICopilotRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'
import type { DayContext } from '../../domain/entities/DayContext'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { CopilotModel } from '../../domain/entities/CopilotModel'

interface CopilotChoice {
  message: { content: string }
}

interface CopilotResponse {
  choices: CopilotChoice[]
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

  const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))

  const lines: string[] = ['## Historische boekingen (afgelopen 4 weken)\n']
  for (const date of sortedDates) {
    lines.push(`${date}:`)
    for (const e of byDate.get(date)!) {
      const projectName = projectById.get(e.projectId) ?? e.projectId
      const serviceName = serviceById.get(e.projectServiceId) ?? e.projectServiceId
      const noteStr = e.note ? ` | note: "${e.note}"` : ''
      lines.push(`  - ${e.startTime}–${e.endTime} | Project: ${projectName} (id: ${e.projectId}) / Dienst: ${serviceName} (id: ${e.projectServiceId})${noteStr}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export class CopilotRepository implements ICopilotRepository {
  constructor(private readonly copilotToken: string) {}

  async classify(
    blocks: (HistoryBlock & { overlappingMeetings?: CalendarEvent[] })[],
    availableProjects: Project[],
    availableServices: Service[],
    calendarEvents: CalendarEvent[] = [],
    model = 'gpt-4o',
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

    // Use the date of the first block for the calendar context header
    const blockDate = blocks[0]?.date ?? ''
    const calendarContext = formatCalendarContext(calendarEvents, blockDate)

    const prompt = `You are a time-tracking assistant helping a developer record their work hours.

For each browser activity block, you must:
1. Generate a human-readable name (e.g. "Eindhoven Doet — development", "Harborn hosting — beheer")
2. Write a short summary of what was done (max 120 chars, Dutch preferred)
3. Match to a project and service if possible
${calendarContext}
Available projects:
${projectList}

Available services (linked to projects by projectId):
${serviceList}

Browser activity blocks to process:
${blockList}

Return a JSON array. Each item must have:
- urlPattern (string, exact match from input — used as identifier)
- blockName (string, human-readable work block name, max 60 chars)
- summary (string, short description of the work, max 120 chars, Dutch preferred)
- projectId (string | null, must be one of the available project IDs)
- serviceId (string | null, must be a service ID whose projectId matches the chosen project)
- note (string, short booking note, max 80 chars)
- confidence (integer 1–5):
  5 = Zeer zeker — project, service en tijdstip kloppen precies met de agenda
  4 = Zeker — goede match, klein detail ontbreekt of is afgeleid
  3 = Aannemelijk — patroon klopt, maar meerdere opties waren mogelijk
  2 = Twijfelachtig — weinig bewijs, gok op basis van context
  1 = Onzeker — geen duidelijke match, vul in als best guess

Overweeg actief welke score van toepassing is. Geef niet standaard een hoge score.

Return ONLY a valid JSON array, no markdown, no explanation.`

    const responseText = await invoke<string>('copilot_request', {
      args: {
        token: this.copilotToken,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      },
    })

    const data = JSON.parse(responseText) as CopilotResponse
    const raw = data.choices[0]?.message.content ?? '[]'
    // Strip markdown code fences if present
    const content = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

    let results: LLMBlockResult[]
    try {
      results = JSON.parse(content) as LLMBlockResult[]
    } catch {
      throw new Error('Copilot returned invalid JSON')
    }

    if (!Array.isArray(results)) {
      throw new Error('Copilot returned unexpected response format (not an array)')
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
    model = 'gpt-4o',
  ): Promise<DayClassificationResult[]> {
    const pad = (n: number) => String(n).padStart(2, '0')
    const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

    const projectList = availableProjects
      .map(p => `- id: "${p.id}", name: "${p.name}"`)
      .join('\n')
    const serviceList = availableServices
      .map(s => `- id: "${s.id}", name: "${s.name}", projectId: "${s.projectId}"`)
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

    const historicalSection = historicalEntries && historicalEntries.length > 0
      ? formatHistoricalEntries(historicalEntries, availableProjects, availableServices) + '\n'
      : ''

    const prompt = `Je bent een tijdregistratie-assistent die een developer helpt zijn werkuren te registreren.

Datum: ${date}

Voor elk genummerd item hieronder geef je één boekingsblok terug.
- Vergadering-items: gebruik de vergader-duur voor startTime/endTime/hours
- Losse items: gebruik de browse-duur

Analyseer ook de historische boekingen op terugkerende patronen:
- Een patroon is een combinatie van project+dienst die op vergelijkbare intervallen voorkomt (bijv. elke week, elke 2 weken)
- Als een patroon matcht met de doeldatum (${date}) EN er is geen browser-activiteit of calendar-event voor die combinatie, voeg dan een extra item toe in "patternBlocks"
- Gebruik het historisch gemiddelde voor de geschatte duur (estimatedHours)
- Geef patronen hogere confidence dan losse browser-activiteit zonder aanvullende context

${meetingsSection}${standaloneSection}${hintsSection}${contextSection}${historicalSection}Beschikbare projecten:
${projectList}

Beschikbare diensten (gekoppeld aan projecten via projectId):
${serviceList}

Geef een JSON-object terug met twee velden:
- "blocks": array van geclassificeerde items (één per genummerd blok hierboven)
- "patternBlocks": array van extra blokken die puur op patroonherkenning zijn gebaseerd (kan leeg zijn)

Elk item in "blocks" heeft:
- index (number, exact overeenkomend met het [N]-nummer hierboven)
- blockName (string, leesbare naam max 60 tekens, bv. "Standup — PR review")
- summary (string, korte samenvatting wat er gedaan is, max 120 tekens, Nederlands)
- projectId (string | null, moet een van de beschikbare project-ID's zijn)
- serviceId (string | null, moet een dienst-ID zijn waarvan projectId overeenkomt)
- note (string, korte boekingsnotitie max 80 tekens)
- confidence (integer 1–5):
  5 = Zeer zeker — project, service en tijdstip kloppen precies met de agenda
  4 = Zeker — goede match, klein detail ontbreekt of is afgeleid
  3 = Aannemelijk — patroon klopt, maar meerdere opties waren mogelijk
  2 = Twijfelachtig — weinig bewijs, gok op basis van context
  1 = Onzeker — geen duidelijke match, vul in als best guess

Overweeg actief welke score van toepassing is. Geef niet standaard een hoge score.
- relatedIssueIds (string[], identifiers van Linear issues die bij dit blok horen. Lege array als niets van toepassing.)

Elk item in "patternBlocks" heeft:
- blockName (string, leesbare naam max 60 tekens)
- summary (string, korte samenvatting, max 120 tekens, Nederlands)
- projectId (string | null)
- serviceId (string | null)
- note (string, max 80 tekens)
- confidence (integer 1–5):
  5 = Zeer zeker — patroon klopt exact en er is geen andere activiteit die het al dekt
  4 = Zeker — sterk patroon, kleine twijfel
  3 = Aannemelijk — patroon klopt, maar minder frequent of recent
  2 = Twijfelachtig — zwak patroon, weinig historisch bewijs
  1 = Onzeker — nauwelijks bewijs voor dit patroon

Overweeg actief welke score van toepassing is. Geef niet standaard een hoge score.
- estimatedHours (number, schatting in uren op basis van historisch gemiddelde)
- origin (altijd "llm-pattern")

BELANGRIJK: Voeg een item ALLEEN toe aan "patternBlocks" als het project+dienst NIET al voorkomt in "blocks". Als hetzelfde project+dienst al in "blocks" staat (via browser-activiteit of agenda), voeg het dan NIET toe aan "patternBlocks".

Gebruik de cache-hints als leidraad maar overschrijf ze als de context duidelijk op een ander project wijst.
Geef ALLEEN een geldig JSON-object terug, geen markdown, geen uitleg.`

    const responseText = await invoke<string>('copilot_request', {
      args: {
        token: this.copilotToken,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      },
    })

    const data = JSON.parse(responseText) as CopilotResponse
    const raw = data.choices[0]?.message.content ?? '[]'
    const content = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()

    interface ClassifyDayLLMResponse {
      blocks: DayClassificationResult[]
      patternBlocks?: PatternBlock[]
    }

    let parsed: ClassifyDayLLMResponse | DayClassificationResult[]
    try {
      parsed = JSON.parse(content) as ClassifyDayLLMResponse | DayClassificationResult[]
    } catch {
      throw new Error('Copilot returned invalid JSON for classifyDay')
    }

    // Backward compat: als de LLM een array teruggeeft (geen patternBlocks)
    if (Array.isArray(parsed)) {
      return parsed
    }

    if (!Array.isArray(parsed.blocks)) {
      throw new Error('Copilot classifyDay returned unexpected format')
    }

    // Encodeer patternBlocks als DayClassificationResult met negatieve index en isPatternBlock: true
    const patternResults: DayClassificationResult[] = (parsed.patternBlocks ?? []).map((pb, i) => ({
      index: -1000 - i,
      blockName: pb.blockName,
      summary: pb.summary,
      projectId: pb.projectId,
      serviceId: pb.serviceId,
      note: pb.note,
      confidence: toConfidenceScore(pb.confidence),
      relatedIssueIds: [],
      isPatternBlock: true,
      estimatedHours: pb.estimatedHours,
    }))

    return [...parsed.blocks, ...patternResults]
  }

  async listModels(): Promise<CopilotModel[]> {
    const responseText = await invoke<string>('copilot_get', {
      args: {
        token: this.copilotToken,
        endpoint: 'https://api.githubcopilot.com/models',
      },
    })

    interface ModelsApiResponse {
      data: Array<{
        id: string
        name?: string
        policy?: {
          state?: string
          terms?: string
          premium_model_multiplier?: number
        }
      }>
    }

    const data = JSON.parse(responseText) as ModelsApiResponse
    return (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      tokenMultiplier: m.policy?.premium_model_multiplier ?? 1.0,
    }))
  }
}
