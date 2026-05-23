// src/domain/entities/DayContext.ts
import type { GitHubCommit } from './GitHubCommit'
import type { LinearIssue } from './LinearIssue'

export interface DayContext {
  commits: GitHubCommit[]       // commits op die specifieke dag
  linearIssues: LinearIssue[]   // afgerond in de week (zelfde lijst elke dag)
}
