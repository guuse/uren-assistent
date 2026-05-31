import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

let storeUser: { email: string } | null = null
const setSimplicateData = vi.fn()
const setSimplicateEmployeeId = vi.fn()

vi.mock('../../store/appStore', () => ({
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ user: storeUser, setSimplicateData, setSimplicateEmployeeId }),
}))

const keychainGet = vi.fn()
const getEmployee = vi.fn()
const fetchExecute = vi.fn()
const createSimplicateRepository = vi.fn(() => ({ getEmployee: (e: string) => getEmployee(e) }))
const createUseCases = vi.fn(() => ({ fetchSimplicateData: { execute: () => fetchExecute() } }))

vi.mock('../../application/container', () => ({
  keychainRepo: { get: (k: string) => keychainGet(k) },
  createSimplicateRepository: (...a: unknown[]) => createSimplicateRepository(...(a as [])),
  createUseCases: (...a: unknown[]) => createUseCases(...(a as [])),
}))

import { useSimplicateData } from './useSimplicateData'

describe('useSimplicateData', () => {
  beforeEach(() => {
    storeUser = { email: 'me@x.com' }
    keychainGet.mockReset().mockResolvedValue('secret')
    getEmployee.mockReset().mockResolvedValue({ id: 'emp-1' })
    fetchExecute.mockReset().mockResolvedValue({ projects: [], services: [], hourTypes: [] })
    setSimplicateData.mockReset()
    setSimplicateEmployeeId.mockReset()
  })

  it('syncs employee id and data on mount', async () => {
    const { result } = renderHook(() => useSimplicateData())
    await waitFor(() => expect(setSimplicateEmployeeId).toHaveBeenCalledWith('emp-1'))
    expect(setSimplicateData).toHaveBeenCalled()
    expect(result.current.needsCredentials).toBe(false)
    expect(result.current.isSyncing).toBe(false)
  })

  it('does nothing without a user', async () => {
    storeUser = null
    const { result } = renderHook(() => useSimplicateData())
    await waitFor(() => expect(result.current.isSyncing).toBe(false))
    expect(getEmployee).not.toHaveBeenCalled()
  })

  it('flags needsCredentials when keys are missing', async () => {
    keychainGet.mockResolvedValue(null)
    const { result } = renderHook(() => useSimplicateData())
    await waitFor(() => expect(result.current.needsCredentials).toBe(true))
    expect(getEmployee).not.toHaveBeenCalled()
  })

  it('flags needsCredentials on a 401 error', async () => {
    getEmployee.mockRejectedValue(new Error('401 Unauthorized'))
    const { result } = renderHook(() => useSimplicateData())
    await waitFor(() => expect(result.current.needsCredentials).toBe(true))
    expect(result.current.syncError).toBeNull()
  })

  it('sets syncError on a generic error', async () => {
    getEmployee.mockRejectedValue('plain string fail')
    const { result } = renderHook(() => useSimplicateData())
    await waitFor(() => expect(result.current.syncError).toBe('plain string fail'))
    expect(result.current.needsCredentials).toBe(false)
  })

  it('exposes a manual sync function', async () => {
    const { result } = renderHook(() => useSimplicateData())
    await waitFor(() => expect(setSimplicateData).toHaveBeenCalled())
    setSimplicateData.mockClear()
    await act(async () => {
      await result.current.sync()
    })
    expect(setSimplicateData).toHaveBeenCalled()
  })
})
