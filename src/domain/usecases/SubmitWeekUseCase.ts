import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

// Submits ("indient") a timesheet week of hours to Simplicate, which locks it.
// Simplicate requires a full calendar week: start_date a Monday, end_date a Sunday.
export class SubmitWeekUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  // from/to: ISO dates (YYYY-MM-DD); a Monday and the Sunday of the same week.
  async execute(employeeId: string, from: string, to: string): Promise<void> {
    if (!employeeId) throw new Error('Geen medewerker bekend om uren voor in te dienen')
    if (!from || !to) throw new Error('Weekgrenzen ontbreken')
    await this.simplicateRepo.submitHours(employeeId, from, to)
  }
}
