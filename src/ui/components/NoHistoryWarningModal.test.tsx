import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NoHistoryWarningModal } from './NoHistoryWarningModal'

describe('NoHistoryWarningModal', () => {
  function setup(overrides = {}) {
    const onConfirm = vi.fn()
    const onUpload = vi.fn()
    const onCancel = vi.fn()
    render(
      <NoHistoryWarningModal
        scope="week"
        label="week 21"
        onConfirm={onConfirm}
        onUpload={onUpload}
        onCancel={onCancel}
        {...overrides}
      />
    )
    return { onConfirm, onUpload, onCancel }
  }

  it('renders the label', () => {
    setup()
    expect(screen.getByText('week 21')).toBeInTheDocument()
    expect(screen.getByText('Geen browsergeschiedenis beschikbaar')).toBeInTheDocument()
  })

  it('calls onConfirm', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByText('Toch verwerken'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onUpload', () => {
    const { onUpload } = setup()
    fireEvent.click(screen.getByText('📂 Upload geschiedenis eerst'))
    expect(onUpload).toHaveBeenCalledOnce()
  })

  it('calls onCancel', () => {
    const { onCancel } = setup()
    fireEvent.click(screen.getByText('Annuleren'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('supports day scope', () => {
    setup({ scope: 'day', label: 'maandag 19 mei' })
    expect(screen.getByText('maandag 19 mei')).toBeInTheDocument()
  })
})
