import type { Day } from '../../domain/entities/Template'

const DAYS: { key: Day; label: string }[] = [
  { key: 'mon', label: 'Ma' },
  { key: 'tue', label: 'Di' },
  { key: 'wed', label: 'Wo' },
  { key: 'thu', label: 'Do' },
  { key: 'fri', label: 'Vr' },
  { key: 'sat', label: 'Za' },
  { key: 'sun', label: 'Zo' },
]

interface Props {
  selected: Day[]
  onChange: (days: Day[]) => void
}

export function DayPicker({ selected, onChange }: Props) {
  function toggle(day: Day) {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day))
    } else {
      onChange([...selected, day])
    }
  }

  return (
    <div className="flex gap-1">
      {DAYS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            selected.includes(key)
              ? 'bg-[#6c63ff] text-white'
              : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
