import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { testGitHubToken, testLinearToken } from './tokenTest'

describe('tokenTest', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('testGitHubToken', () => {
    it('reports connected with login', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ login: 'octocat' }) })
      expect(await testGitHubToken('tok')).toEqual({ ok: true, label: 'GitHub: verbonden als octocat' })
    })

    it('reports connected with fallback login', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      expect(await testGitHubToken('tok')).toEqual({ ok: true, label: 'GitHub: verbonden als ?' })
    })

    it('reports HTTP error on non-ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
      expect(await testGitHubToken('tok')).toEqual({ ok: false, label: 'GitHub: HTTP 401' })
    })

    it('reports no connection on throw', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'))
      expect(await testGitHubToken('tok')).toEqual({ ok: false, label: 'GitHub: geen verbinding' })
    })
  })

  describe('testLinearToken', () => {
    it('reports connected with viewer name', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { viewer: { name: 'Guus' } } }) })
      expect(await testLinearToken('tok')).toEqual({ ok: true, label: 'Linear: verbonden als Guus' })
    })

    it('reports connected with fallback name', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      expect(await testLinearToken('tok')).toEqual({ ok: true, label: 'Linear: verbonden als ?' })
    })

    it('reports invalid token when errors present', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ errors: [{ message: 'x' }] }) })
      expect(await testLinearToken('tok')).toEqual({ ok: false, label: 'Linear: ongeldige token' })
    })

    it('reports HTTP error on non-ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
      expect(await testLinearToken('tok')).toEqual({ ok: false, label: 'Linear: HTTP 500' })
    })

    it('reports no connection on throw', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'))
      expect(await testLinearToken('tok')).toEqual({ ok: false, label: 'Linear: geen verbinding' })
    })
  })
})
