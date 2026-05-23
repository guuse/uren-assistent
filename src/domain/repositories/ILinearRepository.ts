// src/domain/repositories/ILinearRepository.ts
import type { LinearIssue } from '../entities/LinearIssue'

export interface ILinearRepository {
  getCompletedIssuesForWeek(
    weekStart: string,
    weekEnd: string,
  ): Promise<LinearIssue[]>
}
