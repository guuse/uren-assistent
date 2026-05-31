import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'

// Withdraws ("intrekt") a submitted inclusive date range, unlocking it for editing again.
// Simplicate requires a full calendar week: start_date a Monday, end_date a Sunday.
export class WithdrawSubmissionUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(employeeId: string, from: string, to: string): Promise<void> {
    if (!employeeId) throw new Error('Geen medewerker bekend om indiening voor in te trekken')
    if (!from || !to) throw new Error('Weekgrenzen ontbreken')
    await this.simplicateRepo.withdrawHours(employeeId, from, to)
  }
}
