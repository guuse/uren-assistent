import { useState } from 'react'
import { Trash2, CalendarDays } from 'lucide-react'
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
  onUploadCsv,
  processingStateForDate,
  isProcessingWeek = false,
  llmBlockCountForDate,
  onClearDayBlocks,
  isClearingDay = false,
  clearError,
  onClearWeekBlocks,
  isClearingWeek = false,
  clearWeekError,
  totalLlmBlockCount = 0,
  isCurrentWeek = true,
  onGoToCurrentWeek,
  onGoToDate,
}: Props) {
  const [confirmDate, setConfirmDate] = useState<string | null>(null)
  const [confirmWeek, setConfirmWeek] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

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
          const llmCount = llmBlockCountForDate?.(date) ?? 0
          const canClear = llmCount > 0 && !!onClearDayBlocks

          return (
            <div
              key={date}
              className={`relative px-2 py-2 rounded-lg transition-colors ${
                isSelected
                  ? 'bg-[#252220] border border-[#6366f1]'
                  : 'hover:bg-[#252220] border border-transparent'
              }`}
            >
              {/* Klikbaar gebied voor dagelectie */}
              <button
                onClick={() => onSelectDate(date)}
                className="w-full text-left cursor-pointer"
              >
                <div className="flex justify-between items-center pr-4">
                  <span
                    className={`text-[0.625rem] font-semibold ${
                      isSelected ? 'text-[#a5b4fc]' : isFull ? 'text-[#94a3b8]' : 'text-[#64748b]'
                    }`}
                  >
                    {label} {dayOfMonth}
                  </span>
                  <div className="flex items-center gap-1">
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
              {/* Prullenbak absoluut rechts bovenin de kaart */}
              {canClear && (
                <button
                  onClick={() => setConfirmDate(date)}
                  title={`${llmCount} LLM-blok${llmCount !== 1 ? 'ken' : ''} verwijderen`}
                  className="absolute top-2 right-1.5 p-0.5 rounded transition-colors text-red-500/50 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 size={9} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {(onProcessWeek || onUploadCsv || (onClearWeekBlocks && totalLlmBlockCount > 0)) && (
        <div className="mt-2 px-1 flex flex-col gap-1.5">
          {onClearWeekBlocks && totalLlmBlockCount > 0 && (
            <button
              onClick={() => setConfirmWeek(true)}
              disabled={isClearingWeek}
              className="w-full bg-transparent border border-red-900/50 hover:border-red-800/70 disabled:opacity-40 text-red-500/70 hover:text-red-400 text-[0.5625rem] py-[7px] px-2 rounded-lg transition-colors cursor-pointer disabled:cursor-default flex items-center justify-center gap-1.5"
            >
              <Trash2 size={9} />
              {isClearingWeek ? 'Bezig...' : `Opruimen (${totalLlmBlockCount})`}
            </button>
          )}
          {onProcessWeek && (
            <button
              onClick={onProcessWeek}
              disabled={isProcessingWeek}
              className="w-full bg-[#6366f1] hover:bg-[#5558dd] disabled:opacity-40 text-white text-[0.6875rem] font-bold py-[8px] rounded-lg transition-colors cursor-pointer disabled:cursor-default"
            >
              {isProcessingWeek ? 'Bezig...' : '▶ Verwerk week'}
            </button>
          )}
          {onUploadCsv && (
            <button
              onClick={onUploadCsv}
              className="w-full bg-transparent border border-[#2e2a26] hover:border-[#3e3a36] text-[#4a4540] hover:text-[#7a7268] text-[0.5625rem] py-[5px] rounded-lg transition-colors cursor-pointer"
            >
              📂 Upload geschiedenis
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <div className="flex justify-between items-center px-1 mt-2">
          <button
            onClick={onPrevWeek}
            className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
          >
            ‹
          </button>
          {!isCurrentWeek && onGoToCurrentWeek ? (
            <button
              onClick={onGoToCurrentWeek}
              className="bg-[#3a6b5a] hover:bg-[#4a7a6a] text-white text-[0.6rem] font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
            >
              Nu
            </button>
          ) : (
            <span className="text-[#4a4540] text-[0.5rem]">{weekLabel}</span>
          )}
          <button
            onClick={onNextWeek}
            className="text-[#4a4540] hover:text-[#e8e2d9] text-sm transition-colors cursor-pointer"
          >
            ›
          </button>
        </div>
        {onGoToDate && (
          <button
            onClick={() => setIsPickerOpen((v) => !v)}
            className="absolute -top-0.5 right-1 text-[#4a4540] hover:text-[#e8e2d9] transition-colors cursor-pointer"
            title="Kies een dag"
          >
            <CalendarDays size={12} />
          </button>
        )}
        {isPickerOpen && onGoToDate && (
          <MonthPickerPopup
            initialMonth={weekDays[0]!}
            onSelectDate={(date) => {
              onGoToDate(date)
              setIsPickerOpen(false)
            }}
            onClose={() => setIsPickerOpen(false)}
          />
        )}
      </div>

      {confirmDate && onClearDayBlocks && (
        <ConfirmDialog
          title="LLM-blokken verwijderen?"
          description={`${llmBlockCountForDate?.(confirmDate) ?? 0} ongebookte LLM-concept${(llmBlockCountForDate?.(confirmDate) ?? 0) !== 1 ? 'en' : ''} van deze dag worden verwijderd. Geschreven uren blijven staan.`}
          isLoading={isClearingDay}
          onConfirm={async () => {
            try {
              await onClearDayBlocks(confirmDate)
            } finally {
              setConfirmDate(null)
            }
          }}
          onCancel={() => setConfirmDate(null)}
        />
      )}

      {confirmWeek && onClearWeekBlocks && (
        <ConfirmDialog
          title="Hele week opruimen?"
          description={`${totalLlmBlockCount} ongebookte LLM-concept${totalLlmBlockCount !== 1 ? 'en' : ''} van deze week worden verwijderd. Geschreven uren blijven staan.`}
          isLoading={isClearingWeek}
          onConfirm={async () => {
            try {
              await onClearWeekBlocks()
            } finally {
              setConfirmWeek(false)
            }
          }}
          onCancel={() => setConfirmWeek(false)}
        />
      )}

      {clearError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-900/80 text-red-200 text-xs px-3 py-2 rounded-lg">
          {clearError}
        </div>
      )}

      {clearWeekError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-900/80 text-red-200 text-xs px-3 py-2 rounded-lg">
          {clearWeekError}
        </div>
      )}
    </div>
  )
}
