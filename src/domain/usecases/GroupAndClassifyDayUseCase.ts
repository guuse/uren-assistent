import type { ICopilotRepository, DayItem, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'
import type { CalendarEvent } from '../entities/CalendarEvent'
import type { HistoryBlock } from '../entities/HistoryBlock'
import type { HourEntry } from '../entities/HourEntry'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { DayContext } from '../entities/DayContext'
import { attachHistoryToMeetings } from './attachHistoryToMeetings'
import { toConfidenceScore } from './toConfidenceScore'
import { mappingCacheKey } from './mappingCacheKey'
import { consolidateByProjectService } from './consolidateByProjectService'

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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
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
    private readonly historicalEntries: HourEntry[] = [],
  ) {}

  /**
   * Resolves the hour type for a chosen service. Hour types are scoped to the
   * service, so this can only run after the project/service is known. Returns the
   * LLM's value when it's valid for the service, otherwise falls back to the
   * service's first hour type so a booked block always has a "urensoort".
   */
  private resolveHourTypeId(serviceId: string | undefined, llmHourTypeId?: string | null): string | undefined {
    if (!serviceId) return undefined
    const hourTypes = this.availableServices.find(s => s.id === serviceId)?.hourTypes ?? []
    if (llmHourTypeId && hourTypes.some(h => h.id === llmHourTypeId)) return llmHourTypeId
    return hourTypes[0]?.id
  }

  async execute(
    date: string,
    historyBlocks: HistoryBlock[],
    calendarEvents: CalendarEvent[],
    context?: DayContext,
    existingEntries: HourEntry[] = [],
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
        ? `${group.event.title}:${mappingCacheKey(dominant.urlPattern)}`
        : `${group.event.title}:_solo`
      items.push({ kind: 'meeting', index, event: group.event, historyBlocks: group.historyBlocks, cacheKey })
      index++
    }

    for (const block of unclaimed) {
      items.push({ kind: 'standalone', index, block, cacheKey: mappingCacheKey(block.urlPattern) })
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
          ...(this.resolveHourTypeId(cached.serviceId) !== undefined ? { hourTypeId: this.resolveHourTypeId(cached.serviceId)! } : {}),
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
    const patternClassified: ClassifiedBlock[] = []
    if (llmItems.length > 0) {
      const results = await this.copilotRepo.classifyDay(
        date,
        llmItems,
        this.availableProjects,
        this.availableServices,
        cacheHints,
        context,
        this.historicalEntries,
        existingEntries,
      )

      // Verwerk patroonblokken (isPatternBlock: true, aangemaakt door LLM op basis van patroonherkenning)
      patternClassified.push(...results
        .filter(r => r.isPatternBlock === true)
        .map(r => {
          const block: ClassifiedBlock = {
            date,
            urlPattern: `llm-pattern:${r.blockName}`,
            urls: [],
            titles: [r.blockName],
            visitCount: 0,
            firstVisitTime: '00:00',
            lastVisitTime: '00:00',
            hours: r.estimatedHours ?? 1,
            blockName: r.blockName,
            summary: r.summary,
            startTime: '00:00',
            endTime: '00:00',
            note: r.note,
            confidence: toConfidenceScore(r.confidence),
            origin: 'llm-pattern' as const,
            rawTitles: [],
            rawUrls: [],
          }
          if (r.projectId !== null) block.projectId = r.projectId
          if (r.serviceId !== null) block.serviceId = r.serviceId
          const ht = this.resolveHourTypeId(block.serviceId, r.hourTypeId)
          if (ht !== undefined) block.hourTypeId = ht
          return block
        }))

      const regularResults = results.filter(r => r.isPatternBlock !== true)

      for (const result of regularResults) {
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
            confidence: toConfidenceScore(result.confidence),
            origin: 'llm',
            overlappingMeetings: [event],
            rawTitles: meetingTitles.slice(0, 5),
            rawUrls: meetingUrls.slice(0, 5).map(sanitizeUrl),
            ...(context?.commits !== undefined ? { commits: context.commits } : {}),
            ...((() => {
              if (!context?.linearIssues?.length) return {}
              if (result.relatedIssueIds && result.relatedIssueIds.length > 0) {
                const relatedSet = new Set(result.relatedIssueIds)
                return { linearIssues: context.linearIssues.filter(i => relatedSet.has(i.identifier)) }
              }
              return { linearIssues: context.linearIssues }
            })()),
          }
          if (result.projectId !== null) classified.projectId = result.projectId
          if (result.serviceId !== null) classified.serviceId = result.serviceId
          const ht = this.resolveHourTypeId(classified.serviceId, result.hourTypeId)
          if (ht !== undefined) classified.hourTypeId = ht
          llmResults.push(classified)
        } else {
          const block = matchedItem.block

          // Voor commit-blocks: filter commits op deze repo + tijdsperiode
          // urlPattern = "github.com/owner/repo@HH:mm"
          let blockCommits = context?.commits
          if (block.urlPattern.startsWith('github.com/') && context?.commits) {
            const repoUrl = block.urlPattern.split('@')[0]!  // "github.com/owner/repo"
            const repo = repoUrl.replace('github.com/', '')  // "owner/repo"
            const startMin = timeToMinutes(block.firstVisitTime)
            const endMin = timeToMinutes(block.lastVisitTime)
            blockCommits = context.commits.filter(c =>
              c.repo === repo &&
              timeToMinutes(c.time) >= startMin &&
              timeToMinutes(c.time) <= endMin
            )
          }

          // Linear issues koppelen via LLM-output (relatedIssueIds), met heuristiek als fallback.
          let blockLinearIssues = context?.linearIssues ?? []
          if (context?.linearIssues?.length) {
            // Stap 1: gebruik LLM-bepaalde issue-koppeling
            if (result.relatedIssueIds && result.relatedIssueIds.length > 0) {
              const relatedSet = new Set(result.relatedIssueIds)
              blockLinearIssues = context.linearIssues.filter(i => relatedSet.has(i.identifier))
            } else if (block.urlPattern.startsWith('github.com/')) {
              // Stap 2 (fallback): expliciete refs in commit-berichten
              const allMessages = block.titles.join(' ')
              const explicitRefs = new Set((allMessages.match(/[A-Z]+-\d+/g) ?? []))
              if (explicitRefs.size > 0) {
                blockLinearIssues = context.linearIssues.filter(i => explicitRefs.has(i.identifier))
              } else {
                // Geen koppeling gevonden — lege lijst voor commit-blocks
                blockLinearIssues = []
              }
            }
          }

          const classified: ClassifiedBlock = {
            ...block,
            blockName: result.blockName,
            summary: result.summary,
            startTime: block.firstVisitTime,
            endTime: block.lastVisitTime,
            note: result.note,
            confidence: toConfidenceScore(result.confidence),
            origin: 'llm',
            rawTitles: block.titles.slice(0, 5),
            rawUrls: block.urls.slice(0, 5).map(sanitizeUrl),
            ...(blockCommits !== undefined ? { commits: blockCommits } : {}),
            ...(blockLinearIssues !== undefined ? { linearIssues: blockLinearIssues } : {}),
          }
          if (result.projectId !== null) classified.projectId = result.projectId
          if (result.serviceId !== null) classified.serviceId = result.serviceId
          const ht = this.resolveHourTypeId(classified.serviceId, result.hourTypeId)
          if (ht !== undefined) classified.hourTypeId = ht
          llmResults.push(classified)
        }
      }
    }

    // Fold observed activity for one project+service into a single Project block
    // (multiple PR-merges / commit sessions / browser blocks → one block). Meeting
    // blocks and fill candidates are left untouched (see consolidateByProjectService).
    const observed = consolidateByProjectService([...cacheResults, ...llmResults])

    const coveredProjectService = new Set(
      observed
        .filter(b => b.projectId && b.serviceId)
        .map(b => `${b.projectId}__${b.serviceId}`)
    )
    const dedupedPatterns = patternClassified.filter(
      b => !b.projectId || !b.serviceId || !coveredProjectService.has(`${b.projectId}__${b.serviceId}`)
    )

    const all = [...observed, ...dedupedPatterns]
    all.sort((a, b) => a.startTime.localeCompare(b.startTime))
    return all
  }
}
