import type { ILinearRepository } from '../repositories/ILinearRepository'
import type { LinearIssue } from '../entities/LinearIssue'

export class FetchLinearContextUseCase {
  constructor(private readonly repo: ILinearRepository) {}

  async execute(weekStart: string, weekEnd: string): Promise<LinearIssue[]> {
    try {
      return await this.repo.getCompletedIssuesForWeek(weekStart, weekEnd)
    } catch {
      return []
    }
  }
}
