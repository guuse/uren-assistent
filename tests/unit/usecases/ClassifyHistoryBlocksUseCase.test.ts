import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClassifyHistoryBlocksUseCase } from '../../../src/domain/usecases/ClassifyHistoryBlocksUseCase'
import type { HistoryBlock } from '../../../src/domain/entities/HistoryBlock'
import type { ICopilotRepository } from '../../../src/domain/repositories/ICopilotRepository'
import type { IMappingCacheRepository } from '../../../src/domain/repositories/IMappingCacheRepository'

const block: HistoryBlock = {
  date: '2026-05-11',
  urlPattern: 'github.com/Harborn-digital/eindhoven-doet',
  titles: ['Eindhoven Doet'],
  visitCount: 8,
  firstVisitTime: '08:30',
  hours: 1.5,
}

function makeBlock(urlPattern: string): HistoryBlock {
  return { ...block, urlPattern }
}

const projects = [{ id: 'p1', name: 'Eindhoven Doet' }]
const services = [{ id: 's1', name: 'Development', projectId: 'p1' }]

describe('ClassifyHistoryBlocksUseCase', () => {
  let mockCopilot: ICopilotRepository
  let mockCache: IMappingCacheRepository
  let useCase: ClassifyHistoryBlocksUseCase

  beforeEach(() => {
    mockCopilot = { classify: vi.fn() }
    mockCache = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({}),
    }
    useCase = new ClassifyHistoryBlocksUseCase(mockCopilot, mockCache)
  })

  it('uses cache for known URL patterns', async () => {
    vi.mocked(mockCache.get).mockReturnValue({ projectId: 'p1', serviceId: 's1', note: 'Dev' })

    const result = await useCase.execute([block], projects, services)

    expect(mockCopilot.classify).not.toHaveBeenCalled()
    expect(result[0]!.origin).toBe('cache')
    expect(result[0]!.confidence).toBe(1.0)
    expect(result[0]!.projectId).toBe('p1')
  })

  it('calls LLM for unknown URL patterns', async () => {
    vi.mocked(mockCache.get).mockReturnValue(undefined)
    vi.mocked(mockCopilot.classify).mockResolvedValue([{
      ...block,
      startTime: '08:30',
      endTime: '10:00',
      projectId: 'p1',
      serviceId: 's1',
      note: 'Eindhoven Doet work',
      confidence: 0.85,
      origin: 'llm',
    }])

    const result = await useCase.execute([block], projects, services)

    expect(mockCopilot.classify).toHaveBeenCalledWith(
      [expect.objectContaining({ urlPattern: block.urlPattern, overlappingMeetings: [] })],
      projects,
      services,
      [],
    )
    expect(result[0]!.origin).toBe('llm')
    expect(result[0]!.confidence).toBe(0.85)
  })

  it('propagates error when LLM fails', async () => {
    vi.mocked(mockCache.get).mockReturnValue(undefined)
    vi.mocked(mockCopilot.classify).mockRejectedValue(new Error('API unreachable'))

    await expect(useCase.execute([block], projects, services)).rejects.toThrow('API unreachable')
  })

  it('mixes cache hits and LLM calls in one batch', async () => {
    const cachedBlock = makeBlock('github.com/Harborn-digital/eindhoven-doet')
    const unknownBlock = makeBlock('hosting.harborn.com/dashboard')

    vi.mocked(mockCache.get).mockImplementation((pattern) =>
      pattern === 'github.com/Harborn-digital/eindhoven-doet'
        ? { projectId: 'p1', serviceId: 's1', note: 'Dev' }
        : undefined
    )
    vi.mocked(mockCopilot.classify).mockResolvedValue([{
      ...unknownBlock,
      startTime: '09:00',
      endTime: '10:00',
      projectId: 'p1',
      serviceId: 's1',
      note: 'Hosting',
      confidence: 0.7,
      origin: 'llm',
    }])

    const result = await useCase.execute([cachedBlock, unknownBlock], projects, services)

    expect(result).toHaveLength(2)
    expect(result.find(r => r.urlPattern === 'github.com/Harborn-digital/eindhoven-doet')!.origin).toBe('cache')
    expect(result.find(r => r.urlPattern === 'hosting.harborn.com/dashboard')!.origin).toBe('llm')
    expect(mockCopilot.classify).toHaveBeenCalledWith(
      [expect.objectContaining({ urlPattern: unknownBlock.urlPattern, overlappingMeetings: [] })],
      projects,
      services,
      [],
    )
  })

  it('sets startTime and endTime from firstVisitTime and hours', async () => {
    vi.mocked(mockCache.get).mockReturnValue({ projectId: 'p1', serviceId: 's1', note: 'Dev' })

    const result = await useCase.execute([block], projects, services)

    expect(result[0]!.startTime).toBe('08:30')
    expect(result[0]!.endTime).toBe('10:00') // 08:30 + 1.5h
  })
})
