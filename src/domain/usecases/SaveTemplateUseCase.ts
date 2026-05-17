import type { ITemplateRepository } from '../repositories/ITemplateRepository'
import type { Template } from '../entities/Template'

export class SaveTemplateUseCase {
  constructor(private readonly templateRepo: ITemplateRepository) {}

  async execute(template: Template): Promise<void> {
    if (!template.name.trim()) {
      throw new Error('Template name is required')
    }
    await this.templateRepo.save(template)
  }
}
