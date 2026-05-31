import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const loginWithGoogle = vi.fn()
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ loginWithGoogle }),
}))

import { useAppStore } from '../../store/appStore'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  beforeEach(() => {
    loginWithGoogle.mockReset()
    useAppStore.setState({ isLoading: false, error: null })
  })

  it('renders the login button and triggers Google login on click', () => {
    render(<LoginPage />)
    const btn = screen.getByText('Inloggen met Google')
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(loginWithGoogle).toHaveBeenCalledOnce()
  })

  it('shows loading state and disables the button', () => {
    useAppStore.setState({ isLoading: true })
    render(<LoginPage />)
    const btn = screen.getByText('Bezig met inloggen…')
    expect(btn).toBeDisabled()
  })

  it('renders an error message when present', () => {
    useAppStore.setState({ error: 'Boom' })
    render(<LoginPage />)
    expect(screen.getByText('Boom')).toBeInTheDocument()
  })

  it('does not render an error block when there is no error', () => {
    render(<LoginPage />)
    expect(screen.queryByText('Boom')).not.toBeInTheDocument()
  })
})
