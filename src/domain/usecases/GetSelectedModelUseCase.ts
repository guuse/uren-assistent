import type { ISettingsRepository } from '../repositories/ISettingsRepository'

export class GetSelectedModelUseCase {
  constructor(private readonly settingsRepo: ISettingsRepository) {}

  async execute(): Promise<string | null> {
    return this.settingsRepo.getSelectedModel()
  }
}
