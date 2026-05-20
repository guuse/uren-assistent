import type { ICopilotRepository, DayItem, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import { attachHistoryToMeetings } from './attachHistoryToMeetings'

function toTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function roundToHalf(hours: number): number {
  return Math.max(0.5, Math.round(hours * 2) / 2)
}

export class GroupAndClassifyDayUseCase {
  constructor(
    private readonly copilotRepo: ICopilotRepository,
    private readonly cacheRepo: IMappingCacheRepository,
    private readonly availableProjects: Project[],
    private readonly availableServices: Service[],
  ) {}

  async execute(
    date: string,
    historyBlocks: HistoryBlock[],
    calendarEvents: CalendarEvent[],
  ): Promise<ClassifiedBlock[]> {
    const { groups, unclaimed } = attachHistoryToMeetings(historyBlocks, calendarEvents)

    // Build DayItem[] with sequential indices
    const items: DayItem[] = []
    let index = 0

    for (const group of groups) {
      const dominant = group.historyBlocks.reduce<HistoryBlock | undefined>(
        (best, b) => (!best || b.visitCount > best.visitCount ? b : best),
        undefined,
      )
      const cacheKey = dominant
        ? `${group.event.title}:${dominant.urlPattern}`
        : `${group.event.title}:_solo`
      items.push({ kind: 'meeting', index, event: group.event, historyBlocks: group.historyBlocks, cacheKey })
      index++
    }

    for (const block of unclaimed) {
      items.push({ kind: 'standalone', index, block, cacheKey: block.urlPattern })
      index++
    }

    // Build cache hints
    const allCache = this.cacheRepo.getAll()
    const cacheHints: Record<string, { projectName: string; serviceName: string }> = {}
    for (const item of items) {
      const cached = allCache[item.cacheKey]
      if (cached) {
        const project = this.availableProjects.find(p => p.id === cached.projectId)
        const service = this.availableServices.find(s => s.id === cached.serviceId)
        cacheHints[item.cacheKey] = {
          projectName: project?.name ?? '',
          serviceName: service?.name ?? '',
        }
      }
    }

    // Separate cache hits (standalone only) from LLM items
    const cacheResults: ClassifiedBlock[] = []
    const llmItems: DayItem[] = []

    for (const item of items) {
      if (item.kind === 'standalone' && allCache[item.cacheKey]) {
        const cached = allCache[item.cacheKey]!
        cacheResults.push({
          ...item.block,
          blockName: cached.blockName ?? item.block.urlPattern,
          summary: cached.summary ?? '',
          startTime: item.block.firstVisitTime,
          endTime: item.block.lastVisitTime,
          projectId: cached.projectId,
          serviceId: cached.serviceId,
          note: cached.note,
          confidence: 1,
          origin: 'cache',
        })
      } else {
        llmItems.push(item)
      }
    }

    // Call LLM for remaining items
    const llmResults: ClassifiedBlock[] = []
    if (llmItems.length > 0) {
      const results = await this.copilotRepo.classifyDay(date,
        llmItems,
        this.availableProjects,
        this.availableServices,
        cacheHints,
      )

      for (const result of results) {
        const matchedItem = llmItems.find(i => i.index === result.index)
        if (!matchedItem) continue

        if (matchedItem.kind === 'meeting') {
          const event = matchedItem.event
          const hBlocks = matchedItem.historyBlocks
          const classified: ClassifiedBlock = {
            date,
            urlPattern: matchedItem.cacheKey,
            urls: hBlocks.flatMap(b => b.urls),
            titles: hBlocks.flatMap(b => b.titles),
            visitCount: hBlocks.reduce((sum, b) => sum + b.visitCount, 0),
            firstVisitTime: toTime(event.start),
            lastVisitTime: toTime(event.end),
            hours: roundToHalf((event.end.getTime() - event.start.getTime()) / 3_600_000),
            blockName: result.blockName,
            summary: result.summary,
            startTime: toTime(event.start),
            endTime: toTime(event.end),
            note: result.note,
            confidence: result.confidence,
            origin: 'llm',
            overlappingMeetings: [event],
          }
          if (result.projectId !== null) classified.projectId = result.projectId
          if (result.serviceId !== null) classified.serviceId = result.serviceId
          llmResults.push(classified)
        } else {
          const block = matchedItem.block
          const classified: ClassifiedBlock = {
            ...block,
            blockName: result.blockName,
            summary: result.summary,
            startTime: block.firstVisitTime,
            endTime: block.lastVisitTime,
            note: result.note,
            confidence: result.confidence,
            origin: 'llm',
          }
          if (result.projectId !== null) classified.projectId = result.projectId
          if (result.serviceId !== null) classified.serviceId = result.serviceId
          llmResults.push(classified)
        }
      }
    }

    // Merge and sort by startTime ascending
    const all = [...cacheResults, ...llmResults]
    all.sort((a, b) => a.startTime.localeCompare(b.startTime))
    return all
  }
}
