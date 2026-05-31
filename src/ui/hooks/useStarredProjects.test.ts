import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useStarredProjects } from './useStarredProjects'

const load = vi.fn()
const toggle = vi.fn()
const getStarredIds = vi.fn()

vi.mock('../../application/container', () => ({
  starredProjectsStore: {
    load: () => load(),
    toggle: (id: string) => toggle(id),
    getStarredIds: () => getStarredIds(),
  },
}))

describe('useStarredProjects', () => {
  beforeEach(() => {
    load.mockReset().mockResolvedValue(undefined)
    toggle.mockReset().mockResolvedValue(undefined)
    getStarredIds.mockReset().mockReturnValue(['p1'])
  })

  it('loads starred ids on mount', async () => {
    const { result } = renderHook(() => useStarredProjects())
    await waitFor(() => expect(result.current.starredIds.has('p1')).toBe(true))
    expect(load).toHaveBeenCalled()
  })

  it('toggles a project and refreshes the set', async () => {
    getStarredIds.mockReturnValue(['p1', 'p2'])
    const { result } = renderHook(() => useStarredProjects())
    await waitFor(() => expect(result.current.starredIds.size).toBeGreaterThan(0))

    await act(async () => {
      await result.current.toggle('p2')
    })

    expect(toggle).toHaveBeenCalledWith('p2')
    expect(result.current.starredIds.has('p2')).toBe(true)
  })
})
