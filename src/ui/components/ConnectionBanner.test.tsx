import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConnectionBanner from './ConnectionBanner'
import { useAppStore } from '../../store/appStore'

describe('ConnectionBanner', () => {
  beforeEach(() => {
    useAppStore.setState({ tokenStatuses: { github: 'unknown', linear: 'unknown' } })
  })

  it('renders nothing when no token failed', () => {
    const { container } = render(<ConnectionBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a single failed service label', () => {
    useAppStore.setState({ tokenStatuses: { github: 'fail', linear: 'ok' } })
    render(<ConnectionBanner />)
    expect(screen.getByText('GitHub token')).toBeInTheDocument()
  })

  it('shows multiple failed service labels joined', () => {
    useAppStore.setState({ tokenStatuses: { github: 'fail', linear: 'fail' } })
    render(<ConnectionBanner />)
    expect(screen.getByText('GitHub token, Linear API key')).toBeInTheDocument()
  })

  it('falls back to the raw service key when it has no label', () => {
    // Inject an unmapped failing service to exercise the `?? k` fallback.
    useAppStore.setState({
      tokenStatuses: { github: 'ok', linear: 'ok', simplicate: 'fail' } as never,
    })
    render(<ConnectionBanner />)
    expect(screen.getByText('simplicate')).toBeInTheDocument()
  })

  it('can be dismissed', () => {
    useAppStore.setState({ tokenStatuses: { github: 'fail', linear: 'ok' } })
    const { container } = render(<ConnectionBanner />)
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(container.firstChild).toBeNull()
  })
})
