// src/domain/entities/LinearIssue.ts
export interface LinearIssue {
  identifier: string  // "ENG-42"
  title: string
  completedAt: string // ISO 8601
  url: string
}
