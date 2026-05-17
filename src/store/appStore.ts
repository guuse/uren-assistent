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
  projects: [],
  services: [],
  hourTypes: [],
  isLoading: false,
  error: null,
}

export const useAppStore = create<AppState>()((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),

  setSimplicateData: (data) => set(data),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
})) as ReturnType<typeof create<AppState>> & { getInitialState: () => AppState }

// Expose for testing
;(useAppStore as unknown as { getInitialState: () => AppState }).getInitialState = () => ({
  ...initialState,
  setUser: useAppStore.getState().setUser,
  clearUser: useAppStore.getState().clearUser,
  setSimplicateData: useAppStore.getState().setSimplicateData,
  setLoading: useAppStore.getState().setLoading,
  setError: useAppStore.getState().setError,
})
