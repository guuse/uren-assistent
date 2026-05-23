// src/infrastructure/linear/LinearRepository.ts
import type { ILinearRepository } from '../../domain/repositories/ILinearRepository'
import type { LinearIssue } from '../../domain/entities/LinearIssue'

interface LinearIssueNode {
  identifier: string
  title: string
  completedAt: string
  url: string
}

interface LinearResponse {
  data: {
    issues: {
      nodes: LinearIssueNode[]
    }
  }
  errors?: Array<{ message: string }>
}

export class LinearRepository implements ILinearRepository {
  constructor(private readonly token: string) {}

  async getCompletedIssuesForWeek(weekStart: string, weekEnd: string): Promise<LinearIssue[]> {
    const query = `
      query CompletedIssues($weekStart: DateTime!, $weekEnd: DateTime!) {
        issues(
          filter: {
            completedAt: { gte: $weekStart, lte: $weekEnd }
            assignee: { isMe: { eq: true } }
          }
          first: 50
        ) {
          nodes {
            identifier
            title
            completedAt
            url
          }
        }
      }
    `

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          weekStart: `${weekStart}T00:00:00Z`,
          weekEnd: `${weekEnd}T23:59:59Z`,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status}`)
    }

    const data = await response.json() as LinearResponse
    if (data.errors?.length) {
      throw new Error(`Linear GraphQL error: ${data.errors[0]!.message}`)
    }

    return data.data.issues.nodes.map(node => ({
      identifier: node.identifier,
      title: node.title,
      completedAt: node.completedAt,
      url: node.url,
    }))
  }
}
