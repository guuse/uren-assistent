import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'

vi.mock('./AccountSettings', () => ({
  AccountSettings: () => <div data-testid="account-settings" />,
}))

describe('SettingsPage', () => {
  it('renders title, back button and AccountSettings', () => {
    render(<SettingsPage onBack={() => {}} />)
    expect(screen.getByText('Instellingen')).toBeInTheDocument()
    expect(screen.getByTestId('account-settings')).toBeInTheDocument()
    expect(screen.getByText('← Terug')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<SettingsPage onBack={onBack} />)
    fireEvent.click(screen.getByText('← Terug'))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
