import type { GitHubCommit } from '../entities/GitHubCommit'
import type { HistoryBlock } from '../entities/HistoryBlock'

const SESSION_GAP_MINUTES = 45
const SESSION_TAIL_MINUTES = 30

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function minutesToTime(minutes: number): string {
  const clamped = Math.min(minutes, 23 * 60 + 59)
  const h = Math.floor(clamped / 60).toString().padStart(2, '0')
  const m = (clamped % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function roundToHalf(hours: number): number {
  return Math.max(0.5, Math.round(hours * 2) / 2)
}

export function groupCommitsIntoBlocks(commits: GitHubCommit[], date: string): HistoryBlock[] {
  const forDate = commits.filter(c => c.date === date)

  const byRepo = new Map<string, GitHubCommit[]>()
  for (const commit of forDate) {
    const existing = byRepo.get(commit.repo) ?? []
    existing.push(commit)
    byRepo.set(commit.repo, existing)
  }

  const blocks: HistoryBlock[] = []

  for (const [repo, repoCommits] of byRepo) {
    const sorted = [...repoCommits].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
    )

    const sessions: GitHubCommit[][] = []
    let current: GitHubCommit[] = []

    for (const commit of sorted) {
      if (current.length === 0) {
        current.push(commit)
        continue
      }
      const prev = current[current.length - 1]!
      const gap = timeToMinutes(commit.time) - timeToMinutes(prev.time)
      if (gap > SESSION_GAP_MINUTES) {
        sessions.push(current)
        current = [commit]
      } else {
        current.push(commit)
      }
    }
    // `current` always holds at least the first commit of the repo group here.
    sessions.push(current)

    const [owner, repoName] = repo.split('/')
    const repoUrl = `github.com/${owner}/${repoName}`

    for (const session of sessions) {
      const first = session[0]!
      const last = session[session.length - 1]!
      const firstMin = timeToMinutes(first.time)
      const lastMin = timeToMinutes(last.time) + SESSION_TAIL_MINUTES
      const durationMins = lastMin - firstMin
      const hours = roundToHalf(durationMins / 60)

      // Uniek urlPattern per sessie (repo + starttijd) zodat meerdere sessies
      // van dezelfde repo niet worden samengevoegd in HistoryStore.
      const urlPattern = `${repoUrl}@${first.time}`

      const seen = new Set<string>()
      const titles: string[] = []
      for (const c of session) {
        if (!seen.has(c.message) && titles.length < 10) {
          seen.add(c.message)
          titles.push(c.message)
        }
      }

      blocks.push({
        date,
        urlPattern,
        urls: [repoUrl],  // canonical repo URL voor weergave en de `attachHistoryToMeetings` check
        titles,
        visitCount: session.length,
        firstVisitTime: first.time,
        lastVisitTime: minutesToTime(lastMin),
        hours,
      })
    }
  }

  return blocks
}
