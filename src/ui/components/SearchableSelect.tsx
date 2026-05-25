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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    if (disabled) return
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
      <label className="text-xs uppercase tracking-widest text-[#7a7268]">
        {label}
        {required && !value && <span className="text-[#a07848] ml-1">⚠</span>}
      </label>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={`w-full bg-[#1e1b18] text-left text-sm rounded-lg px-3 py-2 border focus:outline-none disabled:opacity-50 flex items-center justify-between gap-2 ${highlight ? 'border-[#a07848] focus:border-[#a07848]' : 'border-[#2e2a26] focus:border-[#5a5248]'}`}
        >
          <span className={selected ? 'text-[#e8e2d9]' : 'text-[#4a4540]'}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && (
              <span
                onClick={handleClear}
                className="text-[#4a4540] hover:text-[#e8e2d9] text-xs px-1 cursor-pointer"
                role="button"
              >
                ✕
              </span>
            )}
            <span className="text-[#4a4540] text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </button>

        {open && ReactDOM.createPortal(
          <div style={dropdownStyle} className="bg-[#1e1b18] border border-[#2e2a26] rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[#2e2a26]">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoeken..."
                className="w-full bg-[#252220] text-[#e8e2d9] text-sm rounded px-2 py-1.5 border border-[#3e3a36] focus:border-[#5a5248] focus:outline-none placeholder-[#4a4540]"
              />
            </div>
            <div className="max-h-[272px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[#4a4540]">Geen resultaten</div>
              ) : (
                filtered.map((opt, idx) => (
                  <div key={opt.id}>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSelect(opt.id)}
                        className={`flex-1 text-left px-3 py-2 text-sm hover:bg-[#252220] transition-colors ${
                          opt.id === value ? 'text-[#e8e2d9] font-medium' : 'text-[#7a7268]'
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
                      <div className="border-t border-[#2e2a26] mx-2 my-1" />
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
