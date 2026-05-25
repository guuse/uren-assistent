import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

export class DeleteHourEntryUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(id: string): Promise<void> {
    if (!id) throw new Error('id ontbreekt')
    await this.simplicateRepo.deleteHourEntry(id)
  }
}
