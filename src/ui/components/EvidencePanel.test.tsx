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

  it('shows section header "Bezochte pagina\'s"', () => {
    render(<EvidencePanel rawUrls={['https://github.com/org/repo']} />)
    expect(screen.getByText("Bezochte pagina's")).toBeInTheDocument()
  })

  it('renders title as sub-text below URL when both are provided', () => {
    render(
      <EvidencePanel
        rawUrls={['https://github.com/org/repo/pull/42']}
        rawTitles={['Pull Request #42 · org/repo']}
      />
    )
    expect(screen.getByText('Pull Request #42 · org/repo')).toBeInTheDocument()
  })

  it('renders summary in LLM summary section', () => {
    render(
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        summary="This is a test summary"
      />
    )
    expect(screen.getByText('"This is a test summary"')).toBeInTheDocument()
  })

  it('shows startTime and endTime in header when provided', () => {
    render(
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        startTime="09:00"
        endTime="10:00"
      />
    )
    expect(screen.getByText('1 · 09:00–10:00')).toBeInTheDocument()
  })
})
