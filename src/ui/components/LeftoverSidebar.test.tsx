import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftoverSidebar } from './LeftoverSidebar'
import { useAppStore } from '../../store/appStore'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function leftover(overrides: Record<string, unknown> = {}): ClassifiedBlock {
  return {
    date: '2026-06-01',
    urlPattern: 'github.com/acme/web',
    urls: [], titles: [], visitCount: 0,
    firstVisitTime: '00:00', lastVisitTime: '00:00',
    hours: 1.5,
    blockName: 'Uren-assistent Gemini fix',
    summary: '', startTime: '00:00', endTime: '00:00',
    projectId: 'p1', serviceId: 's1',
    confidence: 5, origin: 'llm',
    unplaced: true, leftoverReason: 'overflow',
    ...overrides,
  } as ClassifiedBlock
}

function props(overrides: Partial<Parameters<typeof LeftoverSidebar>[0]> = {}) {
  return {
    leftovers: [leftover()],
    onBook: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  useAppStore.setState({ projects: [{ id: 'p1', name: 'Project One', organizationName: 'Org' }] })
})

describe('LeftoverSidebar', () => {
  it('renders nothing when there are no leftovers', () => {
    const { container } = render(<LeftoverSidebar {...props({ leftovers: [] })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a chip per leftover with its name and count badge', () => {
    render(<LeftoverSidebar {...props({ leftovers: [leftover(), leftover({ urlPattern: 'x', blockName: 'Tweede' })] })} />)
    expect(screen.getByText('Uren-assistent Gemini fix')).toBeInTheDocument()
    expect(screen.getByText('Tweede')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // count badge
  })

  it('flags a missing-project leftover and always shows its actions', () => {
    const { projectId: _p, serviceId: _s, ...noProject } = leftover({ blockName: 'Documentatie', leftoverReason: 'suggestion' })
    render(<LeftoverSidebar {...props({ leftovers: [noProject as ClassifiedBlock] })} />)
    expect(screen.getByText(/Documentatie/)).toBeInTheDocument()
    expect(screen.getByText('project ontbreekt')).toBeInTheDocument()
    // missing-project chips reveal actions without hover
    expect(screen.getByTitle('Direct boeken')).toBeInTheDocument()
  })

  it('fires book / dismiss for a chip (no add action)', () => {
    const onBook = vi.fn(), onDismiss = vi.fn()
    const block = leftover()
    render(<LeftoverSidebar {...props({ leftovers: [block], onBook, onDismiss })} />)
    fireEvent.mouseEnter(screen.getByText('Uren-assistent Gemini fix').closest('div')!.parentElement!)
    expect(screen.queryByTitle('Toevoegen aan dag')).not.toBeInTheDocument() // add removed
    fireEvent.click(screen.getByTitle('Direct boeken'))
    fireEvent.click(screen.getByTitle('Negeren'))
    expect(onBook).toHaveBeenCalledWith(block)
    expect(onDismiss).toHaveBeenCalledWith(block)
  })

  it('collapses to a rail and re-opens', () => {
    render(<LeftoverSidebar {...props()} />)
    expect(screen.getByTitle('Inklappen')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Inklappen'))
    // collapsed: chips are hidden, the rail toggle is shown
    expect(screen.queryByTitle('Inklappen')).not.toBeInTheDocument()
    expect(screen.queryByText('Uren-assistent Gemini fix')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Niet-geplaatste blokken tonen'))
    expect(screen.getByTitle('Inklappen')).toBeInTheDocument()
  })

  it('hides actions when read-only', () => {
    render(<LeftoverSidebar {...props({ readOnly: true })} />)
    expect(screen.queryByTitle('Direct boeken')).not.toBeInTheDocument()
    expect(screen.getByText(/alleen-lezen/)).toBeInTheDocument()
  })
})
