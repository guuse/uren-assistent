// src/infrastructure/github/GitHubRepository.ts
import type { IGitHubRepository } from '../../domain/repositories/IGitHubRepository'
import type { GitHubCommit } from '../../domain/entities/GitHubCommit'

interface GitHubPushEvent {
  type: string
  repo: { name: string }
  payload: {
    ref: string
    commits: Array<{ sha: string; message: string }>
  }
  created_at: string
}

function toLocalTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export class GitHubRepository implements IGitHubRepository {
  constructor(private readonly token: string) {}

  async getCommitsForWeek(username: string, weekStart: string, weekEnd: string): Promise<GitHubCommit[]> {
    const url = `https://api.github.com/users/${username}/events?per_page=100`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const events = await response.json() as GitHubPushEvent[]
    const commits: GitHubCommit[] = []

    for (const event of events) {
      if (event.type !== 'PushEvent') continue
      const date = event.created_at.slice(0, 10)
      if (date < weekStart || date > weekEnd) continue

      const branch = event.payload.ref.replace('refs/heads/', '')
      for (const commit of event.payload.commits) {
        commits.push({
          sha: commit.sha.slice(0, 7),
          message: commit.message.split('\n')[0] ?? commit.message,
          repo: event.repo.name,
          branch,
          timestamp: event.created_at,
          time: toLocalTime(event.created_at),
        })
      }
    }

    return commits
  }
}
