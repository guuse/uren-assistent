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
      makeCommit('10:20'), // gap 80 min > 45 → aparte sessies
    ]
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
    expect(blocks).toHaveLength(3)
    expect(blocks[0]!.hours).toBe(1.0)
  })

  it('clamt lastVisitTime op 23:30', () => {
    const blocks = groupCommitsIntoBlocks([makeCommit('23:15')], '2026-04-01')
    expect(blocks[0]!.lastVisitTime).toBe('23:45')
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
