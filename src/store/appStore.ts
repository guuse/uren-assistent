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
  copilot: TokenStatus
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

  // Copilot
  copilotToken: string | null
  setCopilotToken: (token: string) => void
  selectedCopilotModel: string
  setSelectedCopilotModel: (model: string) => void

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
  copilotToken: null,
  selectedCopilotModel: 'claude-sonnet-4.6',
  githubToken: null,
  githubUsername: null,
  linearToken: null,
  tokenStatuses: { copilot: 'unknown' as const, github: 'unknown' as const, linear: 'unknown' as const },
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

  setCopilotToken: (copilotToken) => set({ copilotToken }),
  setSelectedCopilotModel: (selectedCopilotModel) => set({ selectedCopilotModel }),

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
