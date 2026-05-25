import type { ISettingsRepository } from '../repositories/ISettingsRepository'

export class SetSelectedModelUseCase {
  constructor(private readonly settingsRepo: ISettingsRepository) {}

  async execute(modelId: string): Promise<void> {
    await this.settingsRepo.setSelectedModel(modelId)
  }
}
