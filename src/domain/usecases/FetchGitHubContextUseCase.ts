import type { IGitHubRepository } from '../repositories/IGitHubRepository'
import type { GitHubCommit } from '../entities/GitHubCommit'

export class FetchGitHubContextUseCase {
  constructor(private readonly repo: IGitHubRepository) {}

  async execute(username: string, weekStart: string, weekEnd: string): Promise<GitHubCommit[]> {
    try {
      return await this.repo.getCommitsForWeek(username, weekStart, weekEnd)
    } catch {
      return []
    }
  }
}
