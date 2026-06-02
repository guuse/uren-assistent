import { useState, useRef, useEffect } from 'react'
import React from 'react'
import ReactDOM from 'react-dom'

interface Option {
  id: string
  label: string
}

interface Props {
  label: string
  options: Option[]
  value: string | undefined
  onChange: (id: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  highlight?: boolean
  renderSuffix?: (option: Option) => React.ReactNode
  groupSeparatorAfter?: string
}

export function SearchableSelect({ label, options, value, onChange, required, disabled, placeholder = 'Kies...', highlight, renderSuffix, groupSeparatorAfter }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const selected = options.find((o) => o.id === value)
  const filtered = query.length > 0
    ? (() => {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
        return options.filter((o) => {
          const label = o.label.toLowerCase()
          return terms.every((term) => label.includes(term))
        })
      })()
    : options

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    // The trigger button is rendered with `disabled={disabled}`, so a disabled
    // control never invokes this handler — no explicit guard needed here.
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      })
    }
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
        {label}
        {required && !value && <span className="text-[#a07848] ml-1">⚠</span>}
      </label>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          data-testid={`select-${label.toLowerCase()}`}
          onClick={handleOpen}
          disabled={disabled}
          className={`w-full bg-[var(--surface)] text-left text-sm rounded-lg px-3 py-2 border focus:outline-none disabled:opacity-50 flex items-center justify-between gap-2 ${highlight ? 'border-[#a07848] focus:border-[#a07848]' : 'border-[var(--border)] focus:border-[var(--border-strong)]'}`}
        >
          <span className={selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && (
              <span
                onClick={handleClear}
                className="text-[var(--text-faint)] hover:text-[var(--text-primary)] text-xs px-1 cursor-pointer"
                role="button"
              >
                ✕
              </span>
            )}
            <span className="text-[var(--text-faint)] text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </button>

        {open && ReactDOM.createPortal(
          <div ref={dropdownRef} style={dropdownStyle} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[var(--border)]">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoeken..."
                className="w-full bg-[var(--bg)] text-[var(--text-primary)] text-sm rounded px-2 py-1.5 border border-[var(--border)] focus:border-[var(--border-strong)] focus:outline-none placeholder-[var(--text-faint)]"
              />
            </div>
            <div className="max-h-[272px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[var(--text-faint)]">Geen resultaten</div>
              ) : (
                filtered.map((opt, idx) => (
                  <div key={opt.id}>
                    <div className="flex items-center">
                      <button
                        type="button"
                        data-testid={`option-${opt.id}`}
                        onClick={() => handleSelect(opt.id)}
                        className={`flex-1 text-left px-3 py-2 text-sm hover:bg-[var(--bg)] transition-colors ${
                          opt.id === value ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                      {renderSuffix && (
                        <div className="pr-2 flex-shrink-0">
                          {renderSuffix(opt)}
                        </div>
                      )}
                    </div>
                    {groupSeparatorAfter && opt.id === groupSeparatorAfter && idx < filtered.length - 1 && (
                      <div className="border-t border-[var(--border)] mx-2 my-1" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
