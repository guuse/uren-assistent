import { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, LockClosedIcon } from '@heroicons/react/24/outline'

interface Props {
  initialMonth: string  // YYYY-MM-DD van de eerste dag van de startmaand
  onSelectDate: (date: string) => void
  onClose: () => void
  // Calendar dropdown markings: which dates fall in a submitted ("ingediende") week.
  isDateSubmitted?: (date: string) => boolean
  // Fired on mount and whenever the visible month changes, so the parent can lazily
  // fetch + cache submission status for that month.
  onMonthChange?: (monthStartDate: string) => void
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

export function MonthPickerPopup({ initialMonth, onSelectDate, onClose, isDateSubmitted, onMonthChange }: Props) {
  const [viewMonth, setViewMonth] = useState<string>(() => firstOfMonth(initialMonth))

  const [year, month] = viewMonth.split('-').map(Number)
  const maandNaam = MAAND_NAMEN[month! - 1]
  const days = buildCalendarDays(viewMonth)

  const today = new Date().toISOString().split('T')[0]!

  // Lazily load submission status for the visible month (on mount + on navigation).
  useEffect(() => {
    onMonthChange?.(viewMonth)
  }, [viewMonth, onMonthChange])

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Popup */}
      <div
        className="absolute top-8 right-0 z-50"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 9,
          boxShadow: '0 4px 16px rgba(0,0,0,0.09)',
          padding: 12,
          width: 210,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button
            onClick={() => setViewMonth(prevMonth(viewMonth))}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <ChevronLeftIcon style={{ width: 14, height: 14 }} />
          </button>
          <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 500 }}>
            {maandNaam} {year}
          </span>
          <button
            onClick={() => setViewMonth(nextMonth(viewMonth))}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <ChevronRightIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Dagheaders */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {DAG_HEADERS.map((h) => (
            <div
              key={h}
              style={{
                textAlign: 'center',
                fontSize: 8,
                fontWeight: 600,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Dagen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }}>
          {days.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />
            const isToday = cell.date === today
            const isSubmitted = !cell.isWeekend && (isDateSubmitted?.(cell.date) ?? false)
            const isMonday = new Date(`${cell.date}T12:00:00`).getDay() === 1
            const showLock = isSubmitted && isMonday
            return (
              <button
                key={cell.date}
                disabled={cell.isWeekend}
                onClick={() => onSelectDate(cell.date)}
                title={isSubmitted ? 'Ingediend' : undefined}
                style={{
                  position: 'relative',
                  textAlign: 'center',
                  fontSize: '0.6rem',
                  paddingTop: 2,
                  paddingBottom: 2,
                  borderRadius: 4,
                  border: 'none',
                  cursor: cell.isWeekend ? 'default' : 'pointer',
                  ...(cell.isWeekend
                    ? { color: 'var(--text-faint)', background: 'transparent' }
                    : isSubmitted
                      ? { background: '#f0fdf4', color: '#15803d', fontWeight: isToday ? 700 : 600 }
                      : isToday
                        ? { background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 700 }
                        : { color: 'var(--text-primary)', background: 'transparent' }
                  ),
                }}
                onMouseEnter={(e) => {
                  if (!cell.isWeekend && !isToday && !isSubmitted) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!cell.isWeekend && !isToday && !isSubmitted) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  }
                }}
              >
                {showLock && (
                  <LockClosedIcon
                    style={{ width: 7, height: 7, position: 'absolute', top: 1, right: 1, color: '#15803d' }}
                    strokeWidth={2.5}
                  />
                )}
                {Number(cell.date.split('-')[2])}
              </button>
            )
          })}
        </div>

        {/* Ga naar vandaag */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            onClick={() => onSelectDate(today)}
            style={{
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Ga naar vandaag
          </button>
        </div>
      </div>
    </>
  )
}
