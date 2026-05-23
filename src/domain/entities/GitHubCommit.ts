// src/domain/entities/GitHubCommit.ts
export interface GitHubCommit {
  sha: string
  message: string   // eerste regel van commit message
  repo: string      // "owner/repo"
  branch: string
  timestamp: string // ISO 8601
  time: string      // "HH:MM" lokale tijd
}
