import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('./ui/hooks/useAppInit', () => ({ useAppInit: vi.fn() }))
vi.mock('./ui/hooks/useSimplicateData', () => ({ useSimplicateData: vi.fn() }))
vi.mock('./ui/pages/LoginPage', () => ({ LoginPage: () => <div data-testid="login" /> }))
vi.mock('./ui/pages/WeekPage', () => ({ WeekPage: () => <div data-testid="week" /> }))
vi.mock('./ui/components/ConnectionBanner', () => ({ default: () => <div data-testid="banner" /> }))
vi.mock('./ui/pages/Settings/SettingsPage', () => ({
  SettingsPage: ({ onBack }: { onBack: () => void }) => (
    <button data-testid="settings" onClick={onBack}>settings-back</button>
  ),
}))
vi.mock('./ui/components/Sidebar', () => ({
  Sidebar: ({ onSettings, activeTab }: { onSettings: () => void; activeTab?: string }) => (
    <button data-testid="sidebar" data-active={activeTab} onClick={onSettings}>sidebar</button>
  ),
}))

import { useAppStore } from './store/appStore'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    useAppStore.setState({ user: null })
  })

  it('renders LoginPage when there is no user', () => {
    render(<App />)
    expect(screen.getByTestId('login')).toBeInTheDocument()
    expect(screen.queryByTestId('week')).not.toBeInTheDocument()
  })

  it('renders WeekPage with sidebar/banner when logged in', () => {
    useAppStore.setState({ user: { id: 'u', name: 'N', email: 'e', googleId: 'g' } })
    render(<App />)
    expect(screen.getByTestId('week')).toBeInTheDocument()
    expect(screen.getByTestId('banner')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-active', 'week')
  })

  it('navigates to settings and back', () => {
    useAppStore.setState({ user: { id: 'u', name: 'N', email: 'e', googleId: 'g' } })
    render(<App />)
    // Open settings via sidebar
    fireEvent.click(screen.getByTestId('sidebar'))
    expect(screen.getByTestId('settings')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-active', 'settings')
    // Clicking the sidebar again while in settings keeps us in settings
    fireEvent.click(screen.getByTestId('sidebar'))
    expect(screen.getByTestId('settings')).toBeInTheDocument()
    // Go back
    fireEvent.click(screen.getByTestId('settings'))
    expect(screen.getByTestId('week')).toBeInTheDocument()
  })
})
