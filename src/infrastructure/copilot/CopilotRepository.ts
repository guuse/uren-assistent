// src/infrastructure/copilot/CopilotRepository.ts
import { fetch } from '@tauri-apps/plugin-http'
import type { ICopilotRepository, Project, Service } from '../../domain/repositories/ICopilotRepository'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

const COPILOT_API_URL = 'https://api.githubcopilot.com/chat/completions'

interface CopilotChoice {
  message: { content: string }
}

interface CopilotResponse {
  choices: CopilotChoice[]
}

interface LLMBlockResult {
  urlPattern: string
  projectId: string
  serviceId: string
  note: string
  confidence: number
}

export class CopilotRepository implements ICopilotRepository {
  constructor(private readonly copilotToken: string) {}

  async classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
  ): Promise<ClassifiedBlock[]> {
    const projectList = availableProjects.map(p => `- id: "${p.id}", name: "${p.name}"`).join('\n')
    const serviceList = availableServices.map(s => `- id: "${s.id}", name: "${s.name}", projectId: "${s.projectId}"`).join('\n')
    const blockList = blocks.map(b =>
      `- urlPattern: "${b.urlPattern}", titles: [${b.titles.slice(0, 3).map(t => `"${t}"`).join(', ')}], visitCount: ${b.visitCount}`
    ).join('\n')

    const prompt = `You are a time-tracking assistant. Match browser activity blocks to work projects.

Available projects:
${projectList}

Available services (linked to projects by projectId):
${serviceList}

Browser activity blocks to classify:
${blockList}

For each block, return a JSON array where each item has:
- urlPattern (string, exact match from input)
- projectId (string, must be one of the available project IDs, or null if no match)
- serviceId (string, must be one of the available service IDs for that project, or null)
- note (string, short description of the work, max 80 chars)
- confidence (number 0-1, how confident you are in the match)

Return ONLY valid JSON array, no explanation. Example:
[{"urlPattern":"github.com/org/repo","projectId":"p1","serviceId":"s1","note":"Development work","confidence":0.9}]`

    const response = await fetch(COPILOT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.copilotToken}`,
        'Content-Type': 'application/json',
        'Copilot-Integration-Id': 'quiet-wizard',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      throw new Error(`Copilot API error: ${response.status}`)
    }

    const data = await response.json() as CopilotResponse
    const content = data.choices[0]?.message.content ?? '[]'

    let results: LLMBlockResult[]
    try {
      results = JSON.parse(content) as LLMBlockResult[]
    } catch {
      throw new Error('Copilot returned invalid JSON')
    }

    return blocks.map(block => {
      const match = results.find(r => r.urlPattern === block.urlPattern)
      const addHours = (time: string, hours: number): string => {
        const [h, m] = time.split(':').map(Number) as [number, number]
        const total = h * 60 + m + Math.round(hours * 60)
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
      }
      const classified: ClassifiedBlock = {
        ...block,
        startTime: block.firstVisitTime,
        endTime: addHours(block.firstVisitTime, block.hours),
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
