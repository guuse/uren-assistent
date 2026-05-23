import { useRef } from 'react'
import { mergeConceptsIntoTimeline, computeTimelineBlocks } from './DayTimeline.helpers'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { useAppStore } from '../../store/appStore'

const DAY_START = '08:00'
const DAY_END = '18:00'
const HOUR_HEIGHT_PX = 80

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

function blockHeight(startTime: string, endTime: string): number {
  const mins = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max(36, (mins / 60) * HOUR_HEIGHT_PX)
}

function conceptStatus(block: ClassifiedBlock): 'ok' | 'warn' | 'low' {
  if (!block.projectId || !block.serviceId) return 'warn'
  if (block.confidence < 0.6) return 'low'
  return 'ok'
}

const CONCEPT_STYLES = {
  ok:   { bg: 'bg-[#1a2a1a]', border: 'border border-dashed border-[#5a8a6a]', sub: 'text-[#5a8a6a]', badge: 'bg-[#1a3a1a] text-[#5a8a6a]' },
  warn: { bg: 'bg-[#2a2010]', border: 'border border-dashed border-[#a07848]', sub: 'text-[#a07848]', badge: 'bg-[#3a2e10] text-[#a07848]' },
  low:  { bg: 'bg-[#2a1010]', border: 'border border-dashed border-[#8a3a3a]', sub: 'text-[#8a3a3a]', badge: 'bg-[#3a1010] text-[#8a3a3a]' },
}

interface Props {
  date: string
  entries: HourEntry[]
  suggestions: HourEntrySuggestion[]
  conceptBlocks?: ClassifiedBlock[]
  onBookSuggestion: (suggestion: HourEntrySuggestion) => void
  onEditEntry: (entry: HourEntry) => void
  onConceptClick?: (block: ClassifiedBlock) => void
  onUploadCsv?: (csvContent: string) => void
  isClassifying?: boolean
}

export function DayTimeline({
  date,
  entries,
  suggestions,
  conceptBlocks = [],
  onBookSuggestion,
  onEditEntry,
  onConceptClick,
  onUploadCsv,
  isClassifying = false,
}: Props) {
  const projects = useAppStore((s) => s.projects)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasConcepts = conceptBlocks.length > 0
  const hasEntries = entries.length > 0
  const showCta = !hasConcepts && !hasEntries && !isClassifying

  const blocks = hasConcepts || hasEntries
    ? mergeConceptsIntoTimeline(entries, conceptBlocks, DAY_START, DAY_END)
    : computeTimelineBlocks(entries, suggestions, DAY_START, DAY_END)

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

  async function handleFileDrop(file: File) {
    const text = await file.text()
    onUploadCsv?.(text)
  }

  const pendingCount = conceptBlocks.filter(b => !b.projectId || !b.serviceId).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Hidden file input — één instantie voor de hele component */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) void handleFileDrop(f)
          e.target.value = ''
        }}
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2e2a26] flex items-center gap-4 flex-shrink-0">
        <div>
          <div className="text-[#e8e2d9] font-bold capitalize">{dateLabel}</div>
          {hasConcepts ? (
            <div className="text-[#a07848] text-[0.6875rem] mt-0.5">
              {totalHours}u geboekt · {pendingCount > 0 ? `${pendingCount} concept${pendingCount !== 1 ? 'en' : ''} te bevestigen` : 'alle concepten compleet'}
            </div>
          ) : (
            <div className={`text-[0.6875rem] mt-0.5 ${totalHours >= 8 ? 'text-green-400' : 'text-amber-400'}`}>
              {totalHours}u geboekt · {Math.max(0, 8 - totalHours)}u te gaan
            </div>
          )}
        </div>
        <div className="flex-1 h-[5px] bg-[#2e2a26] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${pct}%` }} />
        </div>
        {(hasConcepts || hasEntries) && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#252220] border border-[#2e2a26] text-[#7a7268] rounded px-[10px] py-[4px] text-[0.625rem] hover:border-[#3e3a36] transition-colors cursor-pointer flex-shrink-0"
          >
            ↑ Nieuwe CSV
          </button>
        )}
      </div>

      {/* Classifying spinner */}
      {isClassifying && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#7a7268] text-[0.75rem]">Bezig met classificeren...</div>
        </div>
      )}

      {/* CTA — geen history */}
      {showCta && (
        <div
          className="flex-1 flex items-center justify-center px-4"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) void handleFileDrop(file)
          }}
        >
          <div className="border-2 border-dashed border-[#3a5a2a] rounded-xl px-8 py-10 flex flex-col items-center gap-3 w-full max-w-sm bg-[#1e2418]">
            <div className="w-12 h-12 bg-[#2a3a20] rounded-full flex items-center justify-center text-[#6aaa4a] text-2xl">↑</div>
            <div className="text-[#e8e2d9] text-[0.8125rem] font-bold text-center">Geen browsergeschiedenis voor deze dag</div>
            <div className="text-[#7a7268] text-[0.625rem] text-center leading-relaxed">
              Upload een Chrome history CSV om deze dag automatisch<br/>te laten invullen via de LLM.
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#e8e2d9] text-[#1c1917] border-none rounded-lg px-5 py-2 text-[0.6875rem] font-bold cursor-pointer hover:bg-[#d5cfc6] transition-colors"
            >
              + Chrome history uploaden
            </button>
            <div className="text-[#4a4540] text-[0.5625rem]">of sleep een .csv bestand hiernaartoe</div>
          </div>
        </div>
      )}

      {/* Tijdlijn */}
      {!showCta && !isClassifying && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex gap-3">
            {/* Uurlabels */}
            <div className="flex flex-col flex-shrink-0 w-8">
              {Array.from({ length: 10 }, (_, i) => i + 8).map((hour) => (
                <div
                  key={hour}
                  className="relative flex-shrink-0"
                  style={{ height: HOUR_HEIGHT_PX }}
                >
                  <span className="absolute top-0 text-[#475569] text-[0.5625rem]">
                    {hour.toString().padStart(2, '0')}
                  </span>
                  <span
                    className="absolute text-[#2e3a4a] text-[0.5rem]"
                    style={{ top: HOUR_HEIGHT_PX / 2 }}
                  >
                    :30
                  </span>
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
                      <div className="text-[#e8e2d9] text-[0.6875rem] font-semibold truncate">
                        {projectName(block.entry.projectId)}
                      </div>
                      <div className="text-indigo-300 text-[0.5625rem]">
                        {block.entry.startTime}–{block.entry.endTime} · {block.entry.hours}u
                      </div>
                      {block.entry.note && (
                        <div className="text-[#64748b] text-[0.5625rem] truncate">{block.entry.note}</div>
                      )}
                    </button>
                  )
                }

                if (block.type === 'concept') {
                  const status = conceptStatus(block.block)
                  const s = CONCEPT_STYLES[status]
                  const badgeLabel = block.block.origin === 'cache'
                    ? 'Cache'
                    : `${Math.round(block.block.confidence * 100)}% zeker`
                  return (
                    <button
                      key={i}
                      onClick={() => onConceptClick?.(block.block)}
                      style={{ height }}
                      className={`relative w-full text-left ${s.bg} ${s.border} rounded px-3 py-1 hover:brightness-110 transition-all cursor-pointer flex flex-col justify-center`}
                    >
                      <span className={`absolute right-2 top-1.5 text-[0.5625rem] px-[6px] py-[2px] rounded ${s.badge}`}>
                        {badgeLabel}
                      </span>
                      <div className="text-[#e8e2d9] text-[0.6875rem] font-semibold truncate pr-16">
                        {block.block.blockName}
                      </div>
                      <div className={`text-[0.5625rem] ${s.sub}`}>
                        {block.block.startTime}–{block.block.endTime}
                        {block.block.projectId ? ` · ${projectName(block.block.projectId)}` : ''}
                      </div>
                      {(!block.block.projectId || !block.block.serviceId) && (
                        <div className="text-[#7a7268] text-[0.5625rem]">⚠ Project ontbreekt — klik om in te vullen</div>
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
                      <div className="text-indigo-400 text-[0.625rem] truncate flex-1 mr-2">
                        → {suggestionLabel(block.suggestion)}
                      </div>
                      <button
                        onClick={() => onBookSuggestion(block.suggestion!)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[0.5625rem] px-2 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
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
      )}
    </div>
  )
}
