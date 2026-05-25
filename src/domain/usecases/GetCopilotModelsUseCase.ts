import type { CopilotModel } from '../entities/CopilotModel'
import type { ICopilotRepository } from '../repositories/ICopilotRepository'

export class GetCopilotModelsUseCase {
  constructor(private readonly copilotRepo: ICopilotRepository) {}

  async execute(): Promise<CopilotModel[]> {
    return this.copilotRepo.listModels()
  }
}
