import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

// Submits ("indient") an inclusive date range of hours to Simplicate, which locks it.
// The range is a full Monday–Friday week or a single day (from === to).
export class SubmitWeekUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  // from/to: ISO dates (YYYY-MM-DD). Equal for a single day; Monday/Friday for a week.
  async execute(employeeId: string, from: string, to: string): Promise<void> {
    if (!employeeId) throw new Error('Geen medewerker bekend om uren voor in te dienen')
    if (!from || !to) throw new Error('Weekgrenzen ontbreken')
    await this.simplicateRepo.submitHours(employeeId, from, to)
  }
}
