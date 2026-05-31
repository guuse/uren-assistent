import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

// --- Mock useBooking ---------------------------------------------------------
const setStartTime = vi.fn()
const setEndTime = vi.fn()
const setProjectId = vi.fn()
const setServiceId = vi.fn()
const setHourTypeId = vi.fn()
const setNote = vi.fn()
const book = vi.fn()
const deleteEntry = vi.fn()
const toggleStar = vi.fn()

function baseBooking() {
  return {
    projectId: '',
    setProjectId,
    serviceId: '',
    setServiceId,
    hourTypeId: '',
    setHourTypeId,
    note: '',
    setNote,
    startTime: '09:00',
    setStartTime,
    endTime: '09:30',
    setEndTime,
    date: '2026-05-31',
    setDate: vi.fn(),
    services: [] as { id: string; name: string; hourTypeIds: string[] }[],
    status: 'idle' as 'idle' | 'loading' | 'success' | 'error',
    errorMessage: null as string | null,
    missingFields: ['project', 'dienst', 'urensoort'] as string[],
    canBook: false,
    projects: [] as { id: string; name: string; organizationName: string }[],
    starredIds: new Set<string>(),
    toggleStar,
    lastStarredId: undefined as string | undefined,
    hourTypes: [] as { id: string; label: string }[],
    book,
    deleteEntry,
  }
}

type BookingMock = ReturnType<typeof baseBooking>
let bookingState: BookingMock

function makeBooking(overrides: Partial<BookingMock> = {}): BookingMock {
  return { ...baseBooking(), ...overrides }
}

vi.mock('../hooks/useBooking', () => ({
  useBooking: () => bookingState,
}))

vi.mock('../components/EvidencePanel', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="evidence-panel" data-summary={String(props.summary)} />
  ),
}))

import { BookingModal } from './BookingModal'

beforeEach(() => {
  vi.useFakeTimers()
  setStartTime.mockReset()
  setEndTime.mockReset()
  setProjectId.mockReset()
  setServiceId.mockReset()
  setHourTypeId.mockReset()
  setNote.mockReset()
  book.mockReset()
  deleteEntry.mockReset()
  toggleStar.mockReset()
  bookingState = makeBooking()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

const block: ClassifiedBlock = {
  blockName: 'Block A',
  summary: 'A summary',
  date: '2026-05-31',
  startTime: '10:00',
  endTime: '11:00',
  hours: 1,
  confidence: 4,
  origin: 'llm',
  urls: ['https://x.com'],
  titles: ['Title'],
  rawUrls: ['https://x.com'],
  rawTitles: ['Title'],
  overlappingMeetings: [],
  commits: [],
  linearIssues: [],
} as unknown as ClassifiedBlock

describe('BookingModal', () => {
  it('renders default title and single-column form (no evidence)', () => {
    render(<BookingModal onClose={() => {}} />)
    expect(screen.getByText('Uren boeken')).toBeInTheDocument()
    expect(screen.queryByTestId('evidence-panel')).not.toBeInTheDocument()
    // Project field present, dienst/urensoort hidden when not selected
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.queryByText('Dienst')).not.toBeInTheDocument()
    expect(screen.queryByText('Urensoort')).not.toBeInTheDocument()
  })

  it('uses a custom title', () => {
    render(<BookingModal title="Custom" onClose={() => {}} />)
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('calls onClose via the X button, Annuleren button and Escape key', () => {
    const onClose = vi.fn()
    render(<BookingModal onClose={onClose} />)
    fireEvent.click(screen.getByText('✕'))
    fireEvent.click(screen.getByText('Annuleren'))
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('ignores non-Escape keys', () => {
    const onClose = vi.fn()
    render(<BookingModal onClose={onClose} />)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('bumps end time when start time is set at or after end time', () => {
    render(<BookingModal onClose={() => {}} />)
    // TimeSelect "Van" is the first combobox
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0]!, { target: { value: '09:30' } })
    expect(setStartTime).toHaveBeenCalledWith('09:30')
    // endTime was 09:30 <= 09:30, so it bumps to 10:00
    expect(setEndTime).toHaveBeenCalledWith('10:00')
  })

  it('does not bump end time when start time is before end time', () => {
    bookingState = makeBooking({ startTime: '09:00', endTime: '11:00' })
    render(<BookingModal onClose={() => {}} />)
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0]!, { target: { value: '09:15' } })
    expect(setStartTime).toHaveBeenCalledWith('09:15')
    expect(setEndTime).not.toHaveBeenCalled()
  })

  it('changes end time directly', () => {
    render(<BookingModal onClose={() => {}} />)
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[1]!, { target: { value: '12:00' } })
    expect(setEndTime).toHaveBeenCalledWith('12:00')
  })

  it('shows dienst and urensoort fields when project/service selected', () => {
    bookingState = makeBooking({
      projectId: 'p1',
      serviceId: 's1',
      hourTypeId: 'ht1',
      projects: [{ id: 'p1', name: 'Proj', organizationName: 'Org' }],
      services: [{ id: 's1', name: 'Svc', hourTypeIds: ['ht1'] }],
      hourTypes: [{ id: 'ht1', label: 'Dev' }],
      starredIds: new Set(['p1']),
      lastStarredId: 'p1',
      missingFields: [],
      canBook: true,
    })
    render(<BookingModal onClose={() => {}} />)
    expect(screen.getByText('Dienst')).toBeInTheDocument()
    expect(screen.getByText('Urensoort')).toBeInTheDocument()
  })

  it('updates the note field', () => {
    render(<BookingModal onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Optioneel'), { target: { value: 'hi' } })
    expect(setNote).toHaveBeenCalledWith('hi')
  })

  it('shows error message when status is error', () => {
    bookingState = makeBooking({ status: 'error', errorMessage: 'Boom!' })
    render(<BookingModal onClose={() => {}} />)
    expect(screen.getByText('Boom!')).toBeInTheDocument()
  })

  it('books via the form button when canBook', () => {
    bookingState = makeBooking({ canBook: true, missingFields: [] })
    render(<BookingModal onClose={() => {}} />)
    // Form has "Boeken →" and footer has "Opslaan"; both call book
    fireEvent.click(screen.getByText('Boeken →'))
    fireEvent.click(screen.getByText('Opslaan'))
    expect(book).toHaveBeenCalledTimes(2)
  })

  it('shows loading labels when booking', () => {
    bookingState = makeBooking({ status: 'loading', canBook: true, missingFields: [] })
    render(<BookingModal onClose={() => {}} />)
    expect(screen.getAllByText('Bezig...').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the evidence two-column layout with confidence badge and date', () => {
    render(<BookingModal evidenceBlock={block} onClose={() => {}} />)
    expect(screen.getByTestId('evidence-panel')).toBeInTheDocument()
    expect(screen.getByText('Block A')).toBeInTheDocument()
    expect(screen.getByText('4/5')).toBeInTheDocument()
    expect(screen.getByText('10:00–11:00')).toBeInTheDocument()
    expect(screen.getByText('1u')).toBeInTheDocument()
  })

  it('renders the Cache badge when origin is cache', () => {
    const cacheBlock = { ...block, origin: 'cache' } as ClassifiedBlock
    render(<BookingModal evidenceBlock={cacheBlock} onClose={() => {}} />)
    expect(screen.getByText('Cache')).toBeInTheDocument()
  })

  it('renders the evidence panel when commits/linearIssues are absent', () => {
    const bare = { ...block }
    delete (bare as { commits?: unknown }).commits
    delete (bare as { linearIssues?: unknown }).linearIssues
    render(<BookingModal evidenceBlock={bare as ClassifiedBlock} onClose={() => {}} />)
    expect(screen.getByTestId('evidence-panel')).toBeInTheDocument()
  })

  it('toggles a project star (unstarred → star icon)', () => {
    bookingState = makeBooking({
      projects: [{ id: 'p1', name: 'Proj', organizationName: 'Org' }],
      starredIds: new Set(),
      lastStarredId: 'p1',
    })
    render(<BookingModal onClose={() => {}} />)
    // Open the Project dropdown (its trigger shows the placeholder)
    fireEvent.click(screen.getByText('Kies...'))
    const star = screen.getByLabelText('Voeg toe aan favorieten')
    expect(star).toHaveTextContent('☆')
    fireEvent.click(star)
    expect(toggleStar).toHaveBeenCalledWith('p1')
  })

  it('renders filled star for an already-starred project', () => {
    bookingState = makeBooking({
      projects: [{ id: 'p1', name: 'Proj', organizationName: 'Org' }],
      starredIds: new Set(['p1']),
    })
    render(<BookingModal onClose={() => {}} />)
    fireEvent.click(screen.getByText('Kies...'))
    expect(screen.getByLabelText('Verwijder uit favorieten')).toHaveTextContent('★')
  })

  describe('delete flow', () => {
    it('does not render delete button without an entry id', () => {
      render(<BookingModal onClose={() => {}} />)
      expect(screen.queryByText('Verwijderen')).not.toBeInTheDocument()
    })

    it('two-step delete: confirm then delete', () => {
      render(<BookingModal initialEntry={{ id: 'e1' }} onClose={() => {}} />)
      const delBtn = screen.getByText('Verwijderen')
      fireEvent.click(delBtn)
      expect(screen.getByText('Zeker weten?')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Zeker weten?'))
      expect(deleteEntry).toHaveBeenCalledWith('e1')
    })

    it('reverts to idle after 3s timeout', () => {
      render(<BookingModal initialEntry={{ id: 'e1' }} onClose={() => {}} />)
      fireEvent.click(screen.getByText('Verwijderen'))
      expect(screen.getByText('Zeker weten?')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.getByText('Verwijderen')).toBeInTheDocument()
    })

    it('shows "Bezig..." on the delete button while loading in confirm state', () => {
      bookingState = makeBooking()
      const { rerender } = render(<BookingModal initialEntry={{ id: 'e1' }} onClose={() => {}} />)
      // Enter confirm state
      fireEvent.click(screen.getByText('Verwijderen'))
      expect(screen.getByText('Zeker weten?')).toBeInTheDocument()
      // Now booking goes to loading → button shows "Bezig..."
      bookingState = makeBooking({ status: 'loading' })
      rerender(<BookingModal initialEntry={{ id: 'e1' }} onClose={() => {}} />)
      // The delete button is the one with the danger-confirm background.
      const busy = screen.getAllByText('Bezig...')
      const delBtn = busy.find((b) => (b as HTMLButtonElement).style.background === 'rgb(180, 83, 9)')
      expect(delBtn).toBeTruthy()
      expect(delBtn).toBeDisabled()
    })
  })

  describe('success states', () => {
    it('shows "Uren geboekt!" and calls onBooked for a new entry', () => {
      const onBooked = vi.fn()
      const onClose = vi.fn()
      bookingState = makeBooking({ status: 'success' })
      render(<BookingModal onClose={onClose} onBooked={onBooked} />)
      expect(screen.getByText('Uren geboekt!')).toBeInTheDocument()
      expect(onBooked).toHaveBeenCalled()
      fireEvent.click(screen.getByText('Sluiten'))
      expect(onClose).toHaveBeenCalled()
    })

    it('shows "Uren bijgewerkt!" for an existing entry', () => {
      bookingState = makeBooking({ status: 'success' })
      render(<BookingModal initialEntry={{ id: 'e1' }} onClose={() => {}} onBooked={() => {}} />)
      expect(screen.getByText('Uren bijgewerkt!')).toBeInTheDocument()
    })

    it('works without onBooked callback', () => {
      bookingState = makeBooking({ status: 'success' })
      render(<BookingModal onClose={() => {}} />)
      expect(screen.getByText('Uren geboekt!')).toBeInTheDocument()
    })

    it('shows "Boeking verwijderd!" and calls onDeleted after a delete action', () => {
      const onDeleted = vi.fn()
      bookingState = makeBooking()
      const { rerender } = render(
        <BookingModal initialEntry={{ id: 'e1' }} onClose={() => {}} onDeleted={onDeleted} />,
      )
      // Two clicks → marks isDeleteActionRef true and invokes deleteEntry
      fireEvent.click(screen.getByText('Verwijderen'))
      fireEvent.click(screen.getByText('Zeker weten?'))
      expect(deleteEntry).toHaveBeenCalledWith('e1')
      // Now the booking transitions to success; re-render reflects it
      bookingState = makeBooking({ status: 'success' })
      rerender(<BookingModal initialEntry={{ id: 'e1' }} onClose={() => {}} onDeleted={onDeleted} />)
      expect(screen.getByText('Boeking verwijderd!')).toBeInTheDocument()
      expect(onDeleted).toHaveBeenCalled()
    })
  })
})
