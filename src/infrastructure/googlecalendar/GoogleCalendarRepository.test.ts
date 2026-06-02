import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GoogleCalendarRepository } from './GoogleCalendarRepository'
import type { IKeychainRepository } from '../../domain/repositories/IKeychainRepository'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

function makeKeychain(initial: Record<string, string> = {}): IKeychainRepository & { store: Record<string, string> } {
  const store: Record<string, string> = { ...initial }
  return {
    store,
    get: vi.fn(async (key: string) => store[key] ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store[key] = value
    }),
    delete: vi.fn(async (key: string) => {
      delete store[key]
    }),
  }
}

const FUTURE = String(Date.now() + 3_600_000)
const PAST = String(Date.now() - 1000)

describe('GoogleCalendarRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('hasCalendarScope', () => {
    it('returns false when there is no valid token', async () => {
      const kc = makeKeychain() // no token, no refresh token
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.hasCalendarScope()).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns true when tokeninfo includes the calendar scope', async () => {
      const kc = makeKeychain({ 'google-access-token': 'tok', 'google-token-expiry': FUTURE })
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ scope: `email ${CALENDAR_SCOPE}` }) })
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.hasCalendarScope()).toBe(true)
    })

    it('returns false when tokeninfo response is not ok', async () => {
      const kc = makeKeychain({ 'google-access-token': 'tok', 'google-token-expiry': FUTURE })
      fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'invalid' }) })
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.hasCalendarScope()).toBe(false)
    })

    it('returns false when scope is missing entirely', async () => {
      const kc = makeKeychain({ 'google-access-token': 'tok', 'google-token-expiry': FUTURE })
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.hasCalendarScope()).toBe(false)
    })

    it('returns false and logs when fetch throws', async () => {
      const kc = makeKeychain({ 'google-access-token': 'tok', 'google-token-expiry': FUTURE })
      fetchMock.mockRejectedValueOnce(new Error('boom'))
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.hasCalendarScope()).toBe(false)
    })
  })

  describe('fetchEvents', () => {
    const start = new Date('2026-05-20T00:00:00Z')
    const end = new Date('2026-05-20T00:00:00Z')

    it('returns [] when there is no token', async () => {
      const kc = makeKeychain()
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.fetchEvents(start, end)).toEqual([])
    })

    it('maps events, applying attendance and title fallbacks', async () => {
      const kc = makeKeychain({ 'google-access-token': 'tok', 'google-token-expiry': FUTURE })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            // solo event, no attendees -> attending, default status accepted
            {
              id: 'e1',
              start: { dateTime: '2026-05-20T09:00:00Z' },
              end: { dateTime: '2026-05-20T10:00:00Z' },
            },
            // self tentative -> attending, status tentative, other attendee listed
            {
              id: 'e2',
              summary: 'Standup',
              start: { dateTime: '2026-05-20T11:00:00Z' },
              end: { dateTime: '2026-05-20T11:30:00Z' },
              attendees: [
                { email: 'me@x.com', self: true, responseStatus: 'tentative' },
                { email: 'other@x.com', responseStatus: 'accepted' },
              ],
            },
            // self declined -> filtered out
            {
              id: 'e3',
              start: { dateTime: '2026-05-20T12:00:00Z' },
              end: { dateTime: '2026-05-20T13:00:00Z' },
              attendees: [{ email: 'me@x.com', self: true, responseStatus: 'declined' }],
            },
            // attendees present but none is self -> attending
            {
              id: 'e4',
              summary: 'Ext',
              start: { date: '2026-05-20' },
              end: { date: '2026-05-21' },
              attendees: [{ email: 'guest@x.com', responseStatus: 'accepted' }],
            },
            // missing start/end -> mapped to null and filtered
            {
              id: 'e5',
              start: {},
              end: {},
            },
          ],
        }),
      })

      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      const events = await repo.fetchEvents(start, end)

      expect(events.map((e) => e.id)).toEqual(['e1', 'e2', 'e4'])
      const e1 = events.find((e) => e.id === 'e1')!
      expect(e1.title).toBe('(geen titel)')
      expect(e1.status).toBe('accepted')
      const e2 = events.find((e) => e.id === 'e2')!
      expect(e2.status).toBe('tentative')
      expect(e2.attendees).toEqual(['other@x.com'])
    })

    it("keeps un-RSVP'd (needsAction) meetings and drops only declined ones", async () => {
      const kc = makeKeychain({ 'google-access-token': 'tok', 'google-token-expiry': FUTURE })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            // never responded — a recurring team meeting you attend without RSVP
            {
              id: 'na',
              summary: 'Standup T3',
              start: { dateTime: '2026-05-20T09:00:00Z' },
              end: { dateTime: '2026-05-20T09:15:00Z' },
              attendees: [{ email: 'me@x.com', self: true, responseStatus: 'needsAction' }],
            },
            // explicitly declined — still excluded
            {
              id: 'dec',
              summary: 'Optional sync',
              start: { dateTime: '2026-05-20T12:00:00Z' },
              end: { dateTime: '2026-05-20T13:00:00Z' },
              attendees: [{ email: 'me@x.com', self: true, responseStatus: 'declined' }],
            },
          ],
        }),
      })
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      const events = await repo.fetchEvents(start, end)
      expect(events.map(e => e.id)).toEqual(['na'])
    })

    it('returns [] when items is absent', async () => {
      const kc = makeKeychain({ 'google-access-token': 'tok', 'google-token-expiry': FUTURE })
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.fetchEvents(start, end)).toEqual([])
    })

    it('refreshes the token and retries once on a 401', async () => {
      const kc = makeKeychain({
        'google-access-token': 'stale',
        'google-token-expiry': FUTURE,
        'google-refresh-token': 'refresh',
      })
      fetchMock
        // initial calendar call -> 401
        .mockResolvedValueOnce({ status: 401, ok: false })
        // token refresh
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fresh', expires_in: 3600 }) })
        // retried calendar call -> ok
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })

      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.fetchEvents(start, end)).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(kc.store['google-access-token']).toBe('fresh')
    })

    it('returns [] when the 401 refresh yields no token', async () => {
      const kc = makeKeychain({
        'google-access-token': 'stale',
        'google-token-expiry': FUTURE,
        // no refresh token -> doRefresh returns null
      })
      fetchMock.mockResolvedValueOnce({ status: 401, ok: false })
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.fetchEvents(start, end)).toEqual([])
    })

    it('throws on a non-401 error response', async () => {
      const kc = makeKeychain({ 'google-access-token': 'tok', 'google-token-expiry': FUTURE })
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'server error' })
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      await expect(repo.fetchEvents(start, end)).rejects.toThrow('Calendar API error: 500')
    })
  })

  describe('token refresh paths', () => {
    const start = new Date('2026-05-20T00:00:00Z')
    const end = new Date('2026-05-20T00:00:00Z')

    it('refreshes when the access token is expired', async () => {
      const kc = makeKeychain({
        'google-access-token': 'old',
        'google-token-expiry': PAST,
        'google-refresh-token': 'refresh',
      })
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new', expires_in: 1200 }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })

      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      await repo.fetchEvents(start, end)
      expect(kc.store['google-access-token']).toBe('new')
      // expiry recomputed
      expect(Number(kc.store['google-token-expiry'])).toBeGreaterThan(Date.now())
    })

    it('uses default expiry when expires_in is absent', async () => {
      const kc = makeKeychain({
        'google-access-token': 'old',
        'google-token-expiry': PAST,
        'google-refresh-token': 'refresh',
      })
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })

      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      await repo.fetchEvents(start, end)
      expect(kc.store['google-access-token']).toBe('new')
    })

    it('returns [] when refresh token is missing', async () => {
      const kc = makeKeychain({ 'google-token-expiry': PAST }) // token absent, expired
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.fetchEvents(start, end)).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns [] when the refresh request fails (non-ok)', async () => {
      const kc = makeKeychain({ 'google-token-expiry': PAST, 'google-refresh-token': 'refresh' })
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400 })
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.fetchEvents(start, end)).toEqual([])
    })

    it('returns [] when the refresh request throws', async () => {
      const kc = makeKeychain({ 'google-token-expiry': PAST, 'google-refresh-token': 'refresh' })
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      expect(await repo.fetchEvents(start, end)).toEqual([])
    })

    it('dedups concurrent refreshes onto one in-flight request', async () => {
      const kc = makeKeychain({
        'google-access-token': 'stale',
        'google-token-expiry': PAST,
        'google-refresh-token': 'refresh',
      })
      let tokenPosts = 0
      fetchMock.mockImplementation(async (url: string) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          tokenPosts++
          return { ok: true, json: async () => ({ access_token: 'shared', expires_in: 3600 }) }
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) }
      })

      const repo = new GoogleCalendarRepository(kc, 'cid', 'secret')
      // Fire both before either resolves so they share the in-flight refresh.
      const [r1, r2] = await Promise.all([repo.fetchEvents(start, end), repo.fetchEvents(start, end)])

      expect(r1).toEqual([])
      expect(r2).toEqual([])
      // Only one refresh POST despite two concurrent callers.
      expect(tokenPosts).toBe(1)
    })
  })
})
