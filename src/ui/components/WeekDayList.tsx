const DAY_LABELS: Record<string, string> = {
  '1': 'MA', '2': 'DI', '3': 'WO', '4': 'DO', '5': 'VR',
}

export type DayProcessingState = 'idle' | 'classifying' | 'done' | 'error'

interface Props {
  weekDays: string[]
  selectedDate: string
  hoursForDate: (date: string) => number
  onSelectDate: (date: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  weekLabel: string
  conceptCountForDate?: (date: string) => number
  onProcessWeek?: () => void
  processingStateForDate?: (date: string) => DayProcessingState
  isProcessingWeek?: boolean
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
  onProcessWeek,
  processingStateForDate,
  isProcessingWeek = false,
}: Props) {
  return (
    <div className="w-[130px] flex-shrink-0 bg-[#171512] border-r border-[#2e2a26] flex flex-col py-3 px-2">
      <div className="text-[#4a4540] text-[0.5625rem] uppercase tracking-widest mb-2 px-1">{weekLabel}</div>

      <div className="flex flex-col gap-1 flex-1">
        {weekDays.map((date) => {
          // Parse YYYY-MM-DD as local date to avoid UTC timezone shift
          const [year, month, day] = date.split('-').map(Number)
          const localDate = new Date(year!, month! - 1, day!)
          const dayNum = localDate.getDay().toString()
          const label = DAY_LABELS[dayNum] ?? ''
          const dayOfMonth = localDate.getDate()
          const hours = hoursForDate(date)
          const isSelected = date === selectedDate
          const isFull = hours >= TARGET_HOURS
          const conceptCount = conceptCountForDate?.(date) ?? 0
          const processingState = processingStateForDate?.(date) ?? 'idle'

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
                  className={`text-[0.625rem] font-semibold ${
                    isSelected ? 'text-[#a5b4fc]' : isFull ? 'text-[#94a3b8]' : 'text-[#64748b]'
                  }`}
                >
                  {label} {dayOfMonth}
                </span>
                {processingState === 'classifying' && (
                  <span className="text-[#a07848] text-[0.5625rem]">···</span>
                )}
                {processingState === 'done' && (
                  <span className="text-[#5a8a6a] text-[0.5625rem]">✓</span>
                )}
                {processingState === 'error' && (
                  <span className="text-[#b85a3a] text-[0.5625rem]">!</span>
                )}
                {processingState === 'idle' && isFull && (
                  <span className="text-green-500 text-[0.5625rem]">✓</span>
                )}
                {processingState === 'idle' && !isFull && hours > 0 && (
                  <span className="text-amber-500 text-[0.5625rem]">●</span>
                )}
              </div>
              <ProgressBar hours={hours} />
              <div className="text-[0.5rem] text-[#475569] mt-1">
                {hours > 0 ? `${hours} / ${TARGET_HOURS}u` : `0 / ${TARGET_HOURS}u`}
              </div>
              {conceptCount > 0 && !isFull && processingState === 'idle' && (
                <div className="mt-1">
                  <span className="bg-[#2a2010] text-[#a07848] text-[0.5rem] px-[5px] py-[1px] rounded">
                    {conceptCount} concept{conceptCount !== 1 ? 'en' : ''}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {onProcessWeek && (
        <div className="mt-2 px-1">
          <button
            onClick={onProcessWeek}
            disabled={isProcessingWeek}
            className="w-full bg-[#252220] disabled:opacity-40 border border-[#3e3a36] text-[#e8e2d9] text-[0.625rem] font-medium py-[6px] rounded-lg hover:border-[#5e5a56] transition-colors cursor-pointer disabled:cursor-default"
          >
            {isProcessingWeek ? 'Bezig...' : 'Verwerk week'}
          </button>
        </div>
      )}

      <div className="flex justify-between items-center px-1 mt-2">
        <button
          onClick={onPrevWeek}
          className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
        >
          ‹
        </button>
        <span className="text-[#4a4540] text-[0.5rem]">{weekLabel}</span>
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
