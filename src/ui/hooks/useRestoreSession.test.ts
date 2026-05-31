import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const setUser = vi.fn()
vi.mock('../../store/appStore', () => ({
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ setUser }),
}))

const keychainGet = vi.fn()
const keychainSet = vi.fn()
vi.mock('../../application/container', () => ({
  keychainRepo: {
    get: (k: string) => keychainGet(k),
    set: (k: string, v: string) => keychainSet(k, v),
  },
}))

import { useRestoreSession } from './useRestoreSession'

function keychain(map: Record<string, string | null>) {
  keychainGet.mockImplementation((k: string) => Promise.resolve(map[k] ?? null))
}

describe('useRestoreSession', () => {
  beforeEach(() => {
    keychainGet.mockReset()
    keychainSet.mockReset().mockResolvedValue(undefined)
    setUser.mockReset()
  })

  it('restores directly from a valid access token', async () => {
    keychain({
      'google-access-token': 'at',
      'google-token-expiry': String(Date.now() + 100000),
      'google-refresh-token': 'rt',
    })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 's1', name: 'N', email: 'e@x.com' }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useRestoreSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(setUser).toHaveBeenCalledWith({ id: 's1', name: 'N', email: 'e@x.com', googleId: 's1' })
  })

  it('refreshes silently when the access token is expired', async () => {
    keychain({
      'google-access-token': 'old',
      'google-token-expiry': '0',
      'google-refresh-token': 'rt',
    })
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'new', refresh_token: 'newrt' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sub: 's2', name: 'N2', email: 'e2@x.com' }),
      })
    globalThis.fetch = fetchFn as unknown as typeof fetch

    const { result } = renderHook(() => useRestoreSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(keychainSet).toHaveBeenCalledWith('google-access-token', 'new')
    expect(keychainSet).toHaveBeenCalledWith('google-refresh-token', 'newrt')
    expect(setUser).toHaveBeenCalled()
  })

  it('refresh without a returned refresh_token does not re-store it', async () => {
    keychain({
      'google-access-token': null,
      'google-token-expiry': '0',
      'google-refresh-token': 'rt',
    })
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'new' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sub: 's3', name: 'N3', email: 'e3@x.com' }),
      })
    globalThis.fetch = fetchFn as unknown as typeof fetch

    const { result } = renderHook(() => useRestoreSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(keychainSet).not.toHaveBeenCalledWith('google-refresh-token', expect.anything())
    expect(setUser).toHaveBeenCalled()
  })

  it('does not set a user when refresh fails', async () => {
    keychain({ 'google-token-expiry': '0', 'google-refresh-token': 'rt' })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch

    const { result } = renderHook(() => useRestoreSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(setUser).not.toHaveBeenCalled()
  })

  it('leaves user null when no tokens exist', async () => {
    keychain({})
    globalThis.fetch = vi.fn() as unknown as typeof fetch

    const { result } = renderHook(() => useRestoreSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(setUser).not.toHaveBeenCalled()
  })

  it('does not set a user when the userinfo request fails', async () => {
    keychain({
      'google-access-token': 'at',
      'google-token-expiry': String(Date.now() + 100000),
    })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch

    const { result } = renderHook(() => useRestoreSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(setUser).not.toHaveBeenCalled()
  })

  it('silently swallows thrown errors', async () => {
    keychainGet.mockRejectedValue(new Error('keychain down'))
    const { result } = renderHook(() => useRestoreSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(setUser).not.toHaveBeenCalled()
  })
})
