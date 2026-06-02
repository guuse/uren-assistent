import { create } from 'zustand'
import type { User } from '../domain/entities/User'
import type {
  SimplicateHourType,
  SimplicateProject,
  SimplicateService,
} from '../domain/repositories/ISimplicateRepository'
import type { GitHubCommit } from '../domain/entities/GitHubCommit'
import type { LinearIssue } from '../domain/entities/LinearIssue'

export type TokenStatus = 'unknown' | 'ok' | 'fail'

export interface TokenStatuses {
  github: TokenStatus
  linear: TokenStatus
}

export interface DayContext {
  commits: GitHubCommit[]
  linearIssues: LinearIssue[]
}

interface AppState {
  // Auth
  user: User | null
  setUser: (user: User) => void
  clearUser: () => void
  simplicateEmployeeId: string | null
  setSimplicateEmployeeId: (id: string) => void

  // Simplicate data cache
  projects: SimplicateProject[]
  services: SimplicateService[]
  hourTypes: SimplicateHourType[]
  setSimplicateData: (data: { projects: SimplicateProject[]; services: SimplicateService[]; hourTypes: SimplicateHourType[] }) => void

  // GitHub
  githubToken: string | null
  setGithubToken: (token: string) => void
  githubUsername: string | null
  setGithubUsername: (username: string) => void

  // Linear
  linearToken: string | null
  setLinearToken: (token: string) => void

  // Token connection status
  tokenStatuses: TokenStatuses
  setTokenStatus: (service: keyof TokenStatuses, status: TokenStatus) => void

  // Day context (commits + linear issues per date, set after ProcessWeek)
  dayContexts: Record<string, DayContext>
  setDayContext: (date: string, ctx: DayContext) => void

  // UI
  isLoading: boolean
  setLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
}

const initialState = {
  user: null,
  simplicateEmployeeId: null,
  projects: [],
  services: [],
  hourTypes: [],
  githubToken: null,
  githubUsername: null,
  linearToken: null,
  tokenStatuses: { github: 'unknown' as const, linear: 'unknown' as const },
  dayContexts: {},
  isLoading: false,
  error: null,
}

export const useAppStore = create<AppState>()((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, simplicateEmployeeId: null }),

  setSimplicateEmployeeId: (simplicateEmployeeId) => set({ simplicateEmployeeId }),

  setSimplicateData: (data) => set(data),

  setGithubToken: (githubToken) => set({ githubToken }),
  setGithubUsername: (githubUsername) => set({ githubUsername }),
  setLinearToken: (linearToken) => set({ linearToken }),

  setTokenStatus: (service, status) =>
    set((state) => ({ tokenStatuses: { ...state.tokenStatuses, [service]: status } })),

  setDayContext: (date, ctx) =>
    set((state) => ({ dayContexts: { ...state.dayContexts, [date]: ctx } })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))

// E2E only: expose the store so the Playwright harness can seed an authenticated
// session without driving the (faked) SSO UI. Guarded by the build mode, so it is
// inert in dev and production bundles. See docs/adr/0005 and tests/e2e.
/* v8 ignore start -- e2e-only seam, never exercised by unit tests */
if (import.meta.env.MODE === 'e2e') {
  ;(window as unknown as { __APP_STORE__: typeof useAppStore }).__APP_STORE__ = useAppStore
}
/* v8 ignore stop */
