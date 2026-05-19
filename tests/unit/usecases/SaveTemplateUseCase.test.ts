import { describe, it, expect, vi } from 'vitest'
import { SaveTemplateUseCase } from '../../../src/domain/usecases/SaveTemplateUseCase'
import type { ITemplateRepository } from '../../../src/domain/repositories/ITemplateRepository'
import type { SingleTemplate } from '../../../src/domain/entities/Template'

const mockRepo: ITemplateRepository = {
  getAll: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
}

const template: SingleTemplate = {
  id: 'abc', name: 'Review', type: 'single', color: '#fff',
  startTime: '10:00', endTime: '11:00',
}

describe('SaveTemplateUseCase', () => {
  it('saves a valid template', async () => {
    vi.mocked(mockRepo.save).mockResolvedValueOnce(undefined)
    const useCase = new SaveTemplateUseCase(mockRepo)
    await useCase.execute(template)
    expect(mockRepo.save).toHaveBeenCalledWith(template)
  })

  it('throws when name is empty', async () => {
    const useCase = new SaveTemplateUseCase(mockRepo)
    await expect(useCase.execute({ ...template, name: '' })).rejects.toThrow('Template name is required')
  })
})
