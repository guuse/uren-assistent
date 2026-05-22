const DAY_LABELS: Record<string, string> = {
  '1': 'MA', '2': 'DI', '3': 'WO', '4': 'DO', '5': 'VR',
}

interface Props {
  weekDays: string[]           // YYYY-MM-DD strings ma t/m vr
  selectedDate: string
  hoursForDate: (date: string) => number
  onSelectDate: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  weekLabel: string            // bijv. "week 21" of "vorige week"
  conceptCountForDate?: (date: string) => number
}

const TARGET_HOURS = 8

function ProgressBar({ hours }: { hours: number }) {
  const pct = Math.min(100, (hours / TARGET_HOURS) * 100)
  const color = hours >= TARGET_HOURS ? 'bg-green-500' : hours > 0 ? 'bg-amber-500' : 'bg-transparent'
  return (
    <div className="h-[3px] bg-[#2e2a26] rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function WeekDayList({
  weekDays,
  selectedDate,
  hoursForDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  weekLabel,
  conceptCountForDate,
}: Props) {
  return (
    <div className="w-[130px] flex-shrink-0 bg-[#171512] border-r border-[#2e2a26] flex flex-col py-3 px-2">
      <div className="text-[#4a4540] text-[9px] uppercase tracking-widest mb-2 px-1">{weekLabel}</div>

      <div className="flex flex-col gap-1 flex-1">
        {weekDays.map((date) => {
          const dayNum = new Date(date).getDay().toString()
          const label = DAY_LABELS[dayNum] ?? ''
          const dayOfMonth = new Date(date).getDate()
          const hours = hoursForDate(date)
          const isSelected = date === selectedDate
          const isFull = hours >= TARGET_HOURS
          const conceptCount = conceptCountForDate?.(date) ?? 0

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`text-left px-2 py-2 rounded-lg transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#252220] border border-[#6366f1]'
                  : 'hover:bg-[#252220] border border-transparent'
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`text-[10px] font-semibold ${
                    isSelected ? 'text-[#a5b4fc]' : isFull ? 'text-[#94a3b8]' : 'text-[#64748b]'
                  }`}
                >
                  {label} {dayOfMonth}
                </span>
                {isFull && <span className="text-green-500 text-[9px]">✓</span>}
                {!isFull && hours > 0 && <span className="text-amber-500 text-[9px]">●</span>}
              </div>
              <ProgressBar hours={hours} />
              <div className="text-[8px] text-[#475569] mt-1">
                {hours > 0 ? `${hours} / ${TARGET_HOURS}u` : `0 / ${TARGET_HOURS}u`}
              </div>
              {conceptCount > 0 && !isFull && (
                <div className="mt-1">
                  <span className="bg-[#2a2010] text-[#a07848] text-[8px] px-[5px] py-[1px] rounded">
                    {conceptCount} concept{conceptCount !== 1 ? 'en' : ''}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex justify-between items-center px-1 mt-2">
        <button
          onClick={onPrevWeek}
          className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
        >
          ‹
        </button>
        <span className="text-[#4a4540] text-[8px]">{weekLabel}</span>
        <button
          onClick={onNextWeek}
          className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
        >
          ›
        </button>
      </div>
    </div>
  )
}
