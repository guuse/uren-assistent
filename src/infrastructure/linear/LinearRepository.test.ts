import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LinearRepository } from './LinearRepository'

describe('LinearRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps issue nodes on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          issues: {
            nodes: [
              { identifier: 'ENG-1', title: 'A', completedAt: '2026-05-20T10:00:00Z', url: 'https://linear.app/a' },
            ],
          },
        },
      }),
    })

    const repo = new LinearRepository('lin_tok')
    const result = await repo.getCompletedIssuesForWeek('2026-05-19', '2026-05-23')

    expect(result).toEqual([
      { identifier: 'ENG-1', title: 'A', completedAt: '2026-05-20T10:00:00Z', url: 'https://linear.app/a' },
    ])

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.linear.app/graphql')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'lin_tok' })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.query).toContain('2026-05-19T00:00:00.000Z')
    expect(body.query).toContain('2026-05-23T23:59:59.999Z')
  })

  it('throws on non-ok HTTP response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'unauthorized' })
    const repo = new LinearRepository('lin_tok')
    await expect(repo.getCompletedIssuesForWeek('2026-05-19', '2026-05-23')).rejects.toThrow(
      'Linear API error: 401 — unauthorized',
    )
  })

  it('throws on GraphQL errors in the body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { issues: { nodes: [] } }, errors: [{ message: 'bad query' }] }),
    })
    const repo = new LinearRepository('lin_tok')
    await expect(repo.getCompletedIssuesForWeek('2026-05-19', '2026-05-23')).rejects.toThrow(
      'Linear GraphQL error: bad query',
    )
  })

  it('returns empty array when there are no nodes', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { issues: { nodes: [] } } }),
    })
    const repo = new LinearRepository('lin_tok')
    expect(await repo.getCompletedIssuesForWeek('2026-05-19', '2026-05-23')).toEqual([])
  })
})
