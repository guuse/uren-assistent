import type { HistoryBlock } from '../entities/HistoryBlock'
import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { ICopilotRepository, Project, Service } from '../repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../repositories/IMappingCacheRepository'

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number) as [number, number]
  const totalMinutes = h * 60 + m + Math.round(hours * 60)
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
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
  ): Promise<ClassifiedBlock[]> {
    const cacheHits: ClassifiedBlock[] = []
    const needsLLM: HistoryBlock[] = []

    for (const block of blocks) {
      const cached = this.cache.get(block.urlPattern)
      if (cached) {
        cacheHits.push({
          ...block,
          blockName: block.urlPattern,
          summary: '',
          startTime: block.firstVisitTime,
          endTime: addHoursToTime(block.firstVisitTime, block.hours),
          projectId: cached.projectId,
          serviceId: cached.serviceId,
          note: cached.note,
          confidence: 1.0,
          origin: 'cache',
        })
      } else {
        needsLLM.push(block)
      }
    }

    let llmResults: ClassifiedBlock[] = []
    if (needsLLM.length > 0) {
      try {
        const raw = await this.copilot.classify(needsLLM, projects, services)
        llmResults = raw.map(r => ({
          ...r,
          confidence: Math.min(1, Math.max(0, r.confidence)),
        }))
      } catch {
        llmResults = needsLLM.map(block => ({
          ...block,
          blockName: block.urlPattern,
          summary: '',
          startTime: block.firstVisitTime,
          endTime: addHoursToTime(block.firstVisitTime, block.hours),
          confidence: 0,
          origin: 'manual' as const,
        }))
      }
    }

    const resultMap = new Map<string, ClassifiedBlock>()
    for (const r of [...cacheHits, ...llmResults]) {
      resultMap.set(`${r.date}__${r.urlPattern}`, r)
    }

    return blocks.map(b => resultMap.get(`${b.date}__${b.urlPattern}`)!)
  }
}
