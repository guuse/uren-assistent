import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders title and description', () => {
    render(
      <ConfirmDialog
        title="Verwijderen?"
        description="Weet je het zeker?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Verwijderen?')).toBeInTheDocument()
    expect(screen.getByText('Weet je het zeker?')).toBeInTheDocument()
  })

  it('uses default confirm and cancel labels', () => {
    render(
      <ConfirmDialog title="t" description="d" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(screen.getByText('Verwijderen')).toBeInTheDocument()
    expect(screen.getByText('Annuleren')).toBeInTheDocument()
  })

  it('uses custom confirm and cancel labels', () => {
    render(
      <ConfirmDialog
        title="t"
        description="d"
        confirmLabel="Ja"
        cancelLabel="Nee"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText('Ja')).toBeInTheDocument()
    expect(screen.getByText('Nee')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog title="t" description="d" confirmLabel="Ja" onConfirm={onConfirm} onCancel={() => {}} />
    )
    fireEvent.click(screen.getByText('Ja'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog title="t" description="d" cancelLabel="Nee" onConfirm={() => {}} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByText('Nee'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when overlay backdrop clicked', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <ConfirmDialog title="t" description="d" onConfirm={() => {}} onCancel={onCancel} />
    )
    const backdrop = container.querySelector('.bg-black\\/60') as HTMLElement
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows loading state and disables buttons', () => {
    render(
      <ConfirmDialog title="t" description="d" isLoading onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(screen.getByText('Bezig...')).toBeInTheDocument()
    expect(screen.getByText('Annuleren')).toBeDisabled()
  })
})
