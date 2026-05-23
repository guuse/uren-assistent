import type { ICopilotRepository, DayItem, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { DayContext } from '../entities/DayContext'
import { attachHistoryToMeetings } from './attachHistoryToMeetings'

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return url
  }
}

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
    context?: DayContext,
  ): Promise<ClassifiedBlock[]> {
    const { groups, unclaimed } = attachHistoryToMeetings(historyBlocks, calendarEvents)

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
          ...(context?.commits !== undefined ? { commits: context.commits } : {}),
          ...(context?.linearIssues !== undefined ? { linearIssues: context.linearIssues } : {}),
        })
      } else {
        llmItems.push(item)
      }
    }

    const llmResults: ClassifiedBlock[] = []
    if (llmItems.length > 0) {
      const results = await this.copilotRepo.classifyDay(
        date,
        llmItems,
        this.availableProjects,
        this.availableServices,
        cacheHints,
        context,
      )

      for (const result of results) {
        const matchedItem = llmItems.find(i => i.index === result.index)
        if (!matchedItem) continue

        if (matchedItem.kind === 'meeting') {
          const event = matchedItem.event
          const hBlocks = matchedItem.historyBlocks
          const meetingUrls = hBlocks.flatMap(b => b.urls)
          const meetingTitles = hBlocks.flatMap(b => b.titles)
          const classified: ClassifiedBlock = {
            date,
            urlPattern: matchedItem.cacheKey,
            urls: meetingUrls,
            titles: meetingTitles,
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
            rawTitles: meetingTitles.slice(0, 5),
            rawUrls: meetingUrls.slice(0, 5).map(sanitizeUrl),
            ...(context?.commits !== undefined ? { commits: context.commits } : {}),
            ...(context?.linearIssues !== undefined ? { linearIssues: context.linearIssues } : {}),
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
            rawTitles: block.titles.slice(0, 5),
            rawUrls: block.urls.slice(0, 5).map(sanitizeUrl),
            ...(context?.commits !== undefined ? { commits: context.commits } : {}),
            ...(context?.linearIssues !== undefined ? { linearIssues: context.linearIssues } : {}),
          }
          if (result.projectId !== null) classified.projectId = result.projectId
          if (result.serviceId !== null) classified.serviceId = result.serviceId
          llmResults.push(classified)
        }
      }
    }

    const all = [...cacheResults, ...llmResults]
    all.sort((a, b) => a.startTime.localeCompare(b.startTime))
    return all
  }
}
