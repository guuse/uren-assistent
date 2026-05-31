import '@testing-library/jest-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MonthPickerPopup } from './MonthPickerPopup'

afterEach(() => {
  vi.useRealTimers()
})

describe('MonthPickerPopup', () => {
  const baseProps = {
    initialMonth: '2026-05-15',
    onSelectDate: () => {},
    onClose: () => {},
  }

  it('renders the initial month name and year', () => {
    render(<MonthPickerPopup {...baseProps} />)
    expect(screen.getByText('mei 2026')).toBeInTheDocument()
  })

  it('navigates to the previous month', () => {
    render(<MonthPickerPopup {...baseProps} />)
    const [prevBtn] = screen.getAllByRole('button')
    fireEvent.click(prevBtn!)
    expect(screen.getByText('april 2026')).toBeInTheDocument()
  })

  it('navigates to the next month', () => {
    render(<MonthPickerPopup {...baseProps} />)
    const buttons = screen.getAllByRole('button')
    // buttons[0] = prev, buttons[1] = next
    fireEvent.click(buttons[1]!)
    expect(screen.getByText('juni 2026')).toBeInTheDocument()
  })

  it('calls onSelectDate when a weekday is clicked', () => {
    const onSelectDate = vi.fn()
    render(<MonthPickerPopup {...baseProps} onSelectDate={onSelectDate} />)
    // 1 mei 2026 is a Friday (weekday)
    fireEvent.click(screen.getByText('1'))
    expect(onSelectDate).toHaveBeenCalledWith('2026-05-01')
  })

  it('disables weekend days', () => {
    render(<MonthPickerPopup {...baseProps} />)
    // 2 mei 2026 is a Saturday
    expect(screen.getByText('2').closest('button')).toBeDisabled()
  })

  it('calls onSelectDate with today via "Ga naar vandaag"', () => {
    const onSelectDate = vi.fn()
    render(<MonthPickerPopup {...baseProps} onSelectDate={onSelectDate} />)
    fireEvent.click(screen.getByText('Ga naar vandaag'))
    expect(onSelectDate).toHaveBeenCalledOnce()
  })

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<MonthPickerPopup {...baseProps} onClose={onClose} />)
    const overlay = container.querySelector('.fixed.inset-0') as HTMLElement
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('fires onMonthChange on mount and on navigation', () => {
    const onMonthChange = vi.fn()
    render(<MonthPickerPopup {...baseProps} onMonthChange={onMonthChange} />)
    expect(onMonthChange).toHaveBeenCalledWith('2026-05-01')
    const [prevBtn] = screen.getAllByRole('button')
    fireEvent.click(prevBtn!)
    expect(onMonthChange).toHaveBeenCalledWith('2026-04-01')
  })

  it('marks submitted days and shows a lock on Mondays', () => {
    // 4 mei 2026 is a Monday. Mark the whole month as submitted.
    const isDateSubmitted = (date: string) => date >= '2026-05-01' && date <= '2026-05-31'
    render(<MonthPickerPopup {...baseProps} isDateSubmitted={isDateSubmitted} />)
    const monday = screen.getByText('4').closest('button')!
    expect(monday).toHaveAttribute('title', 'Ingediend')
  })

  it('applies hover background on weekday mouse enter/leave', () => {
    render(<MonthPickerPopup {...baseProps} />)
    const day = screen.getByText('1').closest('button')!
    fireEvent.mouseEnter(day)
    expect(day.style.background).toBe('var(--bg)')
    fireEvent.mouseLeave(day)
    expect(day.style.background).toBe('transparent')
  })

  it('highlights today with the accent style when today is a weekday', () => {
    // 2026-05-19 is a Tuesday (weekday).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'))
    render(<MonthPickerPopup {...baseProps} />)
    const todayBtn = screen.getByText('19').closest('button')!
    expect(todayBtn.style.color).toBe('var(--accent)')
    // hover should be a no-op for today
    fireEvent.mouseEnter(todayBtn)
    expect(todayBtn.style.color).toBe('var(--accent)')
  })

  it('uses bold today styling within a submitted month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'))
    const isDateSubmitted = () => true
    render(<MonthPickerPopup {...baseProps} isDateSubmitted={isDateSubmitted} />)
    const todayBtn = screen.getByText('19').closest('button')!
    expect(todayBtn.style.fontWeight).toBe('700')
  })

  it('does not change background on hover for submitted days', () => {
    const isDateSubmitted = () => true
    render(<MonthPickerPopup {...baseProps} isDateSubmitted={isDateSubmitted} />)
    const day = screen.getByText('1').closest('button')!
    const before = day.style.background
    fireEvent.mouseEnter(day)
    expect(day.style.background).toBe(before)
    fireEvent.mouseLeave(day)
    expect(day.style.background).toBe(before)
  })
})
