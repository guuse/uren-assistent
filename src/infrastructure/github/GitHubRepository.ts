// src/infrastructure/github/GitHubRepository.ts
import type { IGitHubRepository } from '../../domain/repositories/IGitHubRepository'
import type { GitHubCommit } from '../../domain/entities/GitHubCommit'

interface SearchCommitItem {
  sha: string
  commit: {
    message: string
    author: {
      date: string
    }
  }
  repository: {
    full_name: string
  }
}

interface SearchCommitsResponse {
  total_count: number
  items: SearchCommitItem[]
}

function toLocalTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export class GitHubRepository implements IGitHubRepository {
  constructor(private readonly token: string) {}

  async getCommitsForWeek(username: string, weekStart: string, weekEnd: string): Promise<GitHubCommit[]> {
    const commits: GitHubCommit[] = []
    let page = 1

    while (true) {
      const q = `author:${username}+committer-date:${weekStart}..${weekEnd}`
      const url = `https://api.github.com/search/commits?q=${q}&per_page=100&page=${page}`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.cloak-preview+json',
        },
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`GitHub API error: ${response.status} ${body}`)
      }

      const data = await response.json() as SearchCommitsResponse
      console.log(`[GitHub] page ${page}: ${data.items.length} commits van ${data.total_count} totaal`)


      for (const item of data.items) {
        const iso = item.commit.author.date
        const date = new Date(iso)
        // Extract branch is not available in search API — omit
        commits.push({
          sha: item.sha.slice(0, 7),
          message: item.commit.message.split('\n')[0] ?? item.commit.message,
          repo: item.repository.full_name,
          branch: '',
          timestamp: iso,
          time: toLocalTime(iso),
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        })
      }

      // If we got fewer than 100, we're done
      if (data.items.length < 100) break
      // GitHub Search API max 1000 results total
      if (page * 100 >= Math.min(data.total_count, 1000)) break
      page++
    }

    return commits
  }
}
