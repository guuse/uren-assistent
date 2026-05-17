import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../../src/store/appStore'
import { act } from '@testing-library/react'

describe('appStore', () => {
  beforeEach(() => {
    act(() => useAppStore.setState(useAppStore.getInitialState()))
  })

  it('starts unauthenticated', () => {
    expect(useAppStore.getState().user).toBeNull()
  })

  it('setUser updates auth state', () => {
    act(() => {
      useAppStore.getState().setUser({ id: 'e1', name: 'Guus', email: 'guus@test.nl', googleId: 'g1' })
    })
    expect(useAppStore.getState().user?.email).toBe('guus@test.nl')
  })

  it('clearUser resets auth state', () => {
    act(() => {
      useAppStore.getState().setUser({ id: 'e1', name: 'Guus', email: 'guus@test.nl', googleId: 'g1' })
      useAppStore.getState().clearUser()
    })
    expect(useAppStore.getState().user).toBeNull()
  })
})
