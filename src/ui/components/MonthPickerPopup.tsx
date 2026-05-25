import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  initialMonth: string  // YYYY-MM-DD van de eerste dag van de startmaand
  onSelectDate: (date: string) => void
  onClose: () => void
}

const MAAND_NAMEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

const DAG_HEADERS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

function firstOfMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  return `${year}-${String(month!).padStart(2, '0')}-01`
}

function prevMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, 1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function nextMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  const d = new Date(year!, month! - 1, 1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function buildCalendarDays(monthStart: string): Array<{ date: string; isWeekend: boolean } | null> {
  const [year, month] = monthStart.split('-').map(Number)
  const firstDay = new Date(year!, month! - 1, 1)
  // Dag van de week: 0=zo, 1=ma ... 6=za. We willen ma=0.
  const startOffset = (firstDay.getDay() + 6) % 7  // ma=0, di=1, ..., zo=6
  const daysInMonth = new Date(year!, month!, 0).getDate()

  const cells: Array<{ date: string; isWeekend: boolean } | null> = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month!).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(year!, month! - 1, d).getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    cells.push({ date, isWeekend })
  }
  return cells
}

export function MonthPickerPopup({ initialMonth, onSelectDate, onClose }: Props) {
  const [viewMonth, setViewMonth] = useState<string>(() => firstOfMonth(initialMonth))

  const [year, month] = viewMonth.split('-').map(Number)
  const maandNaam = MAAND_NAMEN[month! - 1]
  const days = buildCalendarDays(viewMonth)

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Popup */}
      <div className="absolute bottom-8 left-0 z-50 bg-[#1e1b18] border border-[#3a3530] rounded-lg shadow-xl p-3 w-52">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setViewMonth(prevMonth(viewMonth))}
            className="text-[#4a4540] hover:text-[#e8e2d9] transition-colors cursor-pointer p-0.5"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[#e8e2d9] text-xs font-medium">
            {maandNaam} {year}
          </span>
          <button
            onClick={() => setViewMonth(nextMonth(viewMonth))}
            className="text-[#4a4540] hover:text-[#e8e2d9] transition-colors cursor-pointer p-0.5"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Dagheaders */}
        <div className="grid grid-cols-7 mb-1">
          {DAG_HEADERS.map((h) => (
            <div key={h} className="text-center text-[0.5rem] text-[#4a4540] uppercase">
              {h}
            </div>
          ))}
        </div>

        {/* Dagen */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />
            return (
              <button
                key={cell.date}
                disabled={cell.isWeekend}
                onClick={() => onSelectDate(cell.date)}
                className={[
                  'text-center text-[0.6rem] py-0.5 rounded transition-colors',
                  cell.isWeekend
                    ? 'text-[#3a3530] cursor-default'
                    : 'text-[#c8c2b9] hover:bg-[#3a6b5a] hover:text-white cursor-pointer',
                ].join(' ')}
              >
                {Number(cell.date.split('-')[2])}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
