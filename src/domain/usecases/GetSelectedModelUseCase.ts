import type { ISettingsRepository } from '../repositories/ISettingsRepository'

const DEFAULT_MODEL = 'gpt-4o'

export class GetSelectedModelUseCase {
  constructor(private readonly settingsRepo: ISettingsRepository) {}

  async execute(): Promise<string> {
    const stored = await this.settingsRepo.getSelectedModel()
    return stored ?? DEFAULT_MODEL
  }
}
