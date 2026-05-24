import { useRef, useState, useCallback, useEffect } from 'react'
import { mergeConceptsIntoTimeline, computeTimelineBlocks } from './DayTimeline.helpers'
import type { TimelineBlock } from './DayTimeline.helpers'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { GitHubCommit } from '../../domain/entities/GitHubCommit'
import type { LinearIssue } from '../../domain/entities/LinearIssue'
import { useAppStore } from '../../store/appStore'
import { pixelToMinutes, snapToInterval, minutesToTime, swapIfNeeded } from './DragOverlay'
import EvidencePanel from './EvidencePanel'

const DAY_START = '08:00'
const DAY_END = '18:00'
const HOUR_HEIGHT_PX = 80

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}


const CONFIDENCE_COLORS: Record<1 | 2 | 3 | 4 | 5, { bg: string; border: string; sub: string; badge: string }> = {
  5: { bg: 'bg-[#1a2a1a]', border: 'border border-dashed border-[#5a8a6a]', sub: 'text-[#5a8a6a]', badge: 'bg-[#1a3a1a] text-[#5a8a6a]' },
  4: { bg: 'bg-[#1e2a18]', border: 'border border-dashed border-[#6a8a50]', sub: 'text-[#6a8a50]', badge: 'bg-[#203018] text-[#6a8a50]' },
  3: { bg: 'bg-[#2a2510]', border: 'border border-dashed border-[#8a7a40]', sub: 'text-[#8a7a40]', badge: 'bg-[#332e10] text-[#8a7a40]' },
  2: { bg: 'bg-[#2a1c10]', border: 'border border-dashed border-[#a06030]', sub: 'text-[#a06030]', badge: 'bg-[#332210] text-[#a06030]' },
  1: { bg: 'bg-[#2a1010]', border: 'border border-dashed border-[#8a3a3a]', sub: 'text-[#8a3a3a]', badge: 'bg-[#3a1010] text-[#8a3a3a]' },
}

const WARN_STYLE = { bg: 'bg-[#2a2010]', border: 'border border-dashed border-[#a07848]', sub: 'text-[#a07848]', badge: 'bg-[#3a2e10] text-[#a07848]' }

function blockStyle(block: ClassifiedBlock) {
  if (!block.projectId || !block.serviceId) return WARN_STYLE
  return CONFIDENCE_COLORS[block.confidence]
}

interface Props {
  date: string
  entries: HourEntry[]
  suggestions: HourEntrySuggestion[]
  conceptBlocks?: ClassifiedBlock[]
  commits?: GitHubCommit[]
  linearIssues?: LinearIssue[]
  onBookSuggestion: (suggestion: HourEntrySuggestion) => void
  onEditEntry: (entry: HourEntry) => void
  onConceptClick?: (block: ClassifiedBlock) => void
  onUploadCsv?: (csvContent: string) => void
  isClassifying?: boolean
  onDragNew?: (startTime: string, endTime: string) => void
  onProcessDay?: () => void
}

export function DayTimeline({
  date,
  entries,
  suggestions,
  conceptBlocks = [],
  commits = [],
  linearIssues = [],
  onBookSuggestion,
  onEditEntry,
  onConceptClick,
  onUploadCsv,
  isClassifying = false,
  onDragNew,
  onProcessDay,
}: Props) {
  const projects = useAppStore((s) => s.projects)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const blocksContainerRef = useRef<HTMLDivElement>(null)

  // Drag-to-book state
  const [dragState, setDragState] = useState<{ startMin: number; endMin: number } | null>(null)
  const isDragging = useRef(false)

  const getMinutesFromEvent = useCallback((e: MouseEvent) => {
    const rect = blocksContainerRef.current!.getBoundingClientRect()
    const y = Math.max(0, Math.min(e.clientY - rect.top, HOUR_HEIGHT_PX * 10))
    return snapToInterval(pixelToMinutes(y, HOUR_HEIGHT_PX * 10, 8 * 60), 30)
  }, [])

  function handleBlocksMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!onDragNew) return
    if (e.button !== 0) return
    // Only start drag on the container itself or gap/empty blocks — not on interactive blocks
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    e.preventDefault()
    const startMin = getMinutesFromEvent(e.nativeEvent)
    isDragging.current = true
    setDragState({ startMin, endMin: startMin })
  }

  useEffect(() => {
    if (!onDragNew) return

    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return
      const endMin = getMinutesFromEvent(e)
      setDragState((prev) => prev ? { ...prev, endMin } : prev)
    }

    function handleMouseUp() {
      if (!isDragging.current) return
      isDragging.current = false
      setDragState((prev) => {
        if (!prev) return null
        const { start, end } = swapIfNeeded(prev.startMin, prev.endMin)
        if (end - start >= 30) {
          onDragNew!(minutesToTime(start), minutesToTime(end))
        }
        return null
      })
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isDragging.current) {
        isDragging.current = false
        setDragState(null)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onDragNew, getMinutesFromEvent])

  const hasConcepts = conceptBlocks.length > 0
  const hasEntries = entries.length > 0
  const showEmptyHint = !hasConcepts && !hasEntries && !isClassifying

  const flatBlocks = hasConcepts || hasEntries
    ? mergeConceptsIntoTimeline(entries, conceptBlocks, DAY_START, DAY_END)
    : computeTimelineBlocks(entries, suggestions, DAY_START, DAY_END)

  const DAY_START_MIN = timeToMinutes(DAY_START)
  const TOTAL_MINS = timeToMinutes(DAY_END) - DAY_START_MIN
  const TOTAL_PX = HOUR_HEIGHT_PX * 10

  function blockTop(startTime: string): number {
    return ((timeToMinutes(startTime) - DAY_START_MIN) / TOTAL_MINS) * TOTAL_PX
  }
  function blockPx(startTime: string, endTime: string): number {
    const mins = timeToMinutes(endTime) - timeToMinutes(startTime)
    return Math.max(24, (mins / TOTAL_MINS) * TOTAL_PX)
  }

  // If there are both entries and concepts: entries left 59%, concepts right 40%
  // If only concepts: full width
  function renderBlock(block: TimelineBlock, height: number, key: string | number, positionStyle?: React.CSSProperties) {
    const baseStyle: React.CSSProperties = { height, ...positionStyle }

    if (block.type === 'entry') {
      return (
        <button
          key={key}
          onClick={() => onEditEntry(block.entry)}
          style={baseStyle}
          className="text-left bg-[#1e3a5f] border-l-[3px] border-[#4a8abf] rounded-r px-3 py-1 hover:bg-[#254a72] transition-colors cursor-pointer flex flex-col justify-center overflow-hidden"
        >
          <div className="text-[#e8e2d9] text-[0.6875rem] font-semibold truncate">
            {projectName(block.entry.projectId)}
          </div>
          <div className="text-[#7ab8e8] text-[0.5625rem] truncate">
            {block.entry.startTime}–{block.entry.endTime} · {block.entry.hours}u
          </div>
          {block.entry.note && height > 52 && (
            <div className="text-[#5a8aaa] text-[0.5625rem] truncate">{block.entry.note}</div>
          )}
        </button>
      )
    }

    if (block.type === 'concept') {
      const s = blockStyle(block.block)
      const badgeLabel = block.block.origin === 'cache'
        ? 'Cache'
        : `${block.block.confidence}/5`
      return (
        <button
          key={key}
          onClick={() => onConceptClick?.(block.block)}
          style={baseStyle}
          className={`relative text-left ${s.bg} ${s.border} rounded px-3 py-1 hover:brightness-110 transition-all cursor-pointer flex flex-col justify-center overflow-hidden`}
        >
          <span className={`absolute right-2 top-1.5 text-[0.5625rem] px-[6px] py-[2px] rounded ${s.badge}`}>
            {badgeLabel}
          </span>
          <div className="text-[#e8e2d9] text-[0.6875rem] font-semibold truncate pr-16">
            {block.block.blockName}
          </div>
          <div className={`text-[0.5625rem] truncate ${s.sub}`}>
            {block.block.startTime}–{block.block.endTime}
            {block.block.projectId ? ` · ${projectName(block.block.projectId)}` : ''}
          </div>
          {(!block.block.projectId || !block.block.serviceId) && height > 52 && (
            <div className="text-[#7a7268] text-[0.5625rem] truncate">⚠ Project ontbreekt — klik om in te vullen</div>
          )}
        </button>
      )
    }

    // gap
    if (block.suggestion) {
      return (
        <div
          key={key}
          style={baseStyle}
          className="border-b border-[#2e2a26] px-3 py-1 flex items-center justify-between"
        >
          <div className="text-[#4a4540] text-[0.625rem] truncate flex-1 mr-2">
            → {suggestionLabel(block.suggestion)}
          </div>
          <button
            onClick={() => onBookSuggestion(block.suggestion!)}
            className="bg-[#1e3a2a] hover:bg-[#254a36] text-[#5a8a6a] border border-[#3a6a4a] text-[0.5625rem] px-2 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
          >
            + Boek
          </button>
        </div>
      )
    }

    return (
      <div
        key={key}
        style={baseStyle}
        className="border-b border-[#2e2a26]"
      />
    )
  }

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
        {onProcessDay && (
          <button
            onClick={onProcessDay}
            className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[0.625rem] font-semibold px-3 py-[5px] rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            ▶ Verwerk dag
          </button>
        )}
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

      {/* Lege staat hint */}
      {showEmptyHint && (
        <div
          className="flex-1 relative"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) void handleFileDrop(file)
          }}
        >
          {/* Tijdlijn raster ook in lege staat */}
          <div className="overflow-y-auto px-4 py-3 h-full">
            <div className="flex gap-3">
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
              <div className="flex-1 relative" style={{ minHeight: HOUR_HEIGHT_PX * 10 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className="border-t border-[#1e1b18]"
                    style={{ height: HOUR_HEIGHT_PX }}
                  />
                ))}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-[#2e2a26] text-[0.75rem]">
                    Klik op{' '}
                    <strong className="text-[#3e3a36]">Verwerk dag</strong>
                    {' '}om voorstellen te genereren
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tijdlijn */}
      {!showEmptyHint && !isClassifying && (
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

            {/* Blokken — omhullende div voor drag */}
            <div
              ref={blocksContainerRef}
              className="flex-1 relative"
              style={{
                minHeight: HOUR_HEIGHT_PX * 10,
                cursor: onDragNew ? (dragState ? 'ns-resize' : 'crosshair') : undefined,
                userSelect: onDragNew ? 'none' : undefined,
              }}
              onMouseDown={handleBlocksMouseDown}
            >
              {/* Drag preview-blok */}
              {dragState && (() => {
                const { start, end } = swapIfNeeded(dragState.startMin, dragState.endMin)
                const top = ((start - 8 * 60) / 600) * (HOUR_HEIGHT_PX * 10)
                const height = Math.max(1, ((end - start) / 600) * (HOUR_HEIGHT_PX * 10))
                const durationMins = end - start
                const durationLabel = durationMins >= 60 ? `${durationMins / 60}u` : `${durationMins}m`
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top,
                      left: 0,
                      right: 0,
                      height,
                      background: 'rgba(90,138,106,0.2)',
                      border: '2px dashed #5a8a6a',
                      borderRadius: 4,
                      pointerEvents: 'none',
                      zIndex: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '0 8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ color: '#5a8a6a', fontSize: '0.6875rem', fontWeight: 600 }}>
                      {minutesToTime(start)} – {minutesToTime(end)}
                    </div>
                    {height > 36 && (
                      <div style={{ color: '#5a8a6a', fontSize: '0.5625rem', opacity: 0.8 }}>
                        {durationLabel} · loslaten om te boeken
                      </div>
                    )}
                  </div>
                )
              })()}
               <div className="absolute inset-0">
                {(() => {
                  // Column-packing: assign each entry/concept to the first column where it fits.
                  // Sort by duration ascending first so shorter blocks go left, longer blocks right.
                  const contentBlocks = flatBlocks.filter(b => b.type === 'entry' || b.type === 'concept')
                  const sortedByDuration = [...contentBlocks].sort((a, b) => {
                    const durA = timeToMinutes(a.endTime) - timeToMinutes(a.startTime)
                    const durB = timeToMinutes(b.endTime) - timeToMinutes(b.startTime)
                    if (durA !== durB) return durA - durB  // kortste eerst → links
                    return a.startTime.localeCompare(b.startTime)  // gelijke duur: vroegste eerst
                  })
                  // columnEndMin[i] = the end time (in minutes) of the last block placed in column i
                  const columnEndMin: number[] = []

                  const blockColumns = sortedByDuration.map(block => {
                    const startMin = timeToMinutes(block.startTime)
                    // Find first column where this block fits
                    let col = columnEndMin.findIndex(endMin => startMin >= endMin)
                    if (col === -1) {
                      col = columnEndMin.length
                      columnEndMin.push(0)
                    }
                    columnEndMin[col] = timeToMinutes(block.endTime)
                    return { block, col }
                  })

                  const numCols = Math.max(1, columnEndMin.length)
                  const colWidthPct = 100 / numCols

                  // Render gap blocks first (always column 0, full width only if no content blocks)
                  const gapElements = flatBlocks
                    .filter(b => b.type === 'gap' && b.suggestion)
                    .map((block, i) => {
                      if (block.type !== 'gap') return null
                      const top = blockTop(block.startTime)
                      const height = blockPx(block.startTime, block.endTime)
                      // Gaps fill column 0 width (or full width if single column)
                      const width = `${colWidthPct}%`
                      return (
                        <div
                          key={`gap-${i}`}
                          style={{ position: 'absolute', top, left: 0, width, height }}
                          className="border-b border-[#2e2a26] px-3 py-1 flex items-center justify-between"
                        >
                          <div className="text-[#4a4540] text-[0.625rem] truncate flex-1 mr-2">
                            → {suggestionLabel(block.suggestion!)}
                          </div>
                          <button
                            onClick={() => onBookSuggestion(block.suggestion!)}
                            className="bg-[#1e3a2a] hover:bg-[#254a36] text-[#5a8a6a] border border-[#3a6a4a] text-[0.5625rem] px-2 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
                          >
                            + Boek
                          </button>
                        </div>
                      )
                    })

                  // Render content blocks in their assigned columns
                  const contentElements = blockColumns.map(({ block, col }, i) => {
                    const top = blockTop(block.startTime)
                    const height = blockPx(block.startTime, block.endTime)
                    const left = `${col * colWidthPct}%`
                    const width = `${colWidthPct}%`
                    return renderBlock(block, height, `content-${i}`, {
                      position: 'absolute', top, left, width,
                    })
                  })

                  return [...gapElements, ...contentElements]
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence panel — GitHub commits + Linear issues voor deze dag */}
      {(commits.length > 0 || linearIssues.length > 0) && (
        <div className="flex-shrink-0 border-t border-[#2e2a26] px-4 py-3">
          <div className="text-[#7a7268] text-[0.5625rem] font-semibold uppercase tracking-wide mb-2">
            Context voor deze dag
          </div>
          <EvidencePanel commits={commits} linearIssues={linearIssues} />
        </div>
      )}
    </div>
  )
}
