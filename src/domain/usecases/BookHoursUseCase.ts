import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

export class BookHoursUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(entry: HourEntry): Promise<void> {
    const required: (keyof HourEntry)[] = [
      'employeeId',
      'projectId',
      'projectServiceId',
      'hourTypeId',
      'startDate',
      'startTime',
      'endTime',
    ]
    for (const field of required) {
      if (!entry[field]) {
        throw new Error(`Verplicht veld ontbreekt: ${field}`)
      }
    }
    await this.simplicateRepo.bookHours([entry])
  }
}
