import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GitHubRepository } from './GitHubRepository'

function commitItem(date: string, sha = 'abcdef1234567', message = 'feat: thing\nbody') {
  return {
    sha,
    commit: { message, author: { date } },
    repository: { full_name: 'octocat/uren-schrijven' },
  }
}

describe('GitHubRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps a single page of commits and stops when fewer than 100', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_count: 1, items: [commitItem('2026-05-20T10:23:00Z')] }),
    })

    const repo = new GitHubRepository('tok')
    const commits = await repo.getCommitsForWeek('octocat', '2026-05-19', '2026-05-23')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(commits).toHaveLength(1)
    expect(commits[0]).toMatchObject({
      sha: 'abcdef1',
      message: 'feat: thing',
      repo: 'octocat/uren-schrijven',
      branch: '',
      timestamp: '2026-05-20T10:23:00Z',
    })
    // date / time derived from local Date
    expect(commits[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(commits[0]!.time).toMatch(/^\d{2}:\d{2}$/)

    // Authorization header passed
    const [, init] = fetchMock.mock.calls[0]!
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  it('falls back to full message when there is no newline', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_count: 1, items: [commitItem('2026-05-20T10:23:00Z', 'aaaaaaaa', 'single line')] }),
    })
    const repo = new GitHubRepository('tok')
    const commits = await repo.getCommitsForWeek('octocat', '2026-05-19', '2026-05-23')
    expect(commits[0]!.message).toBe('single line')
  })

  it('falls back to the full message when the first line is empty', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_count: 1, items: [commitItem('2026-05-20T10:23:00Z', 'aaaaaaaa', '\nbody line')] }),
    })
    const repo = new GitHubRepository('tok')
    const commits = await repo.getCommitsForWeek('octocat', '2026-05-19', '2026-05-23')
    expect(commits[0]!.message).toBe('\nbody line')
  })

  it('paginates when a full page of 100 is returned and total allows more', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => commitItem('2026-05-20T10:23:00Z', `sha${i}`))
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 150, items: fullPage }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 150, items: [commitItem('2026-05-21T11:00:00Z')] }) })

    const repo = new GitHubRepository('tok')
    const commits = await repo.getCommitsForWeek('octocat', '2026-05-19', '2026-05-23')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(commits).toHaveLength(101)
    expect((fetchMock.mock.calls[1]![0] as string)).toContain('page=2')
  })

  it('stops paginating at the 1000-result cap even with a full page', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => commitItem('2026-05-20T10:23:00Z', `sha${i}`))
    // 10 full pages then capped at 1000; total_count huge
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ total_count: 5000, items: fullPage }) })

    const repo = new GitHubRepository('tok')
    const commits = await repo.getCommitsForWeek('octocat', '2026-05-19', '2026-05-23')

    // page*100 >= min(total,1000) -> stops after page 10
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(commits).toHaveLength(1000)
  })

  it('throws on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
    })
    const repo = new GitHubRepository('tok')
    await expect(repo.getCommitsForWeek('octocat', '2026-05-19', '2026-05-23')).rejects.toThrow(
      'GitHub API error: 403 forbidden',
    )
  })
})
