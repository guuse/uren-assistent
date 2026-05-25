import { describe, it, expect, vi } from 'vitest'
import { GetSelectedModelUseCase } from './GetSelectedModelUseCase'
import type { ISettingsRepository } from '../repositories/ISettingsRepository'

const mockRepo = {
  getSelectedModel: vi.fn(),
  setSelectedModel: vi.fn(),
} as unknown as ISettingsRepository

describe('GetSelectedModelUseCase', () => {
  it('returns stored model id', async () => {
    vi.mocked(mockRepo.getSelectedModel).mockResolvedValue('claude-sonnet')
    const useCase = new GetSelectedModelUseCase(mockRepo)
    expect(await useCase.execute()).toBe('claude-sonnet')
  })

  it('returns null when no model stored', async () => {
    vi.mocked(mockRepo.getSelectedModel).mockResolvedValue(null)
    const useCase = new GetSelectedModelUseCase(mockRepo)
    expect(await useCase.execute()).toBeNull()
  })
})
