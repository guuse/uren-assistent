import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FieldSelector } from './FieldSelector'

const options = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
]

describe('FieldSelector', () => {
  it('forwards label and selected value to SearchableSelect', () => {
    render(<FieldSelector label="Project" options={options} value="b" onChange={() => {}} />)
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('forwards optional props (required, disabled, highlight)', () => {
    render(
      <FieldSelector
        label="Project"
        options={options}
        value={undefined}
        onChange={() => {}}
        required
        highlight
      />
    )
    expect(screen.getByText('⚠')).toBeInTheDocument()
    expect(screen.getByRole('button').className).toContain('border-[#a07848]')
  })

  it('respects disabled and forwards renderSuffix / groupSeparatorAfter', () => {
    render(
      <FieldSelector
        label="Project"
        options={options}
        value="a"
        onChange={() => {}}
        disabled
        renderSuffix={(o) => <span>s-{o.id}</span>}
        groupSeparatorAfter="a"
      />
    )
    expect(screen.getAllByRole('button')[0]).toBeDisabled()
  })

  it('forwards onChange via clear', () => {
    const onChange = vi.fn()
    render(<FieldSelector label="Project" options={options} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByText('✕'))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
