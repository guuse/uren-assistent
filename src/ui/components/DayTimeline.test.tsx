import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DayTimeline } from './DayTimeline'
import { useAppStore } from '../../store/appStore'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { GitHubCommit } from '../../domain/entities/GitHubCommit'
import type { LinearIssue } from '../../domain/entities/LinearIssue'

function makeEntry(overrides: Partial<HourEntry> = {}): HourEntry {
  return {
    id: 'e1',
    employeeId: 'emp1',
    projectId: 'p1',
    projectServiceId: 's1',
    hourTypeId: 'h1',
    hours: 1,
    startDate: '2026-05-25',
    startTime: '09:00',
    endTime: '10:00',
    note: '',
    ...overrides,
  }
}

function makeConcept(overrides: Record<string, unknown> = {}): ClassifiedBlock {
  return {
    blockName: 'Coding session',
    summary: 'wrote code',
    startTime: '10:00',
    endTime: '11:00',
    projectId: 'p1',
    serviceId: 's1',
    hourTypeId: 'h1',
    confidence: 5,
    origin: 'llm',
    ...overrides,
  } as ClassifiedBlock
}

function baseProps(overrides: Partial<Parameters<typeof DayTimeline>[0]> = {}) {
  return {
    date: '2026-05-25',
    entries: [] as HourEntry[],
    suggestions: [] as HourEntrySuggestion[],
    onBookSuggestion: vi.fn(),
    onEditEntry: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  useAppStore.setState({ projects: [{ id: 'p1', name: 'Project One', organizationName: 'Org' }] })
})

describe('DayTimeline', () => {
  it('renders the date header in Dutch', () => {
    render(<DayTimeline {...baseProps()} />)
    expect(screen.getByText(/maandag 25 mei/)).toBeInTheDocument()
  })

  it('shows empty hint when no entries, concepts or classifying', () => {
    render(<DayTimeline {...baseProps()} />)
    expect(screen.getByText('Verwerk dag')).toBeInTheDocument()
    expect(screen.getByText(/om voorstellen te genereren/)).toBeInTheDocument()
  })

  it('shows classifying spinner', () => {
    render(<DayTimeline {...baseProps({ isClassifying: true })} />)
    expect(screen.getByText('Bezig met classificeren...')).toBeInTheDocument()
  })

  it('renders an entry block and edits on click', () => {
    const onEditEntry = vi.fn()
    const entry = makeEntry({ note: 'a note', startTime: '09:00', endTime: '13:00' })
    render(<DayTimeline {...baseProps({ entries: [entry], onEditEntry })} />)
    expect(screen.getByText('Project One')).toBeInTheDocument()
    expect(screen.getByText(/09:00–13:00/)).toBeInTheDocument()
    // note is shown for tall blocks (4h -> height > 52)
    expect(screen.getByText('a note')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Project One'))
    expect(onEditEntry).toHaveBeenCalledWith(entry)
  })

  it('falls back to projectId when project not found', () => {
    const entry = makeEntry({ projectId: 'unknown-id' })
    render(<DayTimeline {...baseProps({ entries: [entry] })} />)
    expect(screen.getByText('unknown-id')).toBeInTheDocument()
  })

  it('renders concept blocks of all confidence levels', () => {
    const concepts = [
      makeConcept({ blockName: 'High5', confidence: 5, startTime: '08:00', endTime: '09:00' }),
      makeConcept({ blockName: 'High4', confidence: 4, startTime: '09:00', endTime: '10:00' }),
      makeConcept({ blockName: 'Mid3', confidence: 3, startTime: '10:00', endTime: '11:00' }),
      makeConcept({ blockName: 'Low2', confidence: 2, startTime: '11:00', endTime: '12:00' }),
      makeConcept({ blockName: 'Low1', confidence: 1, startTime: '12:00', endTime: '13:00' }),
    ]
    render(<DayTimeline {...baseProps({ conceptBlocks: concepts })} />)
    expect(screen.getByText('High5')).toBeInTheDocument()
    expect(screen.getByText('Mid3')).toBeInTheDocument()
    expect(screen.getByText('Low1')).toBeInTheDocument()
  })

  it('shows cache badge for cache-origin concepts', () => {
    const concept = makeConcept({ origin: 'cache', blockName: 'Cached' })
    render(<DayTimeline {...baseProps({ conceptBlocks: [concept] })} />)
    expect(screen.getByText('Cache')).toBeInTheDocument()
  })

  it('shows confidence badge for llm-origin concepts', () => {
    const concept = makeConcept({ origin: 'llm', confidence: 3 })
    render(<DayTimeline {...baseProps({ conceptBlocks: [concept] })} />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('renders warning style and missing-project hint for incomplete concepts', () => {
    const concept = makeConcept({
      blockName: 'Incomplete',
      projectId: undefined,
      serviceId: undefined,
      startTime: '09:00',
      endTime: '13:00',
    })
    render(<DayTimeline {...baseProps({ conceptBlocks: [concept] })} />)
    expect(screen.getByText(/Project ontbreekt/)).toBeInTheDocument()
  })

  it('calls onConceptClick when a concept is clicked', () => {
    const onConceptClick = vi.fn()
    const concept = makeConcept()
    render(<DayTimeline {...baseProps({ conceptBlocks: [concept], onConceptClick })} />)
    fireEvent.click(screen.getByText('Coding session'))
    expect(onConceptClick).toHaveBeenCalledWith(concept)
  })

  it('shows concept header summary with pending count (plural)', () => {
    const concepts = [
      makeConcept({ blockName: 'A', projectId: undefined, serviceId: undefined, startTime: '08:00', endTime: '09:00' }),
      makeConcept({ blockName: 'B', projectId: undefined, serviceId: undefined, startTime: '09:00', endTime: '10:00' }),
    ]
    render(<DayTimeline {...baseProps({ conceptBlocks: concepts })} />)
    expect(screen.getByText(/2 concepten te bevestigen/)).toBeInTheDocument()
  })

  it('shows singular pending count', () => {
    const concept = makeConcept({ projectId: undefined, serviceId: undefined })
    render(<DayTimeline {...baseProps({ conceptBlocks: [concept] })} />)
    expect(screen.getByText(/1 concept te bevestigen/)).toBeInTheDocument()
  })

  it('shows "alle concepten compleet" when none pending', () => {
    render(<DayTimeline {...baseProps({ conceptBlocks: [makeConcept()] })} />)
    expect(screen.getByText(/alle concepten compleet/)).toBeInTheDocument()
  })

  // NOTE: gap-suggestion rendering (the inline "+ Boek" buttons in the timeline)
  // is only produced by computeTimelineBlocks, which only runs when there are no
  // entries AND no concepts — but that same condition triggers showEmptyHint,
  // which hides the timeline. See the "unreachable branches" note in the report.

  it('does not edit entries in read-only mode', () => {
    const onEditEntry = vi.fn()
    const entry = makeEntry()
    render(<DayTimeline {...baseProps({ entries: [entry], onEditEntry, readOnly: true })} />)
    fireEvent.click(screen.getByText('Project One'))
    expect(onEditEntry).not.toHaveBeenCalled()
  })

  it('does not fire concept click in read-only mode', () => {
    const onConceptClick = vi.fn()
    render(<DayTimeline {...baseProps({ conceptBlocks: [makeConcept()], onConceptClick, readOnly: true })} />)
    fireEvent.click(screen.getByText('Coding session'))
    expect(onConceptClick).not.toHaveBeenCalled()
  })

  it('shows read-only badge and withdraw-day button', () => {
    const onWithdrawDay = vi.fn()
    render(<DayTimeline {...baseProps({ readOnly: true, onWithdrawDay })} />)
    expect(screen.getByText(/Ingediend · alleen-lezen/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Trek dag in'))
    expect(onWithdrawDay).toHaveBeenCalledOnce()
  })

  it('disables withdraw-day while submitting', () => {
    render(<DayTimeline {...baseProps({ readOnly: true, onWithdrawDay: vi.fn(), isSubmittingDay: true })} />)
    expect(screen.getByText('Bezig…')).toBeDisabled()
  })

  it('renders process-day button and handles click', () => {
    const onProcessDay = vi.fn()
    render(<DayTimeline {...baseProps({ onProcessDay })} />)
    fireEvent.click(screen.getByText('▶ Verwerk dag'))
    expect(onProcessDay).toHaveBeenCalledOnce()
  })

  it('renders submit-day button enabled and handles click', () => {
    const onSubmitDay = vi.fn()
    render(<DayTimeline {...baseProps({ onSubmitDay, canSubmitDay: true })} />)
    fireEvent.click(screen.getByText('Dien dag in'))
    expect(onSubmitDay).toHaveBeenCalledOnce()
  })

  it('disables submit-day for a future day with title hint', () => {
    render(<DayTimeline {...baseProps({ onSubmitDay: vi.fn(), canSubmitDay: false })} />)
    const btn = screen.getByText('Dien dag in')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'Een toekomstige dag kan nog niet ingediend worden')
  })

  it('shows submitting label on submit-day', () => {
    render(<DayTimeline {...baseProps({ onSubmitDay: vi.fn(), isSubmittingDay: true })} />)
    expect(screen.getByText('Indienen…')).toBeInTheDocument()
  })

  it('hides submit-day in read-only mode', () => {
    render(<DayTimeline {...baseProps({ onSubmitDay: vi.fn(), readOnly: true })} />)
    expect(screen.queryByText('Dien dag in')).toBeNull()
  })

  it('shows the "Nieuwe CSV" button when there is content and triggers file input click', () => {
    const entry = makeEntry()
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    render(<DayTimeline {...baseProps({ entries: [entry] })} />)
    fireEvent.click(screen.getByText('↑ Nieuwe CSV'))
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('handles CSV file selection via the hidden input', async () => {
    const onUploadCsv = vi.fn()
    const entry = makeEntry()
    const { container } = render(<DayTimeline {...baseProps({ entries: [entry], onUploadCsv })} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['col1,col2'], 'data.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('col1,col2') })
    fireEvent.change(input, { target: { files: [file] } })
    await Promise.resolve()
    expect(onUploadCsv).toHaveBeenCalledWith('col1,col2')
  })

  it('ignores a change event with no file', () => {
    const onUploadCsv = vi.fn()
    const entry = makeEntry()
    const { container } = render(<DayTimeline {...baseProps({ entries: [entry], onUploadCsv })} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [] } })
    expect(onUploadCsv).not.toHaveBeenCalled()
  })

  it('handles CSV drop on the empty-state hint', async () => {
    const onUploadCsv = vi.fn()
    const { container } = render(<DayTimeline {...baseProps({ onUploadCsv })} />)
    const dropZone = container.querySelector('.flex-1.relative') as HTMLElement
    const file = new File(['x,y'], 'd.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('x,y') })
    fireEvent.dragOver(dropZone)
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })
    await Promise.resolve()
    expect(onUploadCsv).toHaveBeenCalledWith('x,y')
  })

  it('ignores a drop with no file', () => {
    const onUploadCsv = vi.fn()
    const { container } = render(<DayTimeline {...baseProps({ onUploadCsv })} />)
    const dropZone = container.querySelector('.flex-1.relative') as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [] } })
    expect(onUploadCsv).not.toHaveBeenCalled()
  })

  it('renders the evidence panel when commits or issues exist', () => {
    const commits: GitHubCommit[] = [{
      sha: 'abc', message: 'fix bug', repo: 'org/repo', branch: 'main',
      timestamp: '2026-05-25T09:00:00Z', time: '09:00', date: '2026-05-25',
    }]
    const linearIssues: LinearIssue[] = [{
      identifier: 'ENG-1', title: 'Do thing', completedAt: '2026-05-25T10:00:00Z', url: 'https://x',
    }]
    render(<DayTimeline {...baseProps({ commits, linearIssues })} />)
    expect(screen.getByText('Context voor deze dag')).toBeInTheDocument()
  })

  // ─── Drag-to-book ───────────────────────────────────────────────────────────

  function setupDragContainer() {
    const onDragNew = vi.fn()
    const entry = makeEntry({ startTime: '09:00', endTime: '10:00' })
    const { container } = render(
      <DayTimeline {...baseProps({ entries: [entry], onDragNew })} />,
    )
    // The blocks container has onMouseDown and a cursor style.
    const blocksContainer = Array.from(container.querySelectorAll('div')).find(
      (d) => d.style.cursor === 'crosshair',
    ) as HTMLElement
    blocksContainer.getBoundingClientRect = () =>
      ({ top: 0, left: 0, width: 500, height: 800, right: 500, bottom: 800, x: 0, y: 0, toJSON: () => {} }) as DOMRect
    return { onDragNew, blocksContainer }
  }

  it('completes a drag-to-book gesture of sufficient duration', () => {
    const { onDragNew, blocksContainer } = setupDragContainer()
    fireEvent.mouseDown(blocksContainer, { button: 0, clientY: 80 })
    fireEvent.mouseMove(document, { clientY: 240 })
    fireEvent.mouseUp(document)
    expect(onDragNew).toHaveBeenCalled()
    const [start, end] = onDragNew.mock.calls[0]!
    expect(start < end).toBe(true)
  })

  it('shows a drag preview while dragging', () => {
    const { blocksContainer } = setupDragContainer()
    fireEvent.mouseDown(blocksContainer, { button: 0, clientY: 80 })
    fireEvent.mouseMove(document, { clientY: 400 })
    // preview shows duration label "loslaten om te boeken" when tall enough
    expect(screen.getByText(/loslaten om te boeken/)).toBeInTheDocument()
  })

  it('does not book when the drag is too short', () => {
    const { onDragNew, blocksContainer } = setupDragContainer()
    fireEvent.mouseDown(blocksContainer, { button: 0, clientY: 80 })
    // Move only slightly (less than 30 min)
    fireEvent.mouseMove(document, { clientY: 85 })
    fireEvent.mouseUp(document)
    expect(onDragNew).not.toHaveBeenCalled()
  })

  it('cancels the drag on Escape', () => {
    const { onDragNew, blocksContainer } = setupDragContainer()
    fireEvent.mouseDown(blocksContainer, { button: 0, clientY: 80 })
    fireEvent.mouseMove(document, { clientY: 400 })
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseUp(document)
    expect(onDragNew).not.toHaveBeenCalled()
    expect(screen.queryByText(/loslaten om te boeken/)).toBeNull()
  })

  it('ignores non-left-button mousedown', () => {
    const { onDragNew, blocksContainer } = setupDragContainer()
    fireEvent.mouseDown(blocksContainer, { button: 1, clientY: 80 })
    fireEvent.mouseMove(document, { clientY: 400 })
    fireEvent.mouseUp(document)
    expect(onDragNew).not.toHaveBeenCalled()
  })

  it('ignores mousedown originating on a button', () => {
    const { onDragNew, blocksContainer } = setupDragContainer()
    const button = blocksContainer.querySelector('button') as HTMLElement
    fireEvent.mouseDown(button, { button: 0, clientY: 80 })
    fireEvent.mouseUp(document)
    expect(onDragNew).not.toHaveBeenCalled()
  })

  it('does not start a drag when onDragNew is not provided', () => {
    const entry = makeEntry()
    const { container } = render(<DayTimeline {...baseProps({ entries: [entry] })} />)
    // With no onDragNew, no container has a crosshair cursor.
    const crosshair = Array.from(container.querySelectorAll('div')).find(
      (d) => d.style.cursor === 'crosshair',
    )
    expect(crosshair).toBeUndefined()
    // Firing mousedown on the timeline container is a no-op.
    const blocksContainer = container.querySelector('.flex-1.relative') as HTMLElement
    fireEvent.mouseDown(blocksContainer, { button: 0, clientY: 80 })
    expect(screen.queryByText(/loslaten om te boeken/)).toBeNull()
  })

  it('renders a full (green) progress bar when the day is complete', () => {
    const entry = makeEntry({ startTime: '08:00', endTime: '16:00', hours: 8 })
    const { container } = render(<DayTimeline {...baseProps({ entries: [entry] })} />)
    expect(container.querySelector('.bg-green-500')).toBeTruthy()
    expect(screen.getByText(/8u geboekt · 0u te gaan/)).toBeInTheDocument()
  })

  it('renders an amber progress bar for a partial day', () => {
    const entry = makeEntry({ hours: 2 })
    const { container } = render(<DayTimeline {...baseProps({ entries: [entry] })} />)
    expect(container.querySelector('.bg-amber-500')).toBeTruthy()
  })

  it('renders an empty (indigo) progress bar with zero hours', () => {
    const concept = makeConcept()
    const { container } = render(<DayTimeline {...baseProps({ conceptBlocks: [concept] })} />)
    expect(container.querySelector('.bg-\\[\\#c7d2fe\\]')).toBeTruthy()
  })

  it('moves preview but ignores move events when not actively dragging', () => {
    const { blocksContainer } = setupDragContainer()
    // mouse move without mousedown should be ignored
    fireEvent.mouseMove(document, { clientY: 400 })
    expect(screen.queryByText(/loslaten om te boeken/)).toBeNull()
    // mouseup without active drag is a no-op
    fireEvent.mouseUp(document)
    expect(blocksContainer).toBeTruthy()
  })
})
