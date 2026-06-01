import type { LinearIssue } from '../entities/LinearIssue'
import type { GitHubCommit } from '../entities/GitHubCommit'
import type { HistoryBlock } from '../entities/HistoryBlock'

/**
 * Turns completed Linear issues into their own classifiable blocks — but only
 * the ones a higher-priority source (commits) doesn't already explain.
 *
 * Linear is the 4th source in the priority order (calendar > commits > browser >
 * Linear > trends, see CONTEXT.md). An issue whose identifier appears in a
 * commit message that day is considered covered by that commit (the commit block
 * absorbs it via relatedIssueIds) and gets no block of its own. The rest — e.g. a
 * research or design ticket with no code footprint — become standalone blocks so
 * the day reflects that work too.
 *
 * A completed issue carries no duration, so each block is seeded minimally; the
 * packer grows it toward its project's historical size when filling the day.
 */
const SEED_HOURS = 0.5
const SEED_TIME = '09:00'

export function groupLinearIssuesIntoBlocks(
  issues: LinearIssue[],
  commits: GitHubCommit[],
  date: string,
): HistoryBlock[] {
  const forDate = issues.filter(i => i.completedAt.slice(0, 10) === date)
  if (forDate.length === 0) return []

  const commitText = commits.map(c => c.message).join(' ')
  const coveredByCommit = (identifier: string): boolean => commitText.includes(identifier)

  return forDate
    .filter(issue => !coveredByCommit(issue.identifier))
    .map(issue => ({
      date,
      urlPattern: `linear:${issue.identifier}`,
      urls: [issue.url],
      titles: [`${issue.identifier} · ${issue.title}`],
      visitCount: 1,
      firstVisitTime: SEED_TIME,
      lastVisitTime: SEED_TIME,
      hours: SEED_HOURS,
    }))
}
