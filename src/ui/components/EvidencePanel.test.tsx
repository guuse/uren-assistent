import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EvidencePanel from './EvidencePanel'

describe('EvidencePanel', () => {
  it('renders nothing when both arrays are empty', () => {
    const { container } = render(<EvidencePanel rawTitles={[]} rawUrls={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when both arrays are undefined', () => {
    const { container } = render(<EvidencePanel rawTitles={undefined} rawUrls={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders URLs when provided', () => {
    render(<EvidencePanel rawUrls={['https://github.com/org/repo/pull/42']} />)
    expect(screen.getByText('github.com/org/repo/pull/42')).toBeInTheDocument()
  })

  it('renders titles when provided', () => {
    render(<EvidencePanel rawTitles={['Pull Request #42 · org/repo']} />)
    expect(screen.getByText('Pull Request #42 · org/repo')).toBeInTheDocument()
  })

  it('truncates titles longer than 80 characters', () => {
    const longTitle = 'A'.repeat(90)
    render(<EvidencePanel rawTitles={[longTitle]} />)
    expect(screen.getByText('A'.repeat(80) + '…')).toBeInTheDocument()
  })

  it('shows section header "Wat je deed"', () => {
    render(<EvidencePanel rawUrls={['https://github.com/org/repo']} />)
    expect(screen.getByText('Wat je deed')).toBeInTheDocument()
  })
})
