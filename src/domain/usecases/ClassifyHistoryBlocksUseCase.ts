import type { HistoryBlock } from '../entities/HistoryBlock'
import { toConfidenceScore } from './toConfidenceScore'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const totalMinutes = h * 60 + m + Math.round(hours * 60)
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

function getOverlappingMeetings(block: HistoryBlock, events: CalendarEvent[]): CalendarEvent[] {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number) as [number, number]
    return h * 60 + m
  }
  const blockStart = toMinutes(block.firstVisitTime)
  const blockEnd = toMinutes(block.lastVisitTime || addHoursToTime(block.firstVisitTime, block.hours))

  return events.filter(ev => {
    const evDate = ev.start.toISOString().slice(0, 10)
    if (evDate !== block.date) return false
    const pad = (n: number) => String(n).padStart(2, '0')
    const evStart = toMinutes(`${pad(ev.start.getHours())}:${pad(ev.start.getMinutes())}`)
    const evEnd = toMinutes(`${pad(ev.end.getHours())}:${pad(ev.end.getMinutes())}`)
    return evStart < blockEnd && evEnd > blockStart
  })
}

export class ClassifyHistoryBlocksUseCase {
  constructor(
    private copilot: ICopilotRepository,
    private cache: IMappingCacheRepository,
  ) {}

  async execute(
    blocks: HistoryBlock[],
    projects: Project[],
    services: Service[],
    calendarEvents: CalendarEvent[] = [],
  ): Promise<ClassifiedBlock[]> {
    const cacheHits: ClassifiedBlock[] = []
    const needsLLM: HistoryBlock[] = []

    for (const block of blocks) {
      const cached = this.cache.get(block.urlPattern)
      if (cached) {
        cacheHits.push({
          ...block,
          blockName: cached.blockName ?? block.urlPattern,
          summary: cached.summary ?? '',
          startTime: block.firstVisitTime,
          endTime: block.lastVisitTime || addHoursToTime(block.firstVisitTime, block.hours),
          projectId: cached.projectId,
          serviceId: cached.serviceId,
          note: cached.note,
          confidence: 5,
          origin: 'cache',
          overlappingMeetings: getOverlappingMeetings(block, calendarEvents),
        })
      } else {
        needsLLM.push(block)
      }
    }

    let llmResults: ClassifiedBlock[] = []
    if (needsLLM.length > 0) {
      // Attach overlapping meetings to each block before sending to LLM
      const blocksWithMeetings = needsLLM.map(b => ({
        ...b,
        overlappingMeetings: getOverlappingMeetings(b, calendarEvents),
      }))
      const raw = await this.copilot.classify(blocksWithMeetings, projects, services, calendarEvents)
      llmResults = raw.map(r => ({
        ...r,
        confidence: toConfidenceScore(r.confidence),
      }))
    }

    const resultMap = new Map<string, ClassifiedBlock>()
    for (const r of [...cacheHits, ...llmResults]) {
      resultMap.set(`${r.date}__${r.urlPattern}`, r)
    }

    return blocks.map(b => resultMap.get(`${b.date}__${b.urlPattern}`)!)
  }
}
