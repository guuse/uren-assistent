import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'
import type { User } from '../domain/entities/User'

function reset() {
  useAppStore.setState({
    user: null,
    simplicateEmployeeId: null,
    projects: [],
    services: [],
    hourTypes: [],
    githubToken: null,
    githubUsername: null,
    linearToken: null,
    tokenStatuses: { github: 'unknown', linear: 'unknown' },
    dayContexts: {},
    isLoading: false,
    error: null,
  })
}

const user: User = { email: 'guus@harborn.com', name: 'Guus' } as unknown as User

describe('appStore', () => {
  beforeEach(() => reset())

  it('setUser sets the user', () => {
    useAppStore.getState().setUser(user)
    expect(useAppStore.getState().user).toBe(user)
  })

  it('clearUser resets user and simplicateEmployeeId', () => {
    useAppStore.getState().setUser(user)
    useAppStore.getState().setSimplicateEmployeeId('emp1')
    useAppStore.getState().clearUser()
    expect(useAppStore.getState().user).toBeNull()
    expect(useAppStore.getState().simplicateEmployeeId).toBeNull()
  })

  it('setSimplicateEmployeeId sets the id', () => {
    useAppStore.getState().setSimplicateEmployeeId('emp42')
    expect(useAppStore.getState().simplicateEmployeeId).toBe('emp42')
  })

  it('setSimplicateData replaces projects, services and hourTypes', () => {
    const data = {
      projects: [{ id: 'P1', name: 'Acme' }] as never,
      services: [{ id: 's1', name: 'Dev', projectId: 'P1' }] as never,
      hourTypes: [{ id: 'ht1', label: 'Dev' }] as never,
    }
    useAppStore.getState().setSimplicateData(data)
    expect(useAppStore.getState().projects).toBe(data.projects)
    expect(useAppStore.getState().services).toBe(data.services)
    expect(useAppStore.getState().hourTypes).toBe(data.hourTypes)
  })

  it('setGithubToken and setGithubUsername set their values', () => {
    useAppStore.getState().setGithubToken('gh_tok')
    useAppStore.getState().setGithubUsername('octocat')
    expect(useAppStore.getState().githubToken).toBe('gh_tok')
    expect(useAppStore.getState().githubUsername).toBe('octocat')
  })

  it('setLinearToken sets the token', () => {
    useAppStore.getState().setLinearToken('lin_tok')
    expect(useAppStore.getState().linearToken).toBe('lin_tok')
  })

  it('setTokenStatus updates one service without clobbering the other', () => {
    useAppStore.getState().setTokenStatus('github', 'ok')
    expect(useAppStore.getState().tokenStatuses).toEqual({ github: 'ok', linear: 'unknown' })
    useAppStore.getState().setTokenStatus('linear', 'fail')
    expect(useAppStore.getState().tokenStatuses).toEqual({ github: 'ok', linear: 'fail' })
  })

  it('setDayContext adds a context keyed by date and keeps existing ones', () => {
    const ctxA = { commits: [], linearIssues: [] }
    const ctxB = { commits: [], linearIssues: [] }
    useAppStore.getState().setDayContext('2026-05-19', ctxA)
    useAppStore.getState().setDayContext('2026-05-20', ctxB)
    expect(useAppStore.getState().dayContexts).toEqual({
      '2026-05-19': ctxA,
      '2026-05-20': ctxB,
    })
  })

  it('setLoading and setError set UI flags', () => {
    useAppStore.getState().setLoading(true)
    expect(useAppStore.getState().isLoading).toBe(true)
    useAppStore.getState().setError('boom')
    expect(useAppStore.getState().error).toBe('boom')
    useAppStore.getState().setError(null)
    expect(useAppStore.getState().error).toBeNull()
  })
})
