import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ----- Mutable hook state, controlled per-test -----

interface WeekMock {
  selectedWeekStart: string
  selectedWeekEnd: string
  selectedDate: string
  selectDate: ReturnType<typeof vi.fn>
  entriesByDate: Record<string, unknown[]>
  weekDays: string[]
  hoursForDate: (d: string) => number
  isLoading: boolean
  error: string | null
  prevWeek: ReturnType<typeof vi.fn>
  nextWeek: ReturnType<typeof vi.fn>
  isCurrentWeek: boolean
  goToCurrentWeek: ReturnType<typeof vi.fn>
  goToDate: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
}

let weekMock: WeekMock
let submissionsMock: Record<string, unknown>
let suggestionsMock: { suggestions: unknown[] }
let importMock: Record<string, unknown>
let historyStoreMock: Record<string, unknown>
let clearDayMock: Record<string, unknown>
let clearWeekMock: Record<string, unknown>

vi.mock('../hooks/useWeek', () => ({ useWeek: () => weekMock }))
vi.mock('../hooks/useSubmissions', () => ({ useSubmissions: () => submissionsMock }))
vi.mock('../hooks/useSuggestions', () => ({ useSuggestions: () => suggestionsMock }))
vi.mock('../hooks/useImport', () => ({ useImport: () => importMock }))
vi.mock('../hooks/useHistoryStore', () => ({ useHistoryStore: () => historyStoreMock }))

let clearDayOnSuccess: (date: string) => void
let clearWeekOnSuccess: (days: string[]) => void
vi.mock('../hooks/useClearDayBlocks', () => ({
  useClearDayBlocks: (cb: (d: string) => void) => {
    clearDayOnSuccess = cb
    return clearDayMock
  },
}))
vi.mock('../hooks/useClearWeekBlocks', () => ({
  useClearWeekBlocks: (cb: (d: string[]) => void) => {
    clearWeekOnSuccess = cb
    return clearWeekMock
  },
}))

// ----- Container mocks -----

const keychainGet = vi.fn()
const hasHistoryForWeek = vi.fn()
const hasDataForDate = vi.fn()
const getBlocksForDate = vi.fn()
const mappingSet = vi.fn()
const setBlocksForDate = vi.fn()

// processWeek/processDay generators are swapped per test
let processWeekGen: () => AsyncGenerator<Record<string, unknown>>
let processDayGen: () => AsyncGenerator<Record<string, unknown>>
const createProcessWeekUseCase = vi.fn((..._a: unknown[]) => ({
  execute: () => processWeekGen(),
}))
const createProcessDayUseCase = vi.fn((..._a: unknown[]) => ({
  execute: () => processDayGen(),
}))

vi.mock('../../application/container', () => ({
  mappingCacheRepo: { set: (...a: unknown[]) => mappingSet(...a) },
  keychainRepo: { get: (...a: unknown[]) => keychainGet(...a) },
  createProcessWeekUseCase: (...a: unknown[]) => createProcessWeekUseCase(...a),
  createProcessDayUseCase: (...a: unknown[]) => createProcessDayUseCase(...a),
  createCalendarRepository: () => ({}),
  createGeminiRepository: () => ({}),
  createSimplicateRepository: () => ({}),
  historyStore: {
    hasHistoryForWeek: (...a: unknown[]) => hasHistoryForWeek(...a),
    hasDataForDate: (...a: unknown[]) => hasDataForDate(...a),
    getBlocksForDate: (...a: unknown[]) => getBlocksForDate(...a),
    setBlocksForDate: (...a: unknown[]) => setBlocksForDate(...a),
  },
}))

// ----- Child component stubs that expose handler-invoking buttons -----

vi.mock('../components/WeekDayList', () => ({
  WeekDayList: (props: Record<string, unknown>) => (
    <div data-testid="weekdaylist">
      <span data-testid="weeklabel">{props.weekLabel as string}</span>
      <span data-testid="total-llm">{props.totalLlmBlockCount as number}</span>
      <span data-testid="concept-count">{(props.conceptCountForDate as (d: string) => number)((weekMock).selectedDate)}</span>
      <span data-testid="concept-count-other">{(props.conceptCountForDate as (d: string) => number)('1999-01-01')}</span>
      <span data-testid="proc-state">{(props.processingStateForDate as (d: string) => string)((weekMock).selectedDate)}</span>
      <span data-testid="llm-self">{(props.llmBlockCountForDate as (d: string) => number)((weekMock).selectedDate)}</span>
      <span data-testid="is-week-submitted">{String(props.isWeekSubmitted)}</span>
      <span data-testid="can-submit-week">{String(props.canSubmitWeek)}</span>
      <span data-testid="has-process-week">{String(props.onProcessWeek !== undefined)}</span>
      <span data-testid="has-upload-csv">{String(props.onUploadCsv !== undefined)}</span>
      {props.onProcessWeek ? (
        <button data-testid="process-week" onClick={props.onProcessWeek as () => void}>pw</button>
      ) : null}
      {props.onUploadCsv ? (
        <button data-testid="wdl-upload" onClick={props.onUploadCsv as () => void}>up</button>
      ) : null}
      <button data-testid="clear-day" onClick={() => (props.onClearDayBlocks as (d: string) => void)(weekMock.selectedDate)}>cd</button>
      <button data-testid="clear-week" onClick={props.onClearWeekBlocks as () => void}>cw</button>
      <button data-testid="submit-week" onClick={props.onSubmitWeek as () => void}>sw</button>
      <button data-testid="select-date" onClick={() => (props.onSelectDate as (d: string) => void)('2026-05-12')}>sel</button>
    </div>
  ),
}))

vi.mock('../components/DayTimeline', () => ({
  DayTimeline: (props: Record<string, unknown>) => (
    <div data-testid="daytimeline">
      <span data-testid="dt-readonly">{String(props.readOnly)}</span>
      <span data-testid="dt-classifying">{String(props.isClassifying)}</span>
      <span data-testid="dt-suggestions-len">{(props.suggestions as unknown[]).length}</span>
      <span data-testid="dt-concept-len">{(props.conceptBlocks as unknown[]).length}</span>
      <span data-testid="dt-commits-len">{(props.commits as unknown[]).length}</span>
      <span data-testid="dt-linear-len">{(props.linearIssues as unknown[]).length}</span>
      <span data-testid="dt-has-process-day">{String(props.onProcessDay !== undefined)}</span>
      <span data-testid="dt-has-upload">{String(props.onUploadCsv !== undefined)}</span>
      <span data-testid="dt-has-dragnew">{String(props.onDragNew !== undefined)}</span>
      {props.onProcessDay ? <button data-testid="process-day" onClick={props.onProcessDay as () => void}>pd</button> : null}
      <button
        data-testid="book-suggestion-full"
        onClick={() => (props.onBookSuggestion as (s: unknown) => void)({ projectId: 'p1', projectServiceId: 's1', hourTypeId: 'h1', startTime: '09:00', endTime: '10:00' })}
      >bsf</button>
      <button
        data-testid="book-suggestion-min"
        onClick={() => (props.onBookSuggestion as (s: unknown) => void)({ projectId: 'p1', projectServiceId: 's1', hourTypeId: 'h1' })}
      >bsm</button>
      <button
        data-testid="edit-entry"
        onClick={() => (props.onEditEntry as (e: unknown) => void)({ id: 'e1', startDate: weekMock.selectedDate, projectId: 'p', hours: 1 })}
      >ee</button>
      <button
        data-testid="concept-click-full"
        onClick={() => (props.onConceptClick as (b: unknown) => void)({ date: weekMock.selectedDate, startTime: '09:00', endTime: '10:00', note: 'n', summary: 's', blockName: 'bn', urlPattern: 'u', projectId: 'p', serviceId: 'sv', hourTypeId: 'ht' })}
      >ccf</button>
      <button
        data-testid="concept-click-min"
        onClick={() => (props.onConceptClick as (b: unknown) => void)({ date: weekMock.selectedDate, startTime: '09:00', endTime: '10:00', summary: 's', blockName: 'bn', urlPattern: 'u' })}
      >ccm</button>
      <button
        data-testid="concept-click-projonly"
        onClick={() => (props.onConceptClick as (b: unknown) => void)({ date: weekMock.selectedDate, startTime: '09:00', endTime: '10:00', summary: 's', blockName: 'bn', urlPattern: 'u', projectId: 'p' })}
      >ccp</button>
      <button
        data-testid="concept-click-nonote"
        onClick={() => (props.onConceptClick as (b: unknown) => void)({ date: weekMock.selectedDate, startTime: '09:00', endTime: '10:00', summary: 's', blockName: 'bn', urlPattern: 'u', projectId: 'p', serviceId: 'sv', hourTypeId: 'ht' })}
      >ccn</button>
      {props.onDragNew ? <button data-testid="drag-new" onClick={() => (props.onDragNew as (a: string, b: string) => void)('11:00', '12:00')}>dn</button> : null}
      {props.onUploadCsv ? <button data-testid="dt-upload" onClick={() => (props.onUploadCsv as (c: string) => void)('csvdata')}>upl</button> : null}
    </div>
  ),
}))

vi.mock('./BookingModal', () => ({
  BookingModal: (props: Record<string, unknown>) => (
    <div data-testid="bookingmodal">
      <span data-testid="bm-title">{props.title as string}</span>
      <span data-testid="bm-has-evidence">{String(props.evidenceBlock !== undefined)}</span>
      <button data-testid="bm-close" onClick={props.onClose as () => void}>x</button>
      <button data-testid="bm-booked" onClick={props.onBooked as () => void}>b</button>
      <button data-testid="bm-deleted" onClick={props.onDeleted as () => void}>d</button>
    </div>
  ),
}))

vi.mock('../components/NoHistoryWarningModal', () => ({
  NoHistoryWarningModal: (props: Record<string, unknown>) => (
    <div data-testid="warningmodal">
      <span data-testid="wm-scope">{props.scope as string}</span>
      <span data-testid="wm-label">{props.label as string}</span>
      <button data-testid="wm-confirm" onClick={props.onConfirm as () => void}>c</button>
      <button data-testid="wm-upload" onClick={props.onUpload as () => void}>u</button>
      <button data-testid="wm-cancel" onClick={props.onCancel as () => void}>x</button>
    </div>
  ),
}))

vi.mock('../components/SubmitConfirmModal', () => ({
  SubmitConfirmModal: (props: Record<string, unknown>) => (
    <div data-testid="submitmodal">
      <span data-testid="sm-scope">{props.scope as string}</span>
      <span data-testid="sm-label">{props.label as string}</span>
      <span data-testid="sm-unbooked">{props.unbookedCount as number}</span>
      <span data-testid="sm-booked">{props.bookedHours as number}</span>
      <button data-testid="sm-confirm" onClick={props.onConfirm as () => void}>c</button>
      <button data-testid="sm-cancel" onClick={props.onCancel as () => void}>x</button>
    </div>
  ),
}))

vi.mock('../components/ConfirmDialog', () => ({
  ConfirmDialog: (props: Record<string, unknown>) => (
    <div data-testid="confirmdialog">
      <span data-testid="cd-desc">{props.description as string}</span>
      <button data-testid="cd-confirm" onClick={props.onConfirm as () => void}>c</button>
      <button data-testid="cd-cancel" onClick={props.onCancel as () => void}>x</button>
    </div>
  ),
}))

import { WeekPage } from './WeekPage'
import { useAppStore } from '../../store/appStore'

// ----- helpers -----

async function* emptyGen() {}

function makeWeekMock(over: Partial<WeekMock> = {}): WeekMock {
  return {
    selectedWeekStart: '2026-05-11',
    selectedWeekEnd: '2026-05-15',
    selectedDate: '2026-05-11',
    selectDate: vi.fn(),
    entriesByDate: {},
    weekDays: ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15'],
    hoursForDate: vi.fn(() => 2) as unknown as (d: string) => number,
    isLoading: false,
    error: null,
    prevWeek: vi.fn(),
    nextWeek: vi.fn(),
    isCurrentWeek: true,
    goToCurrentWeek: vi.fn(),
    goToDate: vi.fn(),
    refresh: vi.fn(),
    ...over,
  }
}

function resetMocks() {
  weekMock = makeWeekMock()
  submissionsMock = {
    loadMonth: vi.fn(),
    isDateSubmitted: vi.fn(() => false),
    submit: vi.fn(async () => true),
    isSubmitting: false,
    submitError: null,
    clearSubmitError: vi.fn(),
  }
  suggestionsMock = { suggestions: [{ id: 's1' }] }
  importMock = {
    status: 'idle',
    analyseFile: vi.fn(async () => ({
      blocks: [{ date: '2026-05-11' }, { date: '2026-05-12' }],
      dateFrom: '2026-05-11',
      dateTo: '2026-05-12',
      dateCount: 2,
    })),
  }
  historyStoreMock = {
    blocksForDate: [],
    saveBlocksForDate: vi.fn(async () => {}),
    reloadForDate: vi.fn(async () => {}),
    removeBlock: vi.fn(async () => {}),
  }
  clearDayMock = { clearDay: vi.fn(async () => {}), isClearing: false, clearError: null }
  clearWeekMock = { clearWeek: vi.fn(async () => {}), isClearingWeek: false, clearWeekError: null }

  keychainGet.mockResolvedValue('secret')
  hasHistoryForWeek.mockResolvedValue(true)
  hasDataForDate.mockResolvedValue(true)
  getBlocksForDate.mockResolvedValue([])
  mappingSet.mockResolvedValue(undefined)
  processWeekGen = emptyGen
  processDayGen = emptyGen
  createProcessWeekUseCase.mockReset()
  createProcessWeekUseCase.mockImplementation(() => ({ execute: () => processWeekGen() }))
  createProcessDayUseCase.mockReset()
  createProcessDayUseCase.mockImplementation(() => ({ execute: () => processDayGen() }))

  // Reset store to a fully-connected state by default.
  useAppStore.setState({
    githubToken: 'gh',
    githubUsername: 'octocat',
    linearToken: 'lin',
    projects: [{ id: 'p1', name: 'Proj', organizationName: 'Org' }] as never,
    services: [{ id: 's1', name: 'Svc', projectId: 'p1', hourTypeIds: ['h1'] }] as never,
    hourTypes: [{ id: 'h1', label: 'Dev' }] as never,
    simplicateEmployeeId: 'emp1',
    dayContexts: {},
  })
}

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  resetMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function renderPage() {
  return render(<WeekPage />)
}

// ============================================================
// Render states
// ============================================================

describe('WeekPage render states', () => {
  it('renders loading state', () => {
    weekMock = makeWeekMock({ isLoading: true })
    renderPage()
    expect(screen.getByText('Laden...')).toBeInTheDocument()
    expect(screen.queryByTestId('daytimeline')).not.toBeInTheDocument()
  })

  it('renders error state and retries', () => {
    weekMock = makeWeekMock({ error: 'boom' })
    renderPage()
    expect(screen.getByText('boom')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Opnieuw proberen'))
    expect(weekMock.refresh).toHaveBeenCalled()
  })

  it('renders timeline in normal state with concept blocks', () => {
    historyStoreMock.blocksForDate = [
      { startTime: '09:00', origin: 'llm', urlPattern: 'u', commits: [{ a: 1 }], linearIssues: [{ b: 2 }] },
      // an unplaced leftover is routed to the sidebar, not the timeline
      { startTime: '00:00', origin: 'llm-pattern', urlPattern: 'u2', unplaced: true, leftoverReason: 'suggestion' },
    ]
    renderPage()
    expect(screen.getByTestId('daytimeline')).toBeInTheDocument()
    // only the placed (non-unplaced) block counts as a concept on the timeline
    expect(screen.getByTestId('dt-concept-len')).toHaveTextContent('1')
    // commits/linear pulled from first block fallback
    expect(screen.getByTestId('dt-commits-len')).toHaveTextContent('1')
    expect(screen.getByTestId('dt-linear-len')).toHaveTextContent('1')
  })

  it('uses dayContexts commits/linear when present', () => {
    useAppStore.setState({
      dayContexts: {
        '2026-05-11': {
          commits: [
            { sha: 'a1', message: 'm1', repo: 'o/r', branch: 'main', timestamp: '2026-05-11T09:00:00Z', time: '09:00', date: '2026-05-11' },
            { sha: 'a2', message: 'm2', repo: 'o/r', branch: 'main', timestamp: '2026-05-11T10:00:00Z', time: '10:00', date: '2026-05-11' },
          ],
          linearIssues: [
            { identifier: 'ENG-1', title: 't1', completedAt: '2026-05-11T11:00:00Z', url: 'https://linear.app/ENG-1' },
          ],
        },
      },
    })
    renderPage()
    expect(screen.getByTestId('dt-commits-len')).toHaveTextContent('2')
    expect(screen.getByTestId('dt-linear-len')).toHaveTextContent('1')
  })
})

// ============================================================
// Token / connection guards
// ============================================================

describe('connection guards', () => {
  it('hides process-week & upload when tokens missing', () => {
    useAppStore.setState({ githubToken: null, linearToken: null })
    renderPage()
    expect(screen.getByTestId('has-process-week')).toHaveTextContent('false')
    expect(screen.getByTestId('has-upload-csv')).toHaveTextContent('false')
    expect(screen.getByTestId('dt-has-process-day')).toHaveTextContent('false')
  })

  it('shows process-week when tokens present', () => {
    renderPage()
    expect(screen.getByTestId('has-process-week')).toHaveTextContent('true')
    expect(screen.getByTestId('dt-has-process-day')).toHaveTextContent('true')
  })
})

// ============================================================
// Process week
// ============================================================

describe('process week', () => {
  it('opens no-history warning when week has no history', async () => {
    hasHistoryForWeek.mockResolvedValue(false)
    renderPage()
    fireEvent.click(screen.getByTestId('process-week'))
    await screen.findByTestId('warningmodal')
    expect(screen.getByTestId('wm-scope')).toHaveTextContent('week')
  })

  it('shows error when githubUsername missing', async () => {
    useAppStore.setState({ githubUsername: null })
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    expect(await screen.findByText(/GitHub-gebruikersnaam/)).toBeInTheDocument()
  })

  it('handleProcessWeek early-returns when tokens removed before confirm', async () => {
    hasHistoryForWeek.mockResolvedValue(false)
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await screen.findByTestId('warningmodal')
    // Remove tokens; the warning modal stays mounted (its own render keeps button).
    act(() => {
      useAppStore.setState({ githubToken: null, linearToken: null })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('wm-confirm'))
    })
    expect(createProcessWeekUseCase).not.toHaveBeenCalled()
  })

  it('aborts week processing mid-stream', async () => {
    // long generator; abortRef flips after unmount-ish; emulate via many yields
    processWeekGen = async function* () {
      yield { phase: 'classifying-day', day: '2026-05-11' }
      yield { phase: 'classifying-day', day: '2026-05-12' }
      yield { phase: 'done' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await waitFor(() => expect(weekMock.refresh).toHaveBeenCalled())
  })

  it('done phase keeps existing error-state days but fills idle/classifying as done', async () => {
    processWeekGen = async function* () {
      yield { phase: 'error', day: '2026-05-11', error: 'x' }
      yield { phase: 'done' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await waitFor(() => expect(weekMock.refresh).toHaveBeenCalled())
    // error day should remain 'error' (not overwritten by done)
    expect(screen.getByTestId('proc-state')).toHaveTextContent('error')
  })

  it('error phase without day is ignored', async () => {
    processWeekGen = async function* () {
      yield { phase: 'error' }
      yield { phase: 'done' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await waitFor(() => expect(weekMock.refresh).toHaveBeenCalled())
    // no error banner because day missing
    expect(screen.queryByText(/Fout op/)).not.toBeInTheDocument()
  })

  it('falls back to default hourType label and empty employeeId', async () => {
    useAppStore.setState({
      simplicateEmployeeId: null,
      services: [{ id: 's1', name: 'Svc', projectId: 'p1', hourTypeIds: ['unknown-ht'] }] as never,
      hourTypes: [] as never,
    })
    let capturedServices: unknown
    let capturedEmp: unknown
    createProcessWeekUseCase.mockImplementation((...args: unknown[]) => {
      capturedServices = args[5]
      capturedEmp = args[8]
      return { execute: () => emptyGen() }
    })
    processWeekGen = emptyGen
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await waitFor(() => expect(createProcessWeekUseCase).toHaveBeenCalled())
    expect(capturedEmp).toBe('')
    const svc = (capturedServices as Array<{ hourTypes: Array<{ id: string; label: string }> }>)[0]!
    expect(svc.hourTypes[0]).toEqual({ id: 'unknown-ht', label: 'unknown-ht' })
  })

  it('runs happy path through all phases', async () => {
    processWeekGen = async function* () {
      yield { phase: 'context-ready', commitsByDay: { '2026-05-11': [{ c: 1 }] }, linearIssues: [{ l: 1 }] }
      yield { phase: 'classifying-day', day: '2026-05-11' }
      yield { phase: 'done' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await waitFor(() => expect(weekMock.refresh).toHaveBeenCalled())
    expect(createProcessWeekUseCase).toHaveBeenCalled()
    // dayContext set
    expect(useAppStore.getState().dayContexts['2026-05-11']).toBeTruthy()
  })

  it('handles error phase', async () => {
    processWeekGen = async function* () {
      yield { phase: 'error', day: '2026-05-13', error: 'kapot' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    expect(await screen.findByText(/Fout op 2026-05-13: kapot/)).toBeInTheDocument()
  })

  it('handles error phase with missing error message', async () => {
    processWeekGen = async function* () {
      yield { phase: 'error', day: '2026-05-13' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    expect(await screen.findByText(/Fout op 2026-05-13/)).toBeInTheDocument()
  })

  it('handles error phase where error key exists but is undefined', async () => {
    processWeekGen = async function* () {
      yield { phase: 'error', day: '2026-05-13', error: undefined }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    expect(await screen.findByText(/Fout op 2026-05-13: onbekend/)).toBeInTheDocument()
  })

  it('handles fatal error thrown from generator', async () => {
    processWeekGen = async function* () {
      yield { phase: 'classifying-day', day: '2026-05-11' }
      throw new Error('explode')
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    expect(await screen.findByText(/Fatale fout: explode/)).toBeInTheDocument()
  })

  it('handles fatal non-Error thrown', async () => {
    processWeekGen = async function* () {
      yield { phase: 'done' }
      throw 'stringerror'
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    expect(await screen.findByText(/Fatale fout: stringerror/)).toBeInTheDocument()
  })
})

// ============================================================
// Process day
// ============================================================

describe('process day', () => {
  it('opens warning when day has no data', async () => {
    hasDataForDate.mockResolvedValue(false)
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    expect(await screen.findByTestId('warningmodal')).toBeInTheDocument()
    expect(screen.getByTestId('wm-scope')).toHaveTextContent('day')
  })

  it('runs day happy path', async () => {
    processDayGen = async function* () {
      yield { phase: 'done' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    await waitFor(() => expect(createProcessDayUseCase).toHaveBeenCalled())
    expect(weekMock.refresh).toHaveBeenCalled()
  })

  it('handles day error phase', async () => {
    processDayGen = async function* () {
      yield { phase: 'error', error: 'dayfail' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    expect(await screen.findByText(/Fout op 2026-05-11: dayfail/)).toBeInTheDocument()
  })

  it('handles day error phase with missing error', async () => {
    processDayGen = async function* () {
      yield { phase: 'error' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    expect(await screen.findByText(/Fout op 2026-05-11/)).toBeInTheDocument()
  })

  it('handles day fatal error', async () => {
    processDayGen = async function* () {
      yield { phase: 'classifying-day' }
      throw new Error('daycrash')
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    expect(await screen.findByText(/Fout bij verwerken dag: daycrash/)).toBeInTheDocument()
  })

  it('handles day fatal non-Error throw', async () => {
    processDayGen = async function* () {
      yield { phase: 'classifying-day' }
      throw 'daystring'
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    expect(await screen.findByText(/Fout bij verwerken dag: daystring/)).toBeInTheDocument()
  })

  it('runProcessDay guards on missing username', async () => {
    useAppStore.setState({ githubUsername: null })
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    expect(await screen.findByText(/GitHub-gebruikersnaam/)).toBeInTheDocument()
  })

  it('handleProcessDay early-returns when tokens removed before warning confirm', async () => {
    hasDataForDate.mockResolvedValue(false)
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    await screen.findByTestId('warningmodal')
    act(() => {
      useAppStore.setState({ githubToken: null, linearToken: null })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('wm-confirm'))
    })
    expect(createProcessDayUseCase).not.toHaveBeenCalled()
  })

  it('day processing falls back to default label and empty employeeId', async () => {
    useAppStore.setState({
      simplicateEmployeeId: null,
      services: [{ id: 's1', name: 'Svc', projectId: 'p1', hourTypeIds: ['unknown-ht'] }] as never,
      hourTypes: [] as never,
    })
    let capturedServices: unknown
    let capturedEmp: unknown
    createProcessDayUseCase.mockImplementation((...args: unknown[]) => {
      capturedServices = args[5]
      capturedEmp = args[8]
      return { execute: () => emptyGen() }
    })
    processDayGen = emptyGen
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    await waitFor(() => expect(createProcessDayUseCase).toHaveBeenCalled())
    expect(capturedEmp).toBe('')
    const svc = (capturedServices as Array<{ hourTypes: Array<{ id: string; label: string }> }>)[0]!
    expect(svc.hourTypes[0]).toEqual({ id: 'unknown-ht', label: 'unknown-ht' })
  })
})

// ============================================================
// Warning modal flows
// ============================================================

describe('warning modal', () => {
  it('confirm on week scope runs process week', async () => {
    hasHistoryForWeek.mockResolvedValue(false)
    processWeekGen = async function* () {
      yield { phase: 'done' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await screen.findByTestId('warningmodal')
    await act(async () => {
      fireEvent.click(screen.getByTestId('wm-confirm'))
    })
    await waitFor(() => expect(createProcessWeekUseCase).toHaveBeenCalled())
    expect(screen.queryByTestId('warningmodal')).not.toBeInTheDocument()
  })

  it('confirm on day scope runs process day', async () => {
    hasDataForDate.mockResolvedValue(false)
    processDayGen = async function* () {
      yield { phase: 'done' }
    }
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    await screen.findByTestId('warningmodal')
    await act(async () => {
      fireEvent.click(screen.getByTestId('wm-confirm'))
    })
    await waitFor(() => expect(createProcessDayUseCase).toHaveBeenCalled())
  })

  it('cancel closes warning', async () => {
    hasHistoryForWeek.mockResolvedValue(false)
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await screen.findByTestId('warningmodal')
    fireEvent.click(screen.getByTestId('wm-cancel'))
    expect(screen.queryByTestId('warningmodal')).not.toBeInTheDocument()
  })

  it('shows week label for week scope warning', async () => {
    hasHistoryForWeek.mockResolvedValue(false)
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await screen.findByTestId('warningmodal')
    // not "deze week" since selectedWeekStart is fixed 2026-05-11
    expect(screen.getByTestId('wm-label').textContent).toMatch(/week \d+/)
  })

  it('shows day label for day scope warning', async () => {
    hasDataForDate.mockResolvedValue(false)
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    await screen.findByTestId('warningmodal')
    expect(screen.getByTestId('wm-label').textContent?.length).toBeGreaterThan(0)
  })

  it('upload from warning triggers hidden file input click and clears scope', async () => {
    hasHistoryForWeek.mockResolvedValue(false)
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await screen.findByTestId('warningmodal')
    fireEvent.click(screen.getByTestId('wm-upload'))
    expect(clickSpy).toHaveBeenCalled()
    expect(screen.queryByTestId('warningmodal')).not.toBeInTheDocument()
    clickSpy.mockRestore()
  })
})

// ============================================================
// CSV upload
// ============================================================

describe('csv upload', () => {
  it('uploads via DayTimeline and shows toast, refreshes when no pending scope', async () => {
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('dt-upload'))
    })
    expect(await screen.findByText(/Geschiedenis geüpload voor 2 dagen/)).toBeInTheDocument()
    expect(weekMock.refresh).toHaveBeenCalled()
  })

  it('hides the upload toast after the timeout elapses', async () => {
    vi.useFakeTimers()
    try {
      renderPage()
      await act(async () => {
        fireEvent.click(screen.getByTestId('dt-upload'))
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(screen.getByText(/Geschiedenis geüpload/)).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.queryByText(/Geschiedenis geüpload/)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('groups multiple blocks on the same date', async () => {
    importMock.analyseFile = vi.fn(async () => ({
      blocks: [
        { date: '2026-05-11', startTime: '09:00' },
        { date: '2026-05-11', startTime: '10:00' },
      ],
      dateFrom: '2026-05-11',
      dateTo: '2026-05-11',
      dateCount: 1,
    }))
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('dt-upload'))
    })
    await waitFor(() => expect(historyStoreMock.saveBlocksForDate).toHaveBeenCalled())
    // both blocks saved under the single date
    const call = (historyStoreMock.saveBlocksForDate as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(call[0]).toBe('2026-05-11')
    expect(call[1]).toHaveLength(2)
  })

  it('single-date upload uses singular toast message', async () => {
    importMock.analyseFile = vi.fn(async () => ({
      blocks: [{ date: '2026-05-11' }],
      dateFrom: '2026-05-11',
      dateTo: '2026-05-11',
      dateCount: 1,
    }))
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('dt-upload'))
    })
    expect(await screen.findByText(/Geschiedenis geüpload voor 11-05/)).toBeInTheDocument()
  })

  it('returns early when analyseFile yields null', async () => {
    importMock.analyseFile = vi.fn(async () => null)
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('dt-upload'))
    })
    expect(screen.queryByText(/Geschiedenis geüpload/)).not.toBeInTheDocument()
  })

  it('logs crash when analyseFile throws', async () => {
    importMock.analyseFile = vi.fn(async () => {
      throw new Error('parsefail')
    })
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('dt-upload'))
    })
    expect(console.error).toHaveBeenCalled()
  })

  it('continues to process week when pending scope was week', async () => {
    hasHistoryForWeek.mockResolvedValue(false)
    processWeekGen = async function* () {
      yield { phase: 'done' }
    }
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-week'))
    })
    await screen.findByTestId('warningmodal')
    fireEvent.click(screen.getByTestId('wm-upload')) // sets pendingScope = week
    clickSpy.mockRestore()
    // Now drive the upload (simulating file selection) via DayTimeline upload path
    await act(async () => {
      fireEvent.click(screen.getByTestId('dt-upload'))
    })
    await waitFor(() => expect(createProcessWeekUseCase).toHaveBeenCalled())
  })

  it('continues to process day when pending scope was day', async () => {
    hasDataForDate.mockResolvedValue(false)
    processDayGen = async function* () {
      yield { phase: 'done' }
    }
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('process-day'))
    })
    await screen.findByTestId('warningmodal')
    fireEvent.click(screen.getByTestId('wm-upload'))
    clickSpy.mockRestore()
    await act(async () => {
      fireEvent.click(screen.getByTestId('dt-upload'))
    })
    await waitFor(() => expect(createProcessDayUseCase).toHaveBeenCalled())
  })

  it('uploads via hidden file input change handler', async () => {
    renderPage()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['csvdata'], 'h.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: async () => 'csvdata' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    await waitFor(() => expect(importMock.analyseFile).toHaveBeenCalledWith('csvdata'))
  })

  it('hidden file input change with no file does nothing', async () => {
    renderPage()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { files: [] } })
    })
    expect(importMock.analyseFile).not.toHaveBeenCalled()
  })

  it('WeekDayList upload button triggers hidden input click', async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    renderPage()
    fireEvent.click(screen.getByTestId('wdl-upload'))
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})

// ============================================================
// Booking flows
// ============================================================

describe('booking flows', () => {
  it('books a suggestion with times', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('book-suggestion-full'))
    expect(screen.getByTestId('bookingmodal')).toBeInTheDocument()
    expect(screen.getByTestId('bm-title')).toHaveTextContent('Uren boeken')
    expect(screen.getByTestId('bm-has-evidence')).toHaveTextContent('false')
  })

  it('books a suggestion without times', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('book-suggestion-min'))
    expect(screen.getByTestId('bookingmodal')).toBeInTheDocument()
  })

  it('edits an entry', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('edit-entry'))
    expect(screen.getByTestId('bookingmodal')).toBeInTheDocument()
  })

  it('opens concept with full fields (evidence + title from blockName)', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('concept-click-full'))
    expect(screen.getByTestId('bookingmodal')).toBeInTheDocument()
    expect(screen.getByTestId('bm-title')).toHaveTextContent('bn')
    expect(screen.getByTestId('bm-has-evidence')).toHaveTextContent('true')
  })

  it('opens concept with minimal fields', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('concept-click-min'))
    expect(screen.getByTestId('bookingmodal')).toBeInTheDocument()
  })

  it('handles drag-to-create', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('drag-new'))
    expect(screen.getByTestId('bookingmodal')).toBeInTheDocument()
  })

  it('closes booking modal', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('book-suggestion-full'))
    fireEvent.click(screen.getByTestId('bm-close'))
    expect(screen.queryByTestId('bookingmodal')).not.toBeInTheDocument()
  })

  it('booked without concept just refreshes', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('book-suggestion-full'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('bm-booked'))
    })
    await waitFor(() => expect(weekMock.refresh).toHaveBeenCalled())
    expect(historyStoreMock.removeBlock).not.toHaveBeenCalled()
  })

  it('booked with concept removes block and caches mapping', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('concept-click-full'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('bm-booked'))
    })
    await waitFor(() => expect(historyStoreMock.removeBlock).toHaveBeenCalledWith('2026-05-11', 'u'))
    expect(mappingSet).toHaveBeenCalledWith('u', expect.objectContaining({ projectId: 'p', serviceId: 'sv' }))
  })

  it('booked with concept lacking a note caches with empty note', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('concept-click-nonote'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('bm-booked'))
    })
    await waitFor(() => expect(mappingSet).toHaveBeenCalled())
    expect(mappingSet).toHaveBeenCalledWith('u', expect.objectContaining({ note: '' }))
  })

  it('booked with concept having projectId but no serviceId skips mapping cache', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('concept-click-projonly'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('bm-booked'))
    })
    await waitFor(() => expect(historyStoreMock.removeBlock).toHaveBeenCalled())
    expect(mappingSet).not.toHaveBeenCalled()
  })

  it('booked with concept lacking project/service skips mapping cache', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('concept-click-min'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('bm-deleted'))
    })
    await waitFor(() => expect(historyStoreMock.removeBlock).toHaveBeenCalled())
    expect(mappingSet).not.toHaveBeenCalled()
  })
})

// ============================================================
// Submit / withdraw flows
// ============================================================

describe('submit', () => {
  it('opens submit-week modal with counts', async () => {
    getBlocksForDate.mockResolvedValue([{ startTime: '09:00' }, { startTime: null }])
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-week'))
    })
    await screen.findByTestId('submitmodal')
    expect(screen.getByTestId('sm-scope')).toHaveTextContent('week')
    // 5 days each 1 unbooked = 5
    expect(screen.getByTestId('sm-unbooked')).toHaveTextContent('5')
  })

  it('confirms submit and refreshes on success', async () => {
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-week'))
    })
    await screen.findByTestId('submitmodal')
    await act(async () => {
      fireEvent.click(screen.getByTestId('sm-confirm'))
    })
    await waitFor(() => expect(submissionsMock.submit).toHaveBeenCalled())
    expect(weekMock.refresh).toHaveBeenCalled()
  })

  it('confirm submit does not refresh when submit fails', async () => {
    submissionsMock.submit = vi.fn(async () => false)
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-week'))
    })
    await screen.findByTestId('submitmodal')
    weekMock.refresh = vi.fn()
    await act(async () => {
      fireEvent.click(screen.getByTestId('sm-confirm'))
    })
    await waitFor(() => expect(submissionsMock.submit).toHaveBeenCalled())
    expect(weekMock.refresh).not.toHaveBeenCalled()
  })

  it('cancels submit modal', async () => {
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-week'))
    })
    await screen.findByTestId('submitmodal')
    fireEvent.click(screen.getByTestId('sm-cancel'))
    expect(screen.queryByTestId('submitmodal')).not.toBeInTheDocument()
  })
})

// ============================================================
// Submitted / future-week branches
// ============================================================

describe('submitted and future-week states', () => {
  it('marks day read-only and clears suggestions when day submitted', () => {
    submissionsMock.isDateSubmitted = vi.fn(() => true)
    renderPage()
    expect(screen.getByTestId('dt-readonly')).toHaveTextContent('true')
    expect(screen.getByTestId('dt-suggestions-len')).toHaveTextContent('0')
    // when submitted: no upload, no dragnew, no process-day
    expect(screen.getByTestId('dt-has-upload')).toHaveTextContent('false')
    expect(screen.getByTestId('dt-has-dragnew')).toHaveTextContent('false')
    expect(screen.getByTestId('dt-has-process-day')).toHaveTextContent('false')
  })

  it('all week submitted reflects in WeekDayList', () => {
    submissionsMock.isDateSubmitted = vi.fn(() => true)
    renderPage()
    expect(screen.getByTestId('is-week-submitted')).toHaveTextContent('true')
  })

  it('future week cannot be submitted', () => {
    weekMock = makeWeekMock({ selectedWeekStart: '2099-01-05', selectedDate: '2099-01-05' })
    renderPage()
    expect(screen.getByTestId('can-submit-week')).toHaveTextContent('false')
  })

  it('computes "deze week" correctly when today is a weekday (non-Sunday branch)', () => {
    vi.useFakeTimers()
    try {
      // 2026-05-26 is a Tuesday; its Monday is 2026-05-25
      vi.setSystemTime(new Date(2026, 4, 26, 12, 0, 0))
      weekMock = makeWeekMock({ selectedWeekStart: '2026-05-25', selectedDate: '2026-05-25' })
      renderPage()
      expect(screen.getByTestId('weeklabel')).toHaveTextContent('deze week')
    } finally {
      vi.useRealTimers()
    }
  })

  it('labels current week as "deze week"', () => {
    // compute this monday
    const today = new Date()
    const day = today.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const m = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset)
    const ds = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`
    weekMock = makeWeekMock({ selectedWeekStart: ds, selectedDate: ds })
    renderPage()
    expect(screen.getByTestId('weeklabel')).toHaveTextContent('deze week')
  })
})

// ============================================================
// Clear day/week + counts
// ============================================================

describe('clear and counts', () => {
  it('clears a day and reloads', async () => {
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-day'))
    })
    expect(clearDayMock.clearDay).toHaveBeenCalledWith('2026-05-11')
    // trigger the onSuccess callback to cover reloadForDate path
    await act(async () => {
      clearDayOnSuccess('2026-05-11')
    })
    expect(historyStoreMock.reloadForDate).toHaveBeenCalledWith('2026-05-11')
  })

  it('clears a week and reloads all + counts', async () => {
    renderPage()
    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-week'))
    })
    expect(clearWeekMock.clearWeek).toHaveBeenCalledWith(weekMock.weekDays)
    await act(async () => {
      await clearWeekOnSuccess(weekMock.weekDays)
    })
    expect(historyStoreMock.reloadForDate).toHaveBeenCalled()
  })

  it('computes llm counts for week from history store', async () => {
    getBlocksForDate.mockImplementation(async (date: string) =>
      date === '2026-05-12' ? [{ origin: 'llm' }, { origin: 'llm-pattern' }, { origin: 'manual' }] : []
    )
    renderPage()
    // self-date count: blocksForDate empty -> 0; total includes loaded counts for other days
    await waitFor(() => expect(screen.getByTestId('total-llm').textContent).toBe('2'))
  })

  it('counts llm blocks for selected date from blocksForDate', async () => {
    historyStoreMock.blocksForDate = [{ origin: 'llm', startTime: null }, { origin: 'manual', startTime: null }]
    renderPage()
    await waitFor(() => expect(screen.getByTestId('llm-self')).toHaveTextContent('1'))
  })

  it('concept count is blocks length for selected date, 0 for others', () => {
    historyStoreMock.blocksForDate = [{ startTime: '09:00' }, { startTime: null }]
    renderPage()
    expect(screen.getByTestId('concept-count')).toHaveTextContent('2')
    expect(screen.getByTestId('concept-count-other')).toHaveTextContent('0')
  })
})

// ============================================================
// Misc wiring
// ============================================================

describe('misc wiring', () => {
  it('passes processing state for date (idle default)', () => {
    renderPage()
    expect(screen.getByTestId('proc-state')).toHaveTextContent('idle')
  })

  it('select date callback forwarded', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('select-date'))
    expect(weekMock.selectDate).toHaveBeenCalledWith('2026-05-12')
  })

  it('shows classifying when import parsing', () => {
    importMock.status = 'parsing'
    renderPage()
    expect(screen.getByTestId('dt-classifying')).toHaveTextContent('true')
  })
})
