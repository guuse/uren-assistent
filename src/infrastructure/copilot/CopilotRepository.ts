import { invoke } from '@tauri-apps/api/core'
import type { ICopilotRepository, Project, Service } from '../../domain/repositories/ICopilotRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'

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

export class CopilotRepository implements ICopilotRepository {
  constructor(private readonly copilotToken: string) {}

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
- confidence (number 0-1, how confident you are in the project match)

Return ONLY a valid JSON array, no markdown, no explanation.`

    const responseText = await invoke<string>('copilot_request', {
      args: {
        token: this.copilotToken,
        body: JSON.stringify({
          model: 'gpt-4o',
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
        confidence: Math.min(1, Math.max(0, match?.confidence ?? 0)),
        origin: 'llm' as const,
      }
      if (match?.projectId) classified.projectId = match.projectId
      if (match?.serviceId) classified.serviceId = match.serviceId
      if (match?.note) classified.note = match.note
      return classified
    })
  }
}
