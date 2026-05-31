import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekDayList } from './WeekDayList'

// A Mon–Fri work week (2026-05-25 is a Monday).
const WEEK_DAYS = ['2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29']

function baseProps(overrides: Partial<Parameters<typeof WeekDayList>[0]> = {}) {
  return {
    weekDays: WEEK_DAYS,
    selectedDate: '2026-05-25',
    hoursForDate: () => 0,
    onSelectDate: vi.fn(),
    onPrevWeek: vi.fn(),
    onNextWeek: vi.fn(),
    weekLabel: 'Week 22',
    ...overrides,
  }
}

describe('WeekDayList', () => {
  it('renders week label and range label', () => {
    render(<WeekDayList {...baseProps()} />)
    expect(screen.getByText('Week 22')).toBeInTheDocument()
    // range label "25 mei–29 mei"
    expect(screen.getByText(/25 mei.*29 mei/)).toBeInTheDocument()
  })

  it('renders empty range label when fewer than 2 days', () => {
    render(<WeekDayList {...baseProps({ weekDays: ['2026-05-25'] })} />)
    expect(screen.getByText('Week 22')).toBeInTheDocument()
  })

  it('calls onSelectDate when a day row is clicked', () => {
    const onSelectDate = vi.fn()
    render(<WeekDayList {...baseProps({ onSelectDate })} />)
    fireEvent.click(screen.getByText('DI'))
    expect(onSelectDate).toHaveBeenCalledWith('2026-05-26')
  })

  it('calls onPrevWeek and onNextWeek', () => {
    const onPrevWeek = vi.fn()
    const onNextWeek = vi.fn()
    render(<WeekDayList {...baseProps({ onPrevWeek, onNextWeek })} />)
    fireEvent.click(screen.getByTitle('Vorige week'))
    fireEvent.click(screen.getByTitle('Volgende week'))
    expect(onPrevWeek).toHaveBeenCalledOnce()
    expect(onNextWeek).toHaveBeenCalledOnce()
  })

  it('shows hours and target check for completed days, and dash for empty', () => {
    const hoursForDate = (d: string) => (d === '2026-05-25' ? 8 : d === '2026-05-26' ? 4 : 0)
    render(<WeekDayList {...baseProps({ hoursForDate })} />)
    // 8u with check, 4u, and dashes for the rest
    expect(screen.getByText(/8,0u/)).toBeInTheDocument()
    expect(screen.getByText('4,0u')).toBeInTheDocument()
    expect(screen.getAllByText('–').length).toBeGreaterThan(0)
  })

  it('shows week progress total', () => {
    const hoursForDate = () => 8
    render(<WeekDayList {...baseProps({ hoursForDate })} />)
    expect(screen.getByText('40,0/40u')).toBeInTheDocument()
  })

  it('renders unknown day label for an out-of-range weekday', () => {
    // Saturday 2026-05-30 maps to no DAY_LABELS entry -> "??"
    render(<WeekDayList {...baseProps({ weekDays: ['2026-05-30'], selectedDate: '2026-05-30' })} />)
    expect(screen.getByText('??')).toBeInTheDocument()
  })

  it('shows "Naar vandaag" button when not current week and triggers handler', () => {
    const onGoToCurrentWeek = vi.fn()
    render(<WeekDayList {...baseProps({ isCurrentWeek: false, onGoToCurrentWeek })} />)
    const btn = screen.getByText('Naar vandaag')
    fireEvent.click(btn)
    expect(onGoToCurrentWeek).toHaveBeenCalledOnce()
  })

  it('hides "Naar vandaag" button when current week', () => {
    render(<WeekDayList {...baseProps({ isCurrentWeek: true })} />)
    expect(screen.queryByText('Naar vandaag')).toBeNull()
  })

  it('toggles the month picker popup and selects a date', () => {
    const onGoToDate = vi.fn()
    render(<WeekDayList {...baseProps({ onGoToDate })} />)
    fireEvent.click(screen.getByTitle('Kies datum'))
    // popup is open: pick a weekday (1 may 2026 = Friday weekday); but month is mei
    // The popup shows the month of selectedDate (2026-05-25 -> mei 2026)
    expect(screen.getByText('mei 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByText('25'))
    expect(onGoToDate).toHaveBeenCalledWith('2026-05-25')
    // popup closed after select
    expect(screen.queryByText('mei 2026')).toBeNull()
  })

  it('closes the month picker via the popup overlay (onClose)', () => {
    const { container } = render(<WeekDayList {...baseProps()} />)
    fireEvent.click(screen.getByTitle('Kies datum'))
    expect(screen.getByText('mei 2026')).toBeInTheDocument()
    const overlay = container.querySelector('.fixed.inset-0') as HTMLElement
    fireEvent.click(overlay)
    expect(screen.queryByText('mei 2026')).toBeNull()
  })

  it('passes isDateSubmitted and onPickerMonthChange to the popup', () => {
    const onPickerMonthChange = vi.fn()
    const isDateSubmitted = (d: string) => d === '2026-05-25'
    render(<WeekDayList {...baseProps({ onPickerMonthChange, isDateSubmitted })} />)
    fireEvent.click(screen.getByTitle('Kies datum'))
    // onMonthChange fires on mount
    expect(onPickerMonthChange).toHaveBeenCalled()
  })

  it('shows processing states: classifying and error', () => {
    const processingStateForDate = (d: string) =>
      d === '2026-05-25' ? ('classifying' as const) : d === '2026-05-26' ? ('error' as const) : ('idle' as const)
    render(<WeekDayList {...baseProps({ processingStateForDate })} />)
    expect(screen.getByText('Verwerken…')).toBeInTheDocument()
    expect(screen.getByText('Fout bij verwerken')).toBeInTheDocument()
  })

  it('shows lock indicator on submitted days', () => {
    const isDateSubmitted = (d: string) => d === '2026-05-25'
    const { container } = render(<WeekDayList {...baseProps({ isDateSubmitted })} />)
    // LockClosedIcon rendered with green color
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('shows clear-day trash button and opens confirm dialog', async () => {
    const onClearDayBlocks = vi.fn().mockResolvedValue(undefined)
    const llmBlockCountForDate = (d: string) => (d === '2026-05-25' ? 3 : 0)
    render(<WeekDayList {...baseProps({ onClearDayBlocks, llmBlockCountForDate })} />)
    const trash = screen.getByTitle('Wis 3 LLM-blokken')
    fireEvent.click(trash)
    expect(screen.getByText('LLM-blokken wissen')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Wissen'))
    expect(onClearDayBlocks).toHaveBeenCalledWith('2026-05-25')
  })

  it('uses singular block label when count is 1', () => {
    const onClearDayBlocks = vi.fn()
    const llmBlockCountForDate = (d: string) => (d === '2026-05-25' ? 1 : 0)
    render(<WeekDayList {...baseProps({ onClearDayBlocks, llmBlockCountForDate })} />)
    expect(screen.getByTitle('Wis 1 LLM-blok')).toBeInTheDocument()
  })

  it('cancels the clear-day confirm dialog', () => {
    const onClearDayBlocks = vi.fn()
    const llmBlockCountForDate = () => 2
    render(<WeekDayList {...baseProps({ onClearDayBlocks, llmBlockCountForDate })} />)
    fireEvent.click(screen.getAllByTitle(/Wis 2 LLM-blok/)[0]!)
    fireEvent.click(screen.getByText('Annuleren'))
    expect(screen.queryByText('LLM-blokken wissen')).toBeNull()
  })

  it('renders submitted-week badge with label and withdraw button', () => {
    const onWithdrawWeek = vi.fn()
    render(
      <WeekDayList
        {...baseProps({ isWeekSubmitted: true, submittedLabel: 'do 28 mei', onWithdrawWeek })}
      />,
    )
    expect(screen.getByText(/Ingediend · do 28 mei/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Trek week in'))
    expect(onWithdrawWeek).toHaveBeenCalledOnce()
  })

  it('renders submitted-week badge without label', () => {
    render(<WeekDayList {...baseProps({ isWeekSubmitted: true, submittedLabel: null })} />)
    expect(screen.getByText(/Ingediend/)).toBeInTheDocument()
  })

  it('disables the withdraw button while submitting and shows submit error', () => {
    const onWithdrawWeek = vi.fn()
    render(
      <WeekDayList
        {...baseProps({
          isWeekSubmitted: true,
          onWithdrawWeek,
          isSubmittingWeek: true,
          submitError: 'oeps',
        })}
      />,
    )
    const btn = screen.getByText('Bezig…')
    expect(btn).toBeDisabled()
    expect(screen.getByText('oeps')).toBeInTheDocument()
  })

  it('shows clear errors when not submitted', () => {
    render(<WeekDayList {...baseProps({ clearError: 'day-err' })} />)
    expect(screen.getByText('day-err')).toBeInTheDocument()
  })

  it('falls back to clearWeekError when clearError is null', () => {
    render(<WeekDayList {...baseProps({ clearError: null, clearWeekError: 'week-err' })} />)
    expect(screen.getByText('week-err')).toBeInTheDocument()
  })

  it('shows clear-week button and opens/confirms clear-week dialog', async () => {
    const onClearWeekBlocks = vi.fn().mockResolvedValue(undefined)
    render(
      <WeekDayList {...baseProps({ totalLlmBlockCount: 5, onClearWeekBlocks })} />,
    )
    fireEvent.click(screen.getByText(/Wis week \(5\)/))
    expect(screen.getByText('Week wissen')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Wissen'))
    expect(onClearWeekBlocks).toHaveBeenCalledOnce()
  })

  it('cancels the clear-week dialog', () => {
    const onClearWeekBlocks = vi.fn()
    render(<WeekDayList {...baseProps({ totalLlmBlockCount: 5, onClearWeekBlocks })} />)
    fireEvent.click(screen.getByText(/Wis week \(5\)/))
    fireEvent.click(screen.getByText('Annuleren'))
    expect(screen.queryByText('Week wissen')).toBeNull()
  })

  it('does not render clear-week button when count is 0', () => {
    const onClearWeekBlocks = vi.fn()
    render(<WeekDayList {...baseProps({ totalLlmBlockCount: 0, onClearWeekBlocks })} />)
    expect(screen.queryByText(/Wis week/)).toBeNull()
  })

  it('renders process-week button and handles click', () => {
    const onProcessWeek = vi.fn()
    render(<WeekDayList {...baseProps({ onProcessWeek })} />)
    fireEvent.click(screen.getByText('Verwerk week'))
    expect(onProcessWeek).toHaveBeenCalledOnce()
  })

  it('shows busy label and disables process-week while processing', () => {
    render(<WeekDayList {...baseProps({ onProcessWeek: vi.fn(), isProcessingWeek: true })} />)
    expect(screen.getByText('Bezig…')).toBeDisabled()
  })

  it('renders submit-week button enabled and handles click', () => {
    const onSubmitWeek = vi.fn()
    render(<WeekDayList {...baseProps({ onSubmitWeek, canSubmitWeek: true })} />)
    fireEvent.click(screen.getByText('Dien week in'))
    expect(onSubmitWeek).toHaveBeenCalledOnce()
  })

  it('disables submit-week for a future week and shows title hint', () => {
    render(<WeekDayList {...baseProps({ onSubmitWeek: vi.fn(), canSubmitWeek: false })} />)
    const btn = screen.getByText('Dien week in')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'Een toekomstige week kan nog niet ingediend worden')
  })

  it('shows submitting label on submit-week', () => {
    render(<WeekDayList {...baseProps({ onSubmitWeek: vi.fn(), isSubmittingWeek: true })} />)
    expect(screen.getByText('Indienen…')).toBeInTheDocument()
  })

  it('shows submit error in the non-submitted footer', () => {
    render(<WeekDayList {...baseProps({ onSubmitWeek: vi.fn(), submitError: 'submit-fail' })} />)
    expect(screen.getByText('submit-fail')).toBeInTheDocument()
  })

  it('renders CSV upload button and handles click', () => {
    const onUploadCsv = vi.fn()
    render(<WeekDayList {...baseProps({ onUploadCsv })} />)
    fireEvent.click(screen.getByText('CSV uploaden'))
    expect(onUploadCsv).toHaveBeenCalledOnce()
  })
})
