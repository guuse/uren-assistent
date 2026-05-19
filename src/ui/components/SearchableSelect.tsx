import { useState, useRef, useEffect } from 'react'

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
}

export function SearchableSelect({ label, options, value, onChange, required, disabled, placeholder = 'Kies...' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      <label className="text-xs uppercase tracking-widest text-gray-400">
        {label}
        {required && !value && <span className="text-amber-400 ml-1">⚠</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className="w-full bg-[#1a1a2e] text-left text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none disabled:opacity-50 flex items-center justify-between gap-2"
        >
          <span className={selected ? 'text-white' : 'text-gray-500'}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && (
              <span
                onClick={handleClear}
                className="text-gray-500 hover:text-white text-xs px-1 cursor-pointer"
                role="button"
              >
                ✕
              </span>
            )}
            <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </button>

        {open && (
          <div className="absolute z-50 top-full mt-1 w-full bg-[#1a1a2e] border border-gray-700 rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-gray-700">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoeken..."
                className="w-full bg-[#2d2d44] text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:border-[#6c63ff] focus:outline-none placeholder-gray-500"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">Geen resultaten</div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[#2d2d44] transition-colors ${
                      opt.id === value ? 'text-[#6c63ff] font-medium' : 'text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
