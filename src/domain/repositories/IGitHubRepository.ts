// src/domain/repositories/IGitHubRepository.ts
import type { GitHubCommit } from '../entities/GitHubCommit'

export interface IGitHubRepository {
  getCommitsForWeek(
    username: string,
    weekStart: string,
    weekEnd: string,
  ): Promise<GitHubCommit[]>
}
