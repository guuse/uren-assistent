import type { ClassifiedBlock } from '../entities/ClassifiedBlock'
import type { GitHubCommit } from '../entities/GitHubCommit'
import type { LinearIssue } from '../entities/LinearIssue'

/**
 * Folds all observed activity for one project+service on a day into a single
 * "Project block" (see CONTEXT.md). Several commit sessions / PR-merges and
 * browser blocks on the same project+service become one block; the individual
 * PRs/commits survive in its titles, summary and note.
 *
 * Excluded from merging:
 * - Meeting blocks (they carry `overlappingMeetings`): each calendar event is a
 *   distinct anchored block with its own time and name.
 * - Fill candidates (origin 'llm-pattern'): not observed activity.
 * - Blocks without both a project and a service: nothing to key on.
 *
 * Different services under the same project stay separate — a service is a
 * billable distinction and a booking targets exactly one.
 */
export function consolidateByProjectService(blocks: ClassifiedBlock[]): ClassifiedBlock[] {
  const isMergeable = (b: ClassifiedBlock): boolean =>
    b.origin !== 'llm-pattern' &&
    !(b.overlappingMeetings && b.overlappingMeetings.length > 0) &&
    !!b.projectId &&
    !!b.serviceId

  const groups = new Map<string, ClassifiedBlock[]>()
  const passthrough: ClassifiedBlock[] = []

  for (const b of blocks) {
    if (!isMergeable(b)) {
      passthrough.push(b)
      continue
    }
    const key = `${b.projectId}__${b.serviceId}`
    const list = groups.get(key) ?? []
    list.push(b)
    groups.set(key, list)
  }

  const merged: ClassifiedBlock[] = []
  for (const list of groups.values()) {
    merged.push(list.length === 1 ? list[0]! : mergeGroup(list))
  }

  return [...passthrough, ...merged].sort((a, b) => a.startTime.localeCompare(b.startTime))
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function mergeGroup(group: ClassifiedBlock[]): ClassifiedBlock {
  // Dominant block: most hours, then most visits. Its identity (name, urlPattern,
  // hourType, origin) seeds the merged block.
  const dominant = [...group].sort(
    (a, b) => b.hours - a.hours || b.visitCount - a.visitCount,
  )[0]!

  const sorted = [...group].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const titles = uniq(group.flatMap(b => b.titles)).slice(0, 12)
  const urls = uniq(group.flatMap(b => b.urls)).slice(0, 10)
  const rawTitles = uniq(group.flatMap(b => b.rawTitles ?? [])).slice(0, 5)
  const rawUrls = uniq(group.flatMap(b => b.rawUrls ?? [])).slice(0, 5)

  const commits: GitHubCommit[] = group.flatMap(b => b.commits ?? [])
  const linearById = new Map<string, LinearIssue>()
  for (const issue of group.flatMap(b => b.linearIssues ?? [])) {
    linearById.set(issue.identifier, issue)
  }
  const linearIssues = [...linearById.values()]

  const summary = uniq(group.map(b => b.summary)).join(' · ').slice(0, 120)
  const note = uniq(group.map(b => b.note ?? '')).join(' · ').slice(0, 80)

  const merged: ClassifiedBlock = {
    ...dominant,
    blockName: group.length > 1 ? `${dominant.blockName} (+${group.length - 1})` : dominant.blockName,
    summary,
    note,
    hours: group.reduce((s, b) => s + b.hours, 0),
    visitCount: group.reduce((s, b) => s + b.visitCount, 0),
    firstVisitTime: sorted[0]!.firstVisitTime,
    lastVisitTime: sorted[sorted.length - 1]!.lastVisitTime,
    startTime: sorted[0]!.startTime,
    endTime: sorted[sorted.length - 1]!.endTime,
    confidence: Math.max(...group.map(b => b.confidence)) as ClassifiedBlock['confidence'],
    titles,
    urls,
    rawTitles,
    rawUrls,
  }
  if (commits.length > 0) merged.commits = commits
  if (linearIssues.length > 0) merged.linearIssues = linearIssues
  return merged
}
