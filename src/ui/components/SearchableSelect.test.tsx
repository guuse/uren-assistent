import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchableSelect } from './SearchableSelect'

const options = [
  { id: 'a', label: 'Apple pie' },
  { id: 'b', label: 'Banana bread' },
  { id: 'c', label: 'Cherry cake' },
]

describe('SearchableSelect', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function open(ui: React.ReactElement) {
    render(ui)
    act(() => {
      // The trigger is the first button; a clear "✕" span (role=button) may also exist.
      fireEvent.click(screen.getAllByRole('button')[0]!)
      vi.runAllTimers()
    })
  }

  it('renders the label and placeholder when no value', () => {
    render(<SearchableSelect label="Dessert" options={options} value={undefined} onChange={() => {}} />)
    expect(screen.getByText('Dessert')).toBeInTheDocument()
    expect(screen.getByText('Kies...')).toBeInTheDocument()
  })

  it('uses a custom placeholder', () => {
    render(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} placeholder="Pick one" />)
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('shows the selected option label', () => {
    render(<SearchableSelect label="L" options={options} value="b" onChange={() => {}} />)
    expect(screen.getByText('Banana bread')).toBeInTheDocument()
  })

  it('shows required warning marker when required and no value', () => {
    render(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} required />)
    expect(screen.getByText('⚠')).toBeInTheDocument()
  })

  it('does not show warning marker when required but value set', () => {
    render(<SearchableSelect label="L" options={options} value="a" onChange={() => {}} required />)
    expect(screen.queryByText('⚠')).toBeNull()
  })

  it('opens the dropdown and lists all options', () => {
    open(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} />)
    expect(screen.getByPlaceholderText('Zoeken...')).toBeInTheDocument()
    expect(screen.getByText('Apple pie')).toBeInTheDocument()
    expect(screen.getByText('Cherry cake')).toBeInTheDocument()
  })

  it('does not open when disabled', () => {
    render(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByPlaceholderText('Zoeken...')).toBeNull()
  })

  it('filters options by multi-term query', () => {
    open(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Zoeken...'), { target: { value: 'cherry cake' } })
    expect(screen.getByText('Cherry cake')).toBeInTheDocument()
    expect(screen.queryByText('Apple pie')).toBeNull()
  })

  it('shows "Geen resultaten" when nothing matches', () => {
    open(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Zoeken...'), { target: { value: 'zzz' } })
    expect(screen.getByText('Geen resultaten')).toBeInTheDocument()
  })

  it('selects an option and calls onChange', () => {
    const onChange = vi.fn()
    open(<SearchableSelect label="L" options={options} value={undefined} onChange={onChange} />)
    fireEvent.click(screen.getByText('Banana bread'))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByPlaceholderText('Zoeken...')).toBeNull()
  })

  it('clears the selection via the ✕ button', () => {
    const onChange = vi.fn()
    render(<SearchableSelect label="L" options={options} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByText('✕'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('closes when clicking outside', () => {
    open(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} />)
    expect(screen.getByPlaceholderText('Zoeken...')).toBeInTheDocument()
    act(() => {
      fireEvent.mouseDown(document.body)
    })
    expect(screen.queryByPlaceholderText('Zoeken...')).toBeNull()
  })

  it('keeps open when clicking inside the dropdown', () => {
    open(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} />)
    const input = screen.getByPlaceholderText('Zoeken...')
    act(() => {
      fireEvent.mouseDown(input)
    })
    expect(screen.getByPlaceholderText('Zoeken...')).toBeInTheDocument()
  })

  it('renders a suffix per option', () => {
    open(
      <SearchableSelect
        label="L"
        options={options}
        value="a"
        onChange={() => {}}
        renderSuffix={(o) => <span>suffix-{o.id}</span>}
      />
    )
    expect(screen.getByText('suffix-a')).toBeInTheDocument()
    expect(screen.getByText('suffix-b')).toBeInTheDocument()
  })

  it('renders a group separator after a given option (not last)', () => {
    open(
      <SearchableSelect
        label="L"
        options={options}
        value={undefined}
        onChange={() => {}}
        groupSeparatorAfter="a"
      />
    )
    // separator div present; Apple is not the last item so it renders
    expect(screen.getByText('Apple pie')).toBeInTheDocument()
  })

  it('does not render separator after the last option', () => {
    open(
      <SearchableSelect
        label="L"
        options={options}
        value={undefined}
        onChange={() => {}}
        groupSeparatorAfter="c"
      />
    )
    expect(screen.getByText('Cherry cake')).toBeInTheDocument()
  })

  it('toggles the chevron when opened', () => {
    open(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} />)
    expect(screen.getByText('▲')).toBeInTheDocument()
  })

  it('applies highlight border styling', () => {
    render(<SearchableSelect label="L" options={options} value={undefined} onChange={() => {}} highlight />)
    expect(screen.getByRole('button').className).toContain('border-[#a07848]')
  })
})
