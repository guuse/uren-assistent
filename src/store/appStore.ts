import { create } from 'zustand'
import type { User } from '../domain/entities/User'
import type {
  SimplicateHourType,
  SimplicateProject,
  SimplicateService,
} from '../domain/repositories/ISimplicateRepository'

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
  isLoading: false,
  error: null,
}

export const useAppStore = create<AppState>()((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, simplicateEmployeeId: null }),

  setSimplicateEmployeeId: (simplicateEmployeeId) => set({ simplicateEmployeeId }),

  setSimplicateData: (data) => set(data),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))
