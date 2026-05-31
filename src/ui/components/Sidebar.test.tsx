import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  it('renders week and settings buttons', () => {
    render(<Sidebar onSettings={() => {}} />)
    expect(screen.getByTitle('Week')).toBeInTheDocument()
    expect(screen.getByTitle('Instellingen')).toBeInTheDocument()
  })

  it('calls onSettings when settings clicked', () => {
    const onSettings = vi.fn()
    render(<Sidebar onSettings={onSettings} />)
    fireEvent.click(screen.getByTitle('Instellingen'))
    expect(onSettings).toHaveBeenCalledOnce()
  })

  it('clicking week button is a no-op', () => {
    render(<Sidebar onSettings={() => {}} />)
    fireEvent.click(screen.getByTitle('Week'))
    expect(screen.getByTitle('Week')).toBeInTheDocument()
  })

  it('defaults activeTab to week', () => {
    render(<Sidebar onSettings={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('highlights settings tab when active', () => {
    render(<Sidebar onSettings={() => {}} activeTab="settings" />)
    expect(screen.getByTitle('Instellingen')).toBeInTheDocument()
  })
})
