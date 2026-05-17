import type { ITemplateRepository } from '../repositories/ITemplateRepository'

export class DeleteTemplateUseCase {
  constructor(private readonly templateRepo: ITemplateRepository) {}

  async execute(id: string): Promise<void> {
    await this.templateRepo.delete(id)
  }
}
