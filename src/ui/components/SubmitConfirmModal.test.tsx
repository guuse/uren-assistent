import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubmitConfirmModal } from './SubmitConfirmModal'

describe('SubmitConfirmModal', () => {
  const base = {
    scope: 'week' as const,
    label: 'week 22',
    unbookedCount: 0,
    bookedHours: 8,
    isSubmitting: false,
    onConfirm: () => {},
    onCancel: () => {},
  }

  it('renders plain confirmation with booked hours (comma formatted)', () => {
    render(<SubmitConfirmModal {...base} bookedHours={8} />)
    expect(screen.getByText('week 22 indienen')).toBeInTheDocument()
    expect(screen.getByText('8,0 uur')).toBeInTheDocument()
    expect(screen.getByText('Indienen')).toBeInTheDocument()
  })

  it('warns about a single unbooked block (singular)', () => {
    render(<SubmitConfirmModal {...base} unbookedCount={1} />)
    expect(screen.getByText('1 ongeboekt blok')).toBeInTheDocument()
    expect(screen.getByText('Toch indienen')).toBeInTheDocument()
  })

  it('warns about multiple unbooked blocks (plural)', () => {
    render(<SubmitConfirmModal {...base} unbookedCount={3} />)
    expect(screen.getByText('3 ongeboekte blokken')).toBeInTheDocument()
  })

  it('warns about empty week', () => {
    render(<SubmitConfirmModal {...base} unbookedCount={0} bookedHours={0} />)
    expect(screen.getByText('0 uur')).toBeInTheDocument()
    expect(screen.getByText('Toch indienen')).toBeInTheDocument()
  })

  it('warns about empty day (scope day uses "staat")', () => {
    render(<SubmitConfirmModal {...base} scope="day" label="maandag 25 mei" unbookedCount={0} bookedHours={0} />)
    expect(screen.getByText('0 uur')).toBeInTheDocument()
  })

  it('uses "dag" noun and unbooked wording for day scope', () => {
    render(<SubmitConfirmModal {...base} scope="day" label="maandag" unbookedCount={2} />)
    expect(screen.getByText('2 ongeboekte blokken')).toBeInTheDocument()
  })

  it('shows submitting state and disables buttons', () => {
    render(<SubmitConfirmModal {...base} isSubmitting />)
    expect(screen.getByText('Bezig…')).toBeInTheDocument()
    expect(screen.getByText('Annuleren')).toBeDisabled()
  })

  it('calls onConfirm and onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<SubmitConfirmModal {...base} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Indienen'))
    fireEvent.click(screen.getByText('Annuleren'))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
