import { describe, it, expect, vi } from 'vitest'
import { SetSelectedModelUseCase } from './SetSelectedModelUseCase'
import type { ISettingsRepository } from '../repositories/ISettingsRepository'

const mockRepo = {
  getSelectedModel: vi.fn(),
  setSelectedModel: vi.fn(),
} as unknown as ISettingsRepository

describe('SetSelectedModelUseCase', () => {
  it('persists model id to repository', async () => {
    vi.mocked(mockRepo.setSelectedModel).mockResolvedValue(undefined)
    const useCase = new SetSelectedModelUseCase(mockRepo)
    await useCase.execute('gpt-4o')
    expect(mockRepo.setSelectedModel).toHaveBeenCalledWith('gpt-4o')
  })
})
