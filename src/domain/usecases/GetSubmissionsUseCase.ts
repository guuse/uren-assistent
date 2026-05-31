import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { HourSubmission } from '../entities/HourSubmission'

// Fetches the submission status for an employee within an inclusive date range.
// Used to show which weeks are already submitted ("ingediend") — the source of truth
// is Simplicate's submission resource, never the per-entry `locked` flag. See docs/adr/0003.
export class GetSubmissionsUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(employeeId: string, from: string, to: string): Promise<HourSubmission[]> {
    if (!employeeId) return []
    return this.simplicateRepo.getSubmissions(employeeId, from, to)
  }
}
