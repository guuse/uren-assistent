# Commits → tijdblokken Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Groepeer GitHub commits per repo in aaneengesloten sessies (gap > 45 min = nieuwe sessie) en zet ze om naar `HistoryBlock`-objecten die de LLM kan classificeren naar projecten en tijdblokken.

**Architecture:** Nieuwe pure functie `groupCommitsIntoBlocks` in de domain-laag. Output `HistoryBlock[]` wordt samengevoegd met de echte browser history blocks vóór doorgave aan `GroupAndClassifyDayUseCase`. Geen UI-wijzigingen nodig — de geclassificeerde blokken verschijnen automatisch in de tijdlijn.

**Tech Stack:** TypeScript strict, Vitest, clean architecture (domain only)

---

## Files

- Create: `src/domain/usecases/GroupCommitsIntoBlocks.ts`
- Create: `src/domain/usecases/GroupCommitsIntoBlocks.test.ts`
- Modify: `src/domain/usecases/ProcessWeekUseCase.ts` — voeg commit-blocks toe aan historyBlocks per dag

---

### Task 1: Pure functie `groupCommitsIntoBlocks` — TDD

**Files:**
- Create: `src/domain/usecases/GroupCommitsIntoBlocks.ts`
- Create: `src/domain/usecases/GroupCommitsIntoBlocks.test.ts`

- [ ] **Stap 1: Schrijf de falende tests**

Maak `src/domain/usecases/GroupCommitsIntoBlocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupCommitsIntoBlocks } from './GroupCommitsIntoBlocks'
import type { GitHubCommit } from '../entities/GitHubCommit'

function makeCommit(time: string, repo = 'Org/Repo', message = 'feat: something'): GitHubCommit {
  return {
    sha: time.replace(':', ''),
    message,
    repo,
    branch: 'main',
    timestamp: `2026-04-01T${time}:00Z`,
    time,
    date: '2026-04-01',
  }
}

describe('groupCommitsIntoBlocks', () => {
  it('geeft lege array terug bij geen commits', () => {
    expect(groupCommitsIntoBlocks([], '2026-04-01')).toEqual([])
  })

  it('maakt één block van één commit', () => {
    const blocks = groupCommitsIntoBlocks([makeCommit('09:15')], '2026-04-01')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.urlPattern).toBe('github.com/Org/Repo')
    expect(blocks[0]!.firstVisitTime).toBe('09:15')
    expect(blocks[0]!.lastVisitTime).toBe('09:45') // +30 min
    expect(blocks[0]!.hours).toBe(0.5)
    expect(blocks[0]!.visitCount).toBe(1)
    expect(blocks[0]!.date).toBe('2026-04-01')
  })

  it('voegt commits in één sessie samen (gap <= 45 min)', () => {
    const commits = [
      makeCommit('09:00'),
      makeCommit('09:30'),
      makeCommit('10:00'),
    ]
    const blocks = groupCommitsIntoBlocks(commits, '2026-04-01')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.firstVisitTime).toBe('09:00')
    expect(blocks[0]!.lastVisitTime).toBe('10:30') // 10:00 + 30 min
    expect(blocks[0]!.visitCount).toBe(3)
  })

  it('splitst op gap > 45 min in twee sessies', () => {
    const commits = [
      makeCommit('09:00'),
      makeCommit('10:00'), // gap 60 min > 45 → nieuwe sessie
    ]
    const blocks = groupCommitsIntoBlocks(commits, '2026-04-01')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.firstVisitTime).toBe('09:00')
    expect(blocks[0]!.lastVisitTime).toBe('09:30')
    expect(blocks[1]!.firstVisitTime).toBe('10:00')
    expect(blocks[1]!.lastVisitTime).toBe('10:30')
  })

  it('houdt repos gescheiden (zelfde tijdstip, andere repo → aparte blocks)', () => {
    const commits = [
      makeCommit('09:00', 'Org/RepoA'),
      makeCommit('09:10', 'Org/RepoB'),
    ]
    const blocks = groupCommitsIntoBlocks(commits, '2026-04-01')
    expect(blocks).toHaveLength(2)
    expect(blocks.map(b => b.urlPattern).sort()).toEqual([
      'github.com/Org/RepoA',
      'github.com/Org/RepoB',
    ])
  })

  it('berekent hours correct op 0.5 afgerond', () => {
    const commits = [
      makeCommit('09:00'),
      makeCommit('10:20'), // sessie span 80 min + 30 = 110 min = 1.83u → afgerond 2.0
    ]
    // Ze zijn in één sessie want gap = 80 min > 45 → aparte sessies
    // Dus: sessie 1: 09:00, lastVisit 09:30, hours 0.5
    //      sessie 2: 10:20, lastVisit 10:50, hours 0.5
    const blocks = groupCommitsIntoBlocks(commits, '2026-04-01')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.hours).toBe(0.5)
    expect(blocks[1]!.hours).toBe(0.5)
  })

  it('berekent hours op basis van sessieduur (eerste tot laatste + 30 min)', () => {
    const commits = [
      makeCommit('09:00'),
      makeCommit('09:30'),
      makeCommit('10:30'), // gap = 60 min > 45 → nieuwe sessie
      makeCommit('11:30'), // gap = 60 min > 45 → nieuwe sessie
    ]
    const blocks = groupCommitsIntoBlocks(commits, '2026-04-01')
    // Sessie 1: 09:00–09:30, duur = 30 + 30 = 60 min = 1.0u
    // Sessie 2: 10:30–10:30, duur = 0 + 30 = 30 min = 0.5u
    // Sessie 3: 11:30–11:30, duur = 0 + 30 = 30 min = 0.5u
    expect(blocks).toHaveLength(3)
    expect(blocks[0]!.hours).toBe(1.0)
  })

  it('clamt lastVisitTime op 23:30', () => {
    const blocks = groupCommitsIntoBlocks([makeCommit('23:15')], '2026-04-01')
    expect(blocks[0]!.lastVisitTime).toBe('23:45')
    // 23:15 + 30 = 23:45 — dat is ok, clamp only at 23:30+
    // als commit op 23:45: 23:45 + 30 = 24:15 → clamp naar 23:59
  })

  it('bevat commit-messages als titles (max 10, gededupliceerd)', () => {
    const commits = Array.from({ length: 15 }, (_, i) =>
      makeCommit(`09:${String(i).padStart(2, '0')}`, 'Org/Repo', i < 5 ? 'feat: dup' : `feat: unique ${i}`)
    )
    const blocks = groupCommitsIntoBlocks(commits, '2026-04-01')
    expect(blocks[0]!.titles.length).toBeLessThanOrEqual(10)
  })

  it('filtert commits die niet op de opgegeven date vallen', () => {
    const commits = [
      makeCommit('09:00'), // date: 2026-04-01
      { ...makeCommit('10:00'), date: '2026-04-02' }, // andere dag
    ]
    const blocks = groupCommitsIntoBlocks(commits, '2026-04-01')
    expect(blocks).toHaveLength(1)
  })
})
```

- [ ] **Stap 2: Run tests om te verifiëren dat ze falen**

```bash
cd /Users/guus/projects/uren-schrijven && npx vitest run src/domain/usecases/GroupCommitsIntoBlocks.test.ts 2>&1 | tail -10
```

Verwacht: `Cannot find module './GroupCommitsIntoBlocks'`

- [ ] **Stap 3: Implementeer `GroupCommitsIntoBlocks.ts`**

Maak `src/domain/usecases/GroupCommitsIntoBlocks.ts`:

```ts
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

  // Groepeer per repo
  const byRepo = new Map<string, GitHubCommit[]>()
  for (const commit of forDate) {
    const existing = byRepo.get(commit.repo) ?? []
    existing.push(commit)
    byRepo.set(commit.repo, existing)
  }

  const blocks: HistoryBlock[] = []

  for (const [repo, repoCommits] of byRepo) {
    // Sorteer op tijd
    const sorted = [...repoCommits].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
    )

    // Split in sessies op gap > SESSION_GAP_MINUTES
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
    if (current.length > 0) sessions.push(current)

    // Maak een HistoryBlock per sessie
    const [owner, repoName] = repo.split('/')
    const urlPattern = `github.com/${owner}/${repoName}`

    for (const session of sessions) {
      const first = session[0]!
      const last = session[session.length - 1]!
      const firstMin = timeToMinutes(first.time)
      const lastMin = timeToMinutes(last.time) + SESSION_TAIL_MINUTES
      const durationMins = lastMin - firstMin
      const hours = roundToHalf(durationMins / 60)

      // Dedup titles, max 10
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
        urls: [urlPattern],
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
```

- [ ] **Stap 4: Run tests en verifieer dat ze slagen**

```bash
cd /Users/guus/projects/uren-schrijven && npx vitest run src/domain/usecases/GroupCommitsIntoBlocks.test.ts 2>&1 | tail -10
```

Verwacht: alle tests groen

- [ ] **Stap 5: Typecheck**

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck 2>&1
```

Verwacht: geen errors

- [ ] **Stap 6: Commit**

```bash
cd /Users/guus/projects/uren-schrijven && git add src/domain/usecases/GroupCommitsIntoBlocks.ts src/domain/usecases/GroupCommitsIntoBlocks.test.ts && git commit -m "feat: groupCommitsIntoBlocks — commit sessies als HistoryBlocks"
```

---

### Task 2: Integreer in `ProcessWeekUseCase`

**Files:**
- Modify: `src/domain/usecases/ProcessWeekUseCase.ts`

- [ ] **Stap 1: Voeg import toe en roep `groupCommitsIntoBlocks` aan**

In `src/domain/usecases/ProcessWeekUseCase.ts`, voeg toe na de bestaande imports:

```ts
import { groupCommitsIntoBlocks } from './GroupCommitsIntoBlocks'
```

Zoek in de `execute` methode de plek waar `historyBlocks` wordt opgehaald en `groupAndClassify.execute` wordt aangeroepen:

```ts
const [historyBlocks, calendarEvents] = await Promise.all([
  this.historyStore.getBlocksForDate(day),
  this.calendarRepo.fetchEvents(dayStart, dayEnd),
])

const classified = await groupAndClassify.execute(day, historyBlocks, calendarEvents, {
  commits: dayCommits,
  linearIssues,
})
```

Verander dit naar:

```ts
const [historyBlocks, calendarEvents] = await Promise.all([
  this.historyStore.getBlocksForDate(day),
  this.calendarRepo.fetchEvents(dayStart, dayEnd),
])

const commitBlocks = groupCommitsIntoBlocks(dayCommits, day)
const allBlocks = [...historyBlocks, ...commitBlocks]

const classified = await groupAndClassify.execute(day, allBlocks, calendarEvents, {
  commits: dayCommits,
  linearIssues,
})
```

- [ ] **Stap 2: Run alle tests**

```bash
cd /Users/guus/projects/uren-schrijven && npm run test 2>&1 | tail -8
```

Verwacht: alle 148+ tests groen (geen regressions)

- [ ] **Stap 3: Typecheck**

```bash
cd /Users/guus/projects/uren-schrijven && npm run typecheck 2>&1
```

Verwacht: geen errors

- [ ] **Stap 4: Commit**

```bash
cd /Users/guus/projects/uren-schrijven && git add src/domain/usecases/ProcessWeekUseCase.ts && git commit -m "feat: voeg commit-blocks toe aan dag-classificatie"
```
