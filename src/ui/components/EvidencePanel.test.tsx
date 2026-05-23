import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EvidencePanel from './EvidencePanel'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'

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

  function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
    return {
      id: '1',
      title: 'Daily Stand-up',
      start: new Date('2026-05-13T09:00:00'),
      end: new Date('2026-05-13T09:30:00'),
      attendees: ['jan@company.com', 'lisa@company.com', 'marco@company.com'],
      status: 'accepted',
      ...overrides,
    }
  }

  it('shows "Context" header instead of "Bezochte pagina\'s" when meetings are provided', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent()]}
      />
    )
    expect(screen.getByText('Context')).toBeInTheDocument()
    expect(screen.queryByText("Bezochte pagina's")).toBeNull()
  })

  it('renders meeting title in agenda section', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent()]}
      />
    )
    expect(screen.getByText('Daily Stand-up')).toBeInTheDocument()
  })

  it('renders "Agenda (1)" sub-label', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent()]}
      />
    )
    expect(screen.getByText('Agenda (1)')).toBeInTheDocument()
  })

  it('renders "Browsing (1)" sub-label when meetings are present', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent()]}
      />
    )
    expect(screen.getByText('Browsing (1)')).toBeInTheDocument()
  })

  it('shows accepted status indicator', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent({ status: 'accepted' })]}
      />
    )
    expect(screen.getByText('✓ accepted')).toBeInTheDocument()
  })

  it('shows tentative status indicator', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent({ status: 'tentative' })]}
      />
    )
    expect(screen.getByText('? tentative')).toBeInTheDocument()
  })

  it('shows first names of up to 3 attendees', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent()]}
      />
    )
    expect(screen.getByText(/Jan, Lisa, Marco/)).toBeInTheDocument()
  })

  it('truncates attendees beyond 3 with +N', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent({ attendees: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'] })]}
      />
    )
    expect(screen.getByText(/\+2/)).toBeInTheDocument()
  })

  it('shows meeting time range', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel
        rawUrls={['https://github.com/org/repo']}
        meetings={[makeEvent()]}
      />
    )
    expect(screen.getByText(/09:00–09:30/)).toBeInTheDocument()
  })

  it('keeps "Bezochte pagina\'s" header when no meetings provided', () => {
    render(<EvidencePanel rawUrls={['https://github.com/org/repo']} />)
    expect(screen.getByText("Bezochte pagina's")).toBeInTheDocument()
  })

  it('keeps "Bezochte pagina\'s" header when meetings is empty array', () => {
    render(
      // @ts-expect-error meetings prop does not exist yet
      <EvidencePanel rawUrls={['https://github.com/org/repo']} meetings={[]} />
    )
    expect(screen.getByText("Bezochte pagina's")).toBeInTheDocument()
  })
})
