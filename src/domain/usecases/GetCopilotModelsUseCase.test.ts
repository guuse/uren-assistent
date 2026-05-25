import { describe, it, expect, vi } from 'vitest'
import { GetCopilotModelsUseCase } from './GetCopilotModelsUseCase'
import type { ICopilotRepository } from '../repositories/ICopilotRepository'

const mockRepo = {
  classify: vi.fn(),
  classifyDay: vi.fn(),
  listModels: vi.fn(),
} as unknown as ICopilotRepository

describe('GetCopilotModelsUseCase', () => {
  it('returns models from repository', async () => {
    const models = [{ id: 'gpt-4o', name: 'GPT-4o', category: 'default' }]
    vi.mocked(mockRepo.listModels).mockResolvedValue(models)
    const useCase = new GetCopilotModelsUseCase(mockRepo)
    expect(await useCase.execute()).toEqual(models)
  })

  it('returns empty array when no models available', async () => {
    vi.mocked(mockRepo.listModels).mockResolvedValue([])
    const useCase = new GetCopilotModelsUseCase(mockRepo)
    expect(await useCase.execute()).toEqual([])
  })
})
