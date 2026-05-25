interface Props {
  label: string
  value: string        // HH:mm
  onChange: (time: string) => void
  minTime?: string     // HH:mm — options at or before this time are excluded
}

function generateTimes(): string[] {
  const times: string[] = []
  const [minH, minM] = '07:00'.split(':').map(Number)
  const [maxH, maxM] = '20:00'.split(':').map(Number)
  const minTotal = minH! * 60 + minM!
  const maxTotal = maxH! * 60 + maxM!
  for (let t = minTotal; t <= maxTotal; t += 15) {
    const h = Math.floor(t / 60).toString().padStart(2, '0')
    const m = (t % 60).toString().padStart(2, '0')
    times.push(`${h}:${m}`)
  }
  return times
}

const ALL_TIMES = generateTimes()

export function TimeSelect({ label, value, onChange, minTime }: Props) {
  const options = minTime
    ? ALL_TIMES.filter((t) => t > minTime)
    : ALL_TIMES

  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[var(--surface)] text-[var(--text-primary)] text-sm rounded-lg px-3 py-2 border border-[var(--border)] focus:border-[var(--border-strong)] focus:outline-none"
      >
        {options.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  )
}
