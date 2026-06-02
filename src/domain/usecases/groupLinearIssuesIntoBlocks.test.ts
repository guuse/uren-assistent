import { describe, it, expect } from 'vitest'
import { groupLinearIssuesIntoBlocks } from './groupLinearIssuesIntoBlocks'
import type { LinearIssue } from '../entities/LinearIssue'
import type { GitHubCommit } from '../entities/GitHubCommit'

const issue = (identifier: string, completedAt = '2026-06-01T15:00:00Z', title = 'Some work'): LinearIssue => ({
  identifier,
  title,
  completedAt,
  url: `https://linear.app/x/issue/${identifier}`,
})

const commit = (message: string): GitHubCommit => ({
  sha: 'abc',
  message,
  repo: 'org/repo',
  branch: 'main',
  timestamp: '2026-06-01T10:00:00Z',
  time: '10:00',
  date: '2026-06-01',
})

describe('groupLinearIssuesIntoBlocks', () => {
  it('returns nothing when there are no issues', () => {
    expect(groupLinearIssuesIntoBlocks([], [], '2026-06-01')).toEqual([])
  })

  it('makes a block for an issue with no commit footprint', () => {
    const blocks = groupLinearIssuesIntoBlocks([issue('ENG-42')], [], '2026-06-01')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.urlPattern).toBe('linear:ENG-42')
    expect(blocks[0]!.titles[0]).toContain('ENG-42')
    expect(blocks[0]!.hours).toBe(0.5)
  })

  it('skips an issue already referenced by a commit (covered by a higher source)', () => {
    const blocks = groupLinearIssuesIntoBlocks(
      [issue('ENG-42'), issue('ENG-99')],
      [commit('fix: handle edge case ENG-42')],
      '2026-06-01',
    )
    expect(blocks.map(b => b.urlPattern)).toEqual(['linear:ENG-99'])
  })

  it('ignores issues completed on another day', () => {
    const blocks = groupLinearIssuesIntoBlocks(
      [issue('ENG-1', '2026-05-30T12:00:00Z')],
      [],
      '2026-06-01',
    )
    expect(blocks).toEqual([])
  })
})
