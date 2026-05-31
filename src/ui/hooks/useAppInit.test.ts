import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const invoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invoke(...a) }))

const keychainGet = vi.fn()
vi.mock('../../application/container', () => ({
  keychainRepo: { get: (k: string) => keychainGet(k) },
}))

const testGitHubToken = vi.fn()
const testLinearToken = vi.fn()
vi.mock('../../infrastructure/tokenTest', () => ({
  testGitHubToken: (t: string) => testGitHubToken(t),
  testLinearToken: (t: string) => testLinearToken(t),
}))

const setGithubToken = vi.fn()
const setGithubUsername = vi.fn()
const setLinearToken = vi.fn()
const setTokenStatus = vi.fn()
vi.mock('../../store/appStore', () => ({
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setGithubToken, setGithubUsername, setLinearToken, setTokenStatus }),
}))

import { useAppInit } from './useAppInit'

describe('useAppInit', () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue(undefined)
    keychainGet.mockReset()
    testGitHubToken.mockReset().mockResolvedValue({ ok: true })
    testLinearToken.mockReset().mockResolvedValue({ ok: true })
    setGithubToken.mockReset()
    setGithubUsername.mockReset()
    setLinearToken.mockReset()
    setTokenStatus.mockReset()
  })

  it('loads all tokens and sets status ok', async () => {
    keychainGet.mockImplementation((k: string) => {
      const map: Record<string, string> = {
        'github-token': 'gh',
        'github-username': 'me',
        'linear-token': 'lt',
      }
      return Promise.resolve(map[k] ?? null)
    })

    renderHook(() => useAppInit())

    await waitFor(() => expect(setGithubToken).toHaveBeenCalledWith('gh'))
    expect(setGithubUsername).toHaveBeenCalledWith('me')
    expect(setLinearToken).toHaveBeenCalledWith('lt')
    await waitFor(() => expect(setTokenStatus).toHaveBeenCalledWith('github', 'ok'))
    await waitFor(() => expect(setTokenStatus).toHaveBeenCalledWith('linear', 'ok'))
    expect(invoke).toHaveBeenCalledWith('ensure_app_data_dir')
  })

  it('sets fail status when token tests fail or reject', async () => {
    keychainGet.mockImplementation((k: string) => {
      const map: Record<string, string> = { 'github-token': 'gh', 'linear-token': 'lt' }
      return Promise.resolve(map[k] ?? null)
    })
    testGitHubToken.mockResolvedValue({ ok: false })
    testLinearToken.mockRejectedValue(new Error('x'))

    renderHook(() => useAppInit())

    await waitFor(() => expect(setTokenStatus).toHaveBeenCalledWith('github', 'fail'))
    await waitFor(() => expect(setTokenStatus).toHaveBeenCalledWith('linear', 'fail'))
    expect(setGithubUsername).not.toHaveBeenCalled()
  })

  it('sets linear fail when its token test reports not-ok', async () => {
    keychainGet.mockImplementation((k: string) =>
      Promise.resolve(k === 'linear-token' ? 'lt' : null),
    )
    testLinearToken.mockResolvedValue({ ok: false })

    renderHook(() => useAppInit())

    await waitFor(() => expect(setTokenStatus).toHaveBeenCalledWith('linear', 'fail'))
  })

  it('rejects github test promise -> fail', async () => {
    keychainGet.mockImplementation((k: string) =>
      Promise.resolve(k === 'github-token' ? 'gh' : null),
    )
    testGitHubToken.mockRejectedValue(new Error('boom'))

    renderHook(() => useAppInit())

    await waitFor(() => expect(setTokenStatus).toHaveBeenCalledWith('github', 'fail'))
  })

  it('does nothing when no tokens present', async () => {
    keychainGet.mockResolvedValue(null)
    renderHook(() => useAppInit())
    await waitFor(() => expect(invoke).toHaveBeenCalled())
    expect(setGithubToken).not.toHaveBeenCalled()
    expect(setLinearToken).not.toHaveBeenCalled()
  })

  it('swallows errors from invoke', async () => {
    invoke.mockRejectedValue(new Error('dir fail'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useAppInit())
    await waitFor(() => expect(spy).toHaveBeenCalled())
    spy.mockRestore()
  })
})
