import { computeTimelineBlocks } from './DayTimeline.helpers'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import { useAppStore } from '../../store/appStore'

const DAY_START = '08:00'
const DAY_END = '18:00'
const HOUR_HEIGHT_PX = 48

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function blockHeight(startTime: string, endTime: string): number {
  const mins = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max(24, (mins / 60) * HOUR_HEIGHT_PX)
}

interface Props {
  date: string
  entries: HourEntry[]
  suggestions: HourEntrySuggestion[]
  onBookSuggestion: (suggestion: HourEntrySuggestion) => void
  onEditEntry: (entry: HourEntry) => void
}

export function DayTimeline({ date, entries, suggestions, onBookSuggestion, onEditEntry }: Props) {
  const projects = useAppStore((s) => s.projects)
  const blocks = computeTimelineBlocks(entries, suggestions, DAY_START, DAY_END)

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const pct = Math.min(100, (totalHours / 8) * 100)
  const progressColor = totalHours >= 8 ? 'bg-green-500' : totalHours > 0 ? 'bg-amber-500' : 'bg-[#374151]'

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  function projectName(projectId: string): string {
    return projects.find((p) => p.id === projectId)?.name ?? projectId
  }

  function suggestionLabel(s: HourEntrySuggestion): string {
    const name = projectName(s.projectId)
    const reason = s.reason === 'last-week' ? 'vorige week' : 'patroon'
    const time = s.startTime ? ` · ${s.startTime}–${s.endTime}` : ''
    return `${name}${time} (${reason})`
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2e2a26] flex items-center gap-4 flex-shrink-0">
        <div>
          <div className="text-[#e8e2d9] font-bold capitalize">{dateLabel}</div>
          <div className={`text-[11px] mt-0.5 ${totalHours >= 8 ? 'text-green-400' : 'text-amber-400'}`}>
            {totalHours}u geboekt · {Math.max(0, 8 - totalHours)}u te gaan
          </div>
        </div>
        <div className="flex-1 h-[5px] bg-[#2e2a26] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Tijdlijn */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex gap-3">
          {/* Uurlabels */}
          <div className="flex flex-col flex-shrink-0 w-8">
            {Array.from({ length: 10 }, (_, i) => i + 8).map((hour) => (
              <div
                key={hour}
                className="text-[#475569] text-[9px] flex items-start"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                {hour.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Blokken */}
          <div className="flex-1 flex flex-col gap-[1px]">
            {blocks.map((block, i) => {
              const height = blockHeight(block.startTime, block.endTime)

              if (block.type === 'entry') {
                return (
                  <button
                    key={i}
                    onClick={() => onEditEntry(block.entry)}
                    style={{ height }}
                    className="w-full text-left bg-indigo-950 border-l-[3px] border-indigo-500 rounded-r px-3 py-1 hover:bg-indigo-900 transition-colors cursor-pointer flex flex-col justify-center"
                  >
                    <div className="text-[#e8e2d9] text-[11px] font-semibold truncate">
                      {projectName(block.entry.projectId)}
                    </div>
                    <div className="text-indigo-300 text-[9px]">
                      {block.entry.startTime}–{block.entry.endTime} · {block.entry.hours}u
                    </div>
                    {block.entry.note && (
                      <div className="text-[#64748b] text-[9px] truncate">{block.entry.note}</div>
                    )}
                  </button>
                )
              }

              // gap
              if (block.suggestion) {
                return (
                  <div
                    key={i}
                    style={{ height }}
                    className="w-full bg-[#1a2332] border border-dashed border-indigo-800 rounded px-3 py-1 flex items-center justify-between"
                  >
                    <div className="text-indigo-400 text-[10px] truncate flex-1 mr-2">
                      → {suggestionLabel(block.suggestion)}
                    </div>
                    <button
                      onClick={() => onBookSuggestion(block.suggestion!)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] px-2 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
                    >
                      + Boek
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={i}
                  style={{ height }}
                  className="w-full bg-[#16213e] rounded border border-[#1e293b]"
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
