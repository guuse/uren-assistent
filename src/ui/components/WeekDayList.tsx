import { useState } from 'react'
import { TrashIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import { ConfirmDialog } from './ConfirmDialog'
import { MonthPickerPopup } from './MonthPickerPopup'

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
  onUploadCsv?: () => void
  processingStateForDate?: (date: string) => DayProcessingState
  isProcessingWeek?: boolean
  llmBlockCountForDate?: (date: string) => number
  onClearDayBlocks?: (date: string) => Promise<void>
  isClearingDay?: boolean
  clearError?: string | null
  onClearWeekBlocks?: () => Promise<void>
  isClearingWeek?: boolean
  clearWeekError?: string | null
  totalLlmBlockCount?: number
  isCurrentWeek?: boolean
  onGoToCurrentWeek?: () => void
  onGoToDate?: (date: string) => void
}

const TARGET_HOURS = 8

function ProgressBar({ hours }: { hours: number }) {
  const pct = Math.min(100, (hours / TARGET_HOURS) * 100)
  const color = hours >= TARGET_HOURS
    ? 'var(--success)'
    : hours > 0
      ? 'var(--warning)'
      : 'transparent'
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 100, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', borderRadius: 100, transition: 'width 0.3s', width: `${pct}%`, background: color }} />
    </div>
  )
}

const iconBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
  flexShrink: 0, padding: 0, fontFamily: 'inherit', ...extra,
})

export function WeekDayList({
  weekDays,
  selectedDate,
  hoursForDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  weekLabel,
  onProcessWeek,
  onUploadCsv,
  processingStateForDate,
  isProcessingWeek,
  llmBlockCountForDate,
  onClearDayBlocks,
  isClearingDay,
  clearError,
  onClearWeekBlocks,
  isClearingWeek,
  clearWeekError,
  totalLlmBlockCount,
  isCurrentWeek,
  onGoToCurrentWeek,
  onGoToDate,
}: Props) {
  const [confirmClearDate, setConfirmClearDate] = useState<string | null>(null)
  const [confirmClearWeek, setConfirmClearWeek] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  const rangeLabel = weekDays.length >= 2
    ? (() => {
        const fmt = (d: string) => {
          const dt = new Date(d)
          return `${dt.getDate()} ${dt.toLocaleString('nl-NL', { month: 'short' })}`
        }
        return `${fmt(weekDays[0]!)}–${fmt(weekDays[weekDays.length - 1]!)}`
      })()
    : ''

  const totalHours = weekDays.reduce((s, d) => s + hoursForDate(d), 0)
  const weekPct = Math.min(100, (totalHours / 40) * 100)

  return (
    <div
      style={{
        width: 214, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Week title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{weekLabel}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{rangeLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            <button style={iconBtn()} onClick={onPrevWeek} title="Vorige week">‹</button>
            <button style={iconBtn()} onClick={onNextWeek} title="Volgende week">›</button>
          </div>
        </div>

        {/* Nu-knop + maandkiezer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 7 }}>
          {!isCurrentWeek && (
            <button
              onClick={onGoToCurrentWeek}
              style={{
                background: 'var(--accent-light)', color: 'var(--accent)',
                border: '1px solid var(--accent-border)', fontSize: 11, fontWeight: 700,
                padding: '4px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Nu
            </button>
          )}
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...iconBtn(), border: '1px solid transparent' }}
              onClick={() => setShowMonthPicker((v) => !v)}
              title="Kies datum"
            >
              <CalendarDaysIcon style={{ width: 13, height: 13 }} strokeWidth={2} />
            </button>
            {showMonthPicker && (
              <div style={{ position: 'absolute', top: 30, right: 0, zIndex: 50 }}>
                <MonthPickerPopup
                  initialMonth={selectedDate}
                  onSelectDate={(d) => { onGoToDate?.(d); setShowMonthPicker(false) }}
                  onClose={() => setShowMonthPicker(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Week progress */}
        <div style={{ marginTop: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Weekvoortgang
            </span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>
              {totalHours.toFixed(1).replace('.', ',')}/40u
            </span>
          </div>
          <div style={{ height: 4, background: '#f0ede8', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 100, width: `${weekPct}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Day list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {weekDays.map((date) => {
          const isSelected = date === selectedDate
          const hours = hoursForDate(date)
          const dayOfWeek = new Date(date).getDay().toString()
          const label = DAY_LABELS[dayOfWeek] ?? '??'
          const dt = new Date(date)
          const dateLabel = `${dt.getDate()} ${dt.toLocaleString('nl-NL', { month: 'short' })}`
          const processingState = processingStateForDate?.(date) ?? 'idle'
          const llmCount = llmBlockCountForDate?.(date) ?? 0

          return (
            <div
              key={date}
              onClick={() => onSelectDate(date)}
              style={{
                padding: isSelected ? '9px 14px 9px 11px' : '9px 14px',
                borderBottom: '1px solid var(--border)',
                borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                background: isSelected ? 'var(--accent-light)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dateLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ flex: 1 }}>
                  <ProgressBar hours={hours} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {hours > 0 ? `${hours.toFixed(1).replace('.', ',')}u` : '–'}
                  {hours >= TARGET_HOURS ? ' ✓' : ''}
                </span>
                {llmCount > 0 && onClearDayBlocks && (
                  <button
                    title={`Wis ${llmCount} LLM-blok${llmCount !== 1 ? 'ken' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setConfirmClearDate(date) }}
                    style={{ ...iconBtn(), color: 'var(--danger)', borderColor: '#fecaca' }}
                  >
                    <TrashIcon style={{ width: 11, height: 11 }} strokeWidth={2} />
                  </button>
                )}
              </div>
              {processingState === 'classifying' && (
                <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 3 }}>Verwerken…</div>
              )}
              {processingState === 'error' && (
                <div style={{ fontSize: 9, color: 'var(--danger)', marginTop: 3 }}>Fout bij verwerken</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {(clearError || clearWeekError) && (
          <div style={{ fontSize: 10, color: 'var(--danger)' }}>{clearError ?? clearWeekError}</div>
        )}
        {totalLlmBlockCount != null && totalLlmBlockCount > 0 && onClearWeekBlocks && (
          <button
            onClick={() => setConfirmClearWeek(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, border: '1px solid #fecaca', borderRadius: 7, padding: '5px 10px',
              fontSize: 11, fontWeight: 600, color: 'var(--danger)', background: '#fff1f2',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <TrashIcon style={{ width: 12, height: 12 }} strokeWidth={2} />
            Wis week ({totalLlmBlockCount})
          </button>
        )}
        {onProcessWeek && (
          <button
            onClick={onProcessWeek}
            disabled={isProcessingWeek}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, background: 'var(--accent)', color: 'white', border: 'none',
              borderRadius: 7, padding: '7px 12px', fontSize: 11, fontWeight: 600,
              cursor: isProcessingWeek ? 'not-allowed' : 'pointer', opacity: isProcessingWeek ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {isProcessingWeek ? 'Bezig…' : 'Verwerk week'}
          </button>
        )}
        {onUploadCsv && (
          <button
            onClick={onUploadCsv}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            CSV uploaden
          </button>
        )}
      </div>

      {/* Confirm: clear day */}
      {confirmClearDate && (
        <ConfirmDialog
          title="LLM-blokken wissen"
          description={`Wis alle LLM-blokken voor ${confirmClearDate}?`}
          confirmLabel="Wissen"
          onConfirm={async () => { await onClearDayBlocks?.(confirmClearDate); setConfirmClearDate(null) }}
          onCancel={() => setConfirmClearDate(null)}
          isLoading={isClearingDay ?? false}
        />
      )}

      {/* Confirm: clear week */}
      {confirmClearWeek && (
        <ConfirmDialog
          title="Week wissen"
          description="Wis alle LLM-blokken voor deze week?"
          confirmLabel="Wissen"
          onConfirm={async () => { await onClearWeekBlocks?.(); setConfirmClearWeek(false) }}
          onCancel={() => setConfirmClearWeek(false)}
          isLoading={isClearingWeek ?? false}
        />
      )}
    </div>
  )
}
