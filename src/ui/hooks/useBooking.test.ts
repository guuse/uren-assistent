import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { SimplicateProject } from '../../domain/repositories/ISimplicateRepository'

const projects: SimplicateProject[] = [
  { id: 'p1', name: 'Beta', organizationName: 'Org' } as SimplicateProject,
  { id: 'p2', name: 'Alpha', organizationName: 'Org' } as SimplicateProject,
  { id: 'p3', name: 'Gamma', organizationName: 'Org' } as SimplicateProject,
]
const hourTypes = [
  { id: 'ht1', label: 'Dev' },
  { id: 'ht2', label: 'Design' },
]

let employeeId: string | null = 'emp-1'
vi.mock('../../store/appStore', () => ({
  useAppStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ simplicateEmployeeId: employeeId, projects, hourTypes }),
}))

let starredIds = new Set<string>(['p1'])
const toggleStar = vi.fn()
vi.mock('./useStarredProjects', () => ({
  useStarredProjects: () => ({ starredIds, toggle: toggleStar }),
}))

const keychainGet = vi.fn()
const getServices = vi.fn()
const bookExecute = vi.fn()
const updateExecute = vi.fn()
const deleteExecute = vi.fn()
const createSimplicateRepository = vi.fn(() => ({ getServices: (p: string, d: string) => getServices(p, d) }))
const createUseCases = vi.fn(() => ({
  bookHours: { execute: (e: unknown) => bookExecute(e) },
  updateHourEntry: { execute: (e: unknown) => updateExecute(e) },
  deleteHourEntry: { execute: (id: string) => deleteExecute(id) },
}))

vi.mock('../../application/container', () => ({
  keychainRepo: { get: (k: string) => keychainGet(k) },
  createSimplicateRepository: () => createSimplicateRepository(),
  createUseCases: () => createUseCases(),
}))

import { useBooking } from './useBooking'

describe('useBooking', () => {
  beforeEach(() => {
    employeeId = 'emp-1'
    starredIds = new Set<string>(['p1'])
    keychainGet.mockReset().mockResolvedValue('secret')
    getServices.mockReset().mockResolvedValue([
      { id: 's1', name: 'Service 1', hourTypeIds: ['ht1'] },
      { id: 's2', name: 'Service 2', hourTypeIds: ['ht1', 'ht2'] },
    ])
    bookExecute.mockReset().mockResolvedValue(undefined)
    updateExecute.mockReset().mockResolvedValue(undefined)
    deleteExecute.mockReset().mockResolvedValue(undefined)
    toggleStar.mockReset()
    createSimplicateRepository.mockClear()
    createUseCases.mockClear()
  })

  it('sorts projects with starred first and exposes lastStarredId', () => {
    const { result } = renderHook(() => useBooking())
    expect(result.current.projects[0]!.id).toBe('p1')
    expect(result.current.lastStarredId).toBe('p1')
  })

  it('sorts multiple starred projects alphabetically', () => {
    starredIds = new Set<string>(['p1', 'p2'])
    const { result } = renderHook(() => useBooking())
    // p2 (Alpha) sorts before p1 (Beta) within the starred group
    expect(result.current.projects[0]!.id).toBe('p2')
    expect(result.current.projects[1]!.id).toBe('p1')
    expect(result.current.lastStarredId).toBe('p1')
  })

  it('has undefined lastStarredId when nothing is starred', () => {
    starredIds = new Set<string>()
    const { result } = renderHook(() => useBooking())
    expect(result.current.lastStarredId).toBeUndefined()
  })

  it('reports missing fields and canBook', () => {
    const { result } = renderHook(() => useBooking())
    expect(result.current.canBook).toBe(false)
    expect(result.current.missingFields).toContain('project')
  })

  it('snaps a non-quarter start to the nearest quarter and keeps the duration', () => {
    // A concept block at 16:11–16:41 has times no <select> option matches, so the
    // dropdowns fell back to their first entry (07:00). Snap to 16:15 + 30m → 16:45.
    const { result } = renderHook(() => useBooking({ startTime: '16:11', endTime: '16:41' }))
    expect(result.current.startTime).toBe('16:15')
    expect(result.current.endTime).toBe('16:45')
  })

  it('rounds a non-quarter duration up to a whole quarter so TOT lands on an option', () => {
    const { result } = renderHook(() => useBooking({ startTime: '10:02', endTime: '10:39' }))
    // 10:02 → 10:00; 37m → 30m → 10:30
    expect(result.current.startTime).toBe('10:00')
    expect(result.current.endTime).toBe('10:30')
  })

  it('leaves already-quarter-aligned times untouched', () => {
    const { result } = renderHook(() => useBooking({ startTime: '09:00', endTime: '11:00' }))
    expect(result.current.startTime).toBe('09:00')
    expect(result.current.endTime).toBe('11:00')
  })

  it('keeps the default times when no start is provided', () => {
    const { result } = renderHook(() => useBooking())
    expect(result.current.startTime).toBe('09:00')
    expect(result.current.endTime).toBe('09:30')
  })

  it('loads services when a project is selected', async () => {
    const { result } = renderHook(() => useBooking())
    await act(async () => {
      await result.current.setProjectId('p1')
    })
    await waitFor(() => expect(result.current.services.length).toBe(2))
    expect(getServices).toHaveBeenCalled()
  })

  it('clears services when project is cleared', async () => {
    const { result } = renderHook(() => useBooking({ projectId: 'p1' }))
    await waitFor(() => expect(result.current.services.length).toBe(2))
    await act(async () => {
      await result.current.setProjectId('')
    })
    await waitFor(() => expect(result.current.services.length).toBe(0))
  })

  it('does not load services when api keys are missing', async () => {
    keychainGet.mockResolvedValue(null)
    const { result } = renderHook(() => useBooking())
    await act(async () => {
      await result.current.setProjectId('p1')
    })
    await waitFor(() => expect(keychainGet).toHaveBeenCalled())
    expect(getServices).not.toHaveBeenCalled()
  })

  it('filters hour types to the selected service', async () => {
    const { result } = renderHook(() => useBooking({ projectId: 'p1' }))
    await waitFor(() => expect(result.current.services.length).toBe(2))
    act(() => {
      result.current.setServiceId('s1')
    })
    await waitFor(() => expect(result.current.hourTypes.map((h) => h.id)).toEqual(['ht1']))
  })

  it('clears an incompatible hour type when service changes', async () => {
    const { result } = renderHook(() => useBooking({ projectId: 'p1' }))
    await waitFor(() => expect(result.current.services.length).toBe(2))
    act(() => {
      result.current.setHourTypeId('ht2')
    })
    act(() => {
      result.current.setServiceId('s1') // s1 only allows ht1
    })
    await waitFor(() => expect(result.current.hourTypeId).toBe(''))
  })

  it('keeps a compatible hour type when service changes', async () => {
    const { result } = renderHook(() => useBooking({ projectId: 'p1' }))
    await waitFor(() => expect(result.current.services.length).toBe(2))
    act(() => {
      result.current.setHourTypeId('ht1')
    })
    act(() => {
      result.current.setServiceId('s2') // s2 allows ht1
    })
    await waitFor(() => expect(result.current.hourTypeId).toBe('ht1'))
  })

  it('books a new entry', async () => {
    const { result } = renderHook(() =>
      useBooking({ projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1' }),
    )
    await act(async () => {
      await result.current.book()
    })
    expect(bookExecute).toHaveBeenCalled()
    expect(result.current.status).toBe('success')
  })

  it('updates an existing entry when initial.id is set', async () => {
    const { result } = renderHook(() =>
      useBooking({ id: 'h1', projectId: 'p1', projectServiceId: 's1', hourTypeId: 'ht1', startTime: '09:00', endTime: '11:00' }),
    )
    await act(async () => {
      await result.current.book()
    })
    expect(updateExecute).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1', hours: 2 }))
  })

  it('book is a no-op without an employee id', async () => {
    employeeId = null
    const { result } = renderHook(() => useBooking({ projectId: 'p1' }))
    await act(async () => {
      await result.current.book()
    })
    expect(bookExecute).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('book sets error when credentials are missing', async () => {
    keychainGet.mockResolvedValue(null)
    const { result } = renderHook(() => useBooking({ projectId: 'p1' }))
    await act(async () => {
      await result.current.book()
    })
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toContain('API key')
  })

  it('book surfaces a string error (e.g. the Simplicate API message) instead of a generic one', async () => {
    bookExecute.mockRejectedValue('Simplicate API error: 400 — invalid type_id')
    const { result } = renderHook(() => useBooking({ projectId: 'p1' }))
    await act(async () => {
      await result.current.book()
    })
    expect(result.current.errorMessage).toBe('Simplicate API error: 400 — invalid type_id')
  })

  it('book falls back to a generic message for non-string, non-Error throws', async () => {
    bookExecute.mockRejectedValue({ weird: true })
    const { result } = renderHook(() => useBooking({ projectId: 'p1' }))
    await act(async () => {
      await result.current.book()
    })
    expect(result.current.errorMessage).toBe('Boeken mislukt')
  })

  it('deletes an entry', async () => {
    const { result } = renderHook(() => useBooking())
    await act(async () => {
      await result.current.deleteEntry('h9')
    })
    expect(deleteExecute).toHaveBeenCalledWith('h9')
    expect(result.current.status).toBe('success')
  })

  it('deleteEntry sets error when credentials are missing', async () => {
    keychainGet.mockResolvedValue(null)
    const { result } = renderHook(() => useBooking())
    await act(async () => {
      await result.current.deleteEntry('h9')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toContain('API key')
  })

  it('deleteEntry sets a default error for non-Error throws', async () => {
    deleteExecute.mockRejectedValue('weird')
    const { result } = renderHook(() => useBooking())
    await act(async () => {
      await result.current.deleteEntry('h9')
    })
    expect(result.current.errorMessage).toBe('Verwijderen mislukt')
  })

  it('exposes toggleStar from useStarredProjects', () => {
    const { result } = renderHook(() => useBooking())
    result.current.toggleStar('p2')
    expect(toggleStar).toHaveBeenCalledWith('p2')
  })
})
