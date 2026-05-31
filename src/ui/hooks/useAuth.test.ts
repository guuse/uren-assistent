import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const invoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invoke(...a) }))

const setUser = vi.fn()
const setLoading = vi.fn()
const setError = vi.fn()
const clearUser = vi.fn()
vi.mock('../../store/appStore', () => ({
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setUser, setLoading, setError, clearUser }),
}))

const keychainSet = vi.fn()
const keychainDelete = vi.fn()
vi.mock('../../application/container', () => ({
  keychainRepo: {
    set: (k: string, v: string) => keychainSet(k, v),
    delete: (k: string) => keychainDelete(k),
  },
}))

import { useAuth } from './useAuth'

function mockFetchSequence(responses: Array<Partial<Response> & { json?: () => Promise<unknown> }>) {
  const fn = vi.fn()
  responses.forEach((r) => fn.mockResolvedValueOnce(r))
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

describe('useAuth', () => {
  beforeEach(() => {
    invoke.mockReset()
    keychainSet.mockReset().mockResolvedValue(undefined)
    keychainDelete.mockReset().mockResolvedValue(undefined)
    setUser.mockReset()
    setLoading.mockReset()
    setError.mockReset()
    clearUser.mockReset()
  })

  it('completes the full login flow and stores tokens', async () => {
    invoke.mockResolvedValue(
      JSON.stringify({ code: 'c', verifier: 'v', redirect_uri: 'http://localhost' }),
    )
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve({ access_token: 'at', refresh_token: 'rt' }) },
      { ok: true, json: () => Promise.resolve({ sub: 's1', name: 'Me', email: 'm@x.com' }) },
    ])

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.loginWithGoogle()
    })

    expect(keychainSet).toHaveBeenCalledWith('google-access-token', 'at')
    expect(keychainSet).toHaveBeenCalledWith('google-refresh-token', 'rt')
    expect(setUser).toHaveBeenCalledWith({ id: 's1', name: 'Me', email: 'm@x.com', googleId: 's1' })
    expect(setLoading).toHaveBeenLastCalledWith(false)
  })

  it('handles a missing refresh token', async () => {
    invoke.mockResolvedValue(JSON.stringify({ code: 'c', verifier: 'v', redirect_uri: 'r' }))
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve({ access_token: 'at' }) },
      { ok: true, json: () => Promise.resolve({ sub: 's1', name: 'Me', email: 'm@x.com' }) },
    ])
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.loginWithGoogle()
    })
    expect(keychainSet).not.toHaveBeenCalledWith('google-refresh-token', expect.anything())
    expect(setUser).toHaveBeenCalled()
  })

  it('throws and sets error when token exchange fails (with body)', async () => {
    invoke.mockResolvedValue(JSON.stringify({ code: 'c', verifier: 'v', redirect_uri: 'r' }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetchSequence([
      { ok: false, status: 400, json: () => Promise.resolve({ error: 'bad', error_description: 'nope' }) },
    ])
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.loginWithGoogle()
    })
    expect(setError).toHaveBeenCalledWith(expect.stringContaining('Token exchange failed'))
    spy.mockRestore()
  })

  it('handles token exchange failure when body json rejects', async () => {
    invoke.mockResolvedValue(JSON.stringify({ code: 'c', verifier: 'v', redirect_uri: 'r' }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetchSequence([
      { ok: false, status: 500, json: () => Promise.reject(new Error('no body')) },
    ])
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.loginWithGoogle()
    })
    expect(setError).toHaveBeenCalledWith(expect.stringContaining('500'))
    spy.mockRestore()
  })

  it('sets a string error when invoke rejects with a string', async () => {
    invoke.mockRejectedValue('oauth cancelled')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.loginWithGoogle()
    })
    expect(setError).toHaveBeenCalledWith('oauth cancelled')
    spy.mockRestore()
  })

  it('stringifies non-error, non-string throws', async () => {
    invoke.mockRejectedValue({ weird: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.loginWithGoogle()
    })
    expect(setError).toHaveBeenCalledWith('{"weird":true}')
    spy.mockRestore()
  })

  it('falls back to "Login failed" for an empty error', async () => {
    invoke.mockRejectedValue('')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.loginWithGoogle()
    })
    expect(setError).toHaveBeenCalledWith('Login failed')
    spy.mockRestore()
  })

  it('logout deletes tokens and clears the user', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.logout()
    })
    expect(keychainDelete).toHaveBeenCalledWith('google-access-token')
    expect(keychainDelete).toHaveBeenCalledWith('google-token-expiry')
    expect(keychainDelete).toHaveBeenCalledWith('google-refresh-token')
    expect(clearUser).toHaveBeenCalled()
  })
})
