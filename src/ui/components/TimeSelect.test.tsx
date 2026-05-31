import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimeSelect } from './TimeSelect'

describe('TimeSelect', () => {
  it('renders label and full time range', () => {
    render(<TimeSelect label="Start" value="09:00" onChange={() => {}} />)
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '07:00' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '20:00' })).toBeInTheDocument()
  })

  it('calls onChange when a time is selected', () => {
    const onChange = vi.fn()
    render(<TimeSelect label="Start" value="09:00" onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '10:30' } })
    expect(onChange).toHaveBeenCalledWith('10:30')
  })

  it('filters out options at or before minTime', () => {
    render(<TimeSelect label="Eind" value="12:00" onChange={() => {}} minTime="09:00" />)
    expect(screen.queryByRole('option', { name: '09:00' })).toBeNull()
    expect(screen.queryByRole('option', { name: '08:00' })).toBeNull()
    expect(screen.getByRole('option', { name: '09:15' })).toBeInTheDocument()
  })
})
