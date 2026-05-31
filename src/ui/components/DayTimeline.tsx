import { useRef, useState, useCallback, useEffect } from 'react'
import { mergeConceptsIntoTimeline, computeTimelineBlocks, assignBlockColumns } from './DayTimeline.helpers'
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


const CONFIDENCE_COLORS: Record<1 | 2 | 3 | 4 | 5, {
  bg: string; borderStyle: string; borderColor: string; borderLeft: string;
  titleColor: string; subColor: string; badgeBg: string; badgeColor: string
}> = {
  5: { bg: '#f0fdf4', borderStyle: 'solid',  borderColor: '#86efac', borderLeft: '#16a34a', titleColor: '#14532d', subColor: '#16a34a', badgeBg: '#dcfce7', badgeColor: '#16a34a' },
  4: { bg: '#f0fdf4', borderStyle: 'solid',  borderColor: '#86efac', borderLeft: '#16a34a', titleColor: '#14532d', subColor: '#16a34a', badgeBg: '#dcfce7', badgeColor: '#16a34a' },
  3: { bg: '#fffbeb', borderStyle: 'solid',  borderColor: '#fcd34d', borderLeft: '#d97706', titleColor: '#78350f', subColor: '#d97706', badgeBg: '#fef3c7', badgeColor: '#d97706' },
  2: { bg: '#fff1f2', borderStyle: 'dashed', borderColor: '#fca5a5', borderLeft: '#ef4444', titleColor: '#7f1d1d', subColor: '#ef4444', badgeBg: '#fee2e2', badgeColor: '#ef4444' },
  1: { bg: '#fff1f2', borderStyle: 'dashed', borderColor: '#fca5a5', borderLeft: '#ef4444', titleColor: '#7f1d1d', subColor: '#ef4444', badgeBg: '#fee2e2', badgeColor: '#ef4444' },
}

const WARN_STYLE = {
  bg: '#fffbeb', borderStyle: 'dashed' as const, borderColor: '#fcd34d', borderLeft: '#d97706',
  titleColor: '#78350f', subColor: '#d97706', badgeBg: '#fef3c7', badgeColor: '#d97706'
}

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
  // When the day is submitted ("ingediend"), it is locked: no booking, editing,
  // dragging, processing or CSV upload — only viewing.
  readOnly?: boolean
  // Per-day indienen / intrekken
  onSubmitDay?: () => void
  onWithdrawDay?: () => void
  canSubmitDay?: boolean
  isSubmittingDay?: boolean
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
  readOnly = false,
  onSubmitDay,
  onWithdrawDay,
  canSubmitDay = true,
  isSubmittingDay = false,
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
      /* v8 ignore next -- defensive: isDragging implies dragState is set */
      setDragState((prev) => prev ? { ...prev, endMin } : prev)
    }

    function handleMouseUp() {
      if (!isDragging.current) return
      isDragging.current = false
      setDragState((prev) => {
        /* v8 ignore next -- defensive: isDragging implies dragState is set */
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
          onClick={readOnly ? undefined : () => onEditEntry(block.entry)}
          style={{
            ...baseStyle,
            background: '#6366f1',
            borderLeft: '3px solid rgba(255,255,255,.3)',
            borderRadius: 5,
            overflow: 'hidden',
            cursor: readOnly ? 'default' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '4px 12px',
            textAlign: 'left',
          }}
        >
          <div style={{ color: 'rgba(255,255,255,.95)', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {projectName(block.entry.projectId)}
          </div>
          <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {block.entry.startTime}–{block.entry.endTime} · {block.entry.hours}u
          </div>
          {block.entry.note && height > 52 && (
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.entry.note}</div>
          )}
        </button>
      )
    }

    if (block.type === 'concept') {
      const cs = blockStyle(block.block)
      const badgeLabel = block.block.origin === 'cache'
        ? 'Cache'
        : `${block.block.confidence}/5`
      return (
        <button
          key={key}
          onClick={readOnly ? undefined : () => onConceptClick?.(block.block)}
          style={{
            ...baseStyle,
            background: cs.bg,
            border: `1.5px ${cs.borderStyle} ${cs.borderColor}`,
            borderLeft: `3px solid ${cs.borderLeft}`,
            borderRadius: 5,
            overflow: 'hidden',
            cursor: readOnly ? 'default' : 'pointer',
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '4px 12px',
            textAlign: 'left',
          }}
        >
          <span style={{ background: cs.badgeBg, color: cs.badgeColor, fontSize: 8, fontWeight: 700, borderRadius: 3, padding: '1px 4px', position: 'absolute', top: 3, right: 4 }}>
            {badgeLabel}
          </span>
          <div style={{ color: cs.titleColor, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
            {block.block.blockName}
          </div>
          <div style={{ color: cs.subColor, fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3, marginTop: 1 }}>
            {block.block.startTime}–{block.block.endTime}
            {block.block.projectId ? ` · ${projectName(block.block.projectId)}` : ''}
          </div>
          {(!block.block.projectId || !block.block.serviceId) && height > 52 && (
            <div style={{ fontSize: 8, color: '#a8a29e', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>⚠ Project ontbreekt — klik om in te vullen</div>
          )}
        </button>
      )
    }

    /* v8 ignore start -- gap blocks are rendered inline below, never via renderBlock */
    // gap
    if (block.suggestion) {
      return (
        <div
          key={key}
          style={baseStyle}
          className="border-b border-[#e7e5e4] px-3 py-1 flex items-center justify-between"
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.625rem' }} className="truncate flex-1 mr-2">
            → {suggestionLabel(block.suggestion)}
          </div>
          <button
            onClick={() => onBookSuggestion(block.suggestion!)}
            style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '0.5625rem', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
            className="transition-colors"
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
        className="border-b border-[#e7e5e4]"
      />
    )
    /* v8 ignore stop */
  }

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const pct = Math.min(100, (totalHours / 8) * 100)
  const progressColor = totalHours >= 8 ? 'bg-green-500' : totalHours > 0 ? 'bg-amber-500' : 'bg-[#c7d2fe]'

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  function projectName(projectId: string): string {
    return projects.find((p) => p.id === projectId)?.name ?? projectId
  }

  /* v8 ignore start -- only used by the inline gap-suggestion render, which is unreachable (see below) */
  function suggestionLabel(s: HourEntrySuggestion): string {
    const name = projectName(s.projectId)
    const reason = s.reason === 'last-week' ? 'vorige week' : 'patroon'
    const time = s.startTime ? ` · ${s.startTime}–${s.endTime}` : ''
    return `${name}${time} (${reason})`
  }
  /* v8 ignore stop */

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
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--surface)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }} className="capitalize">{dateLabel}</div>
          {hasConcepts ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {totalHours}u geboekt · {pendingCount > 0 ? `${pendingCount} concept${pendingCount !== 1 ? 'en' : ''} te bevestigen` : 'alle concepten compleet'}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {totalHours}u geboekt · {Math.max(0, 8 - totalHours)}u te gaan
            </div>
          )}
        </div>
        <div className="flex-1 h-[5px] bg-[#f0ede8] rounded-full overflow-hidden mx-4">
          <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {readOnly && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>
              🔒 Ingediend · alleen-lezen
            </span>
          )}
          {readOnly && onWithdrawDay && (
            <button
              onClick={onWithdrawDay}
              disabled={isSubmittingDay}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: isSubmittingDay ? 'not-allowed' : 'pointer', opacity: isSubmittingDay ? 0.6 : 1, flexShrink: 0 }}
            >
              {isSubmittingDay ? 'Bezig…' : 'Trek dag in'}
            </button>
          )}
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>geboekt</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f0fdf4', borderLeft: '2px solid #16a34a' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>hoog</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fffbeb', borderLeft: '2px solid #d97706' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>midden</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#fff1f2', borderLeft: '2px dashed #ef4444' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>laag</span>
            </div>
          </div>
          {onProcessDay && (
            <button
              onClick={onProcessDay}
              className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[0.625rem] font-semibold px-3 py-[5px] rounded-lg transition-colors cursor-pointer flex-shrink-0"
            >
              ▶ Verwerk dag
            </button>
          )}
          {!readOnly && onSubmitDay && (
            <button
              onClick={onSubmitDay}
              disabled={isSubmittingDay || !canSubmitDay}
              title={!canSubmitDay ? 'Een toekomstige dag kan nog niet ingediend worden' : undefined}
              style={{ background: 'transparent', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: (isSubmittingDay || !canSubmitDay) ? 'not-allowed' : 'pointer', opacity: (isSubmittingDay || !canSubmitDay) ? 0.5 : 1, flexShrink: 0 }}
            >
              {isSubmittingDay ? 'Indienen…' : 'Dien dag in'}
            </button>
          )}
          {(hasConcepts || hasEntries) && (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 4, padding: '4px 10px', fontSize: '0.625rem', cursor: 'pointer', flexShrink: 0 }}
              className="transition-colors"
            >
              ↑ Nieuwe CSV
            </button>
          )}
        </div>
      </div>

      {/* Classifying spinner */}
      {isClassifying && (
        <div className="flex-1 flex items-center justify-center">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Bezig met classificeren...</div>
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
                    <span className="absolute top-0 text-[0.5625rem]" style={{ color: 'var(--text-faint)' }}>
                      {hour.toString().padStart(2, '0')}
                    </span>
                    <span
                      className="absolute text-[0.5rem]"
                      style={{ top: HOUR_HEIGHT_PX / 2, color: 'var(--text-faint)' }}
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
                    style={{ height: HOUR_HEIGHT_PX, borderTop: '1px solid #f0ede8' }}
                  />
                ))}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                    Klik op{' '}
                    <strong style={{ color: 'var(--text-secondary)' }}>Verwerk dag</strong>
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
                  <span className="absolute top-0 text-[0.5625rem]" style={{ color: 'var(--text-faint)' }}>
                    {hour.toString().padStart(2, '0')}
                  </span>
                  <span
                    className="absolute text-[0.5rem]"
                    style={{ top: HOUR_HEIGHT_PX / 2, color: 'var(--text-faint)' }}
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
                      background: 'var(--accent-light)',
                      border: '2px solid var(--accent)',
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
                    <div style={{ color: 'var(--accent)', fontSize: '0.6875rem', fontWeight: 600 }}>
                      {minutesToTime(start)} – {minutesToTime(end)}
                    </div>
                    {height > 36 && (
                      <div style={{ color: 'var(--accent)', fontSize: '0.5625rem', opacity: 0.8 }}>
                        {durationLabel} · loslaten om te boeken
                      </div>
                    )}
                  </div>
                )
              })()}
               <div className="absolute inset-0">
                {(() => {
                  // Interval partitioning: non-overlapping blocks share a column, so a
                  // gap-free day renders in a single column (see assignBlockColumns).
                  const contentBlocks = flatBlocks.filter(b => b.type === 'entry' || b.type === 'concept')
                  const { columns: blockColumns, numCols } = assignBlockColumns(contentBlocks)
                  const colWidthPct = 100 / numCols

                  // Render gap blocks first (always column 0, full width only if no content blocks)
                  const gapElements = flatBlocks
                    .filter(b => b.type === 'gap' && b.suggestion)
                    /* v8 ignore start -- gaps from mergeConceptsIntoTimeline never carry a suggestion, and computeTimelineBlocks (which does attach suggestions) only runs when the timeline is hidden by showEmptyHint */
                    .map((block, i) => {
                      if (block.type !== 'gap') return null
                      const top = blockTop(block.startTime)
                      const height = blockPx(block.startTime, block.endTime)
                      // Gaps fill column 0 width (or full width if single column)
                      const width = `${colWidthPct}%`
                      return (
                        <div
                          key={`gap-${i}`}
                          style={{ position: 'absolute', top, left: 0, width, height, borderBottom: '1px solid var(--border)' }}
                          className="px-3 py-1 flex items-center justify-between"
                        >
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.625rem' }} className="truncate flex-1 mr-2">
                            → {suggestionLabel(block.suggestion!)}
                          </div>
                          {!readOnly && (
                            <button
                              onClick={() => onBookSuggestion(block.suggestion!)}
                              style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '0.5625rem', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                              className="transition-colors"
                            >
                              + Boek
                            </button>
                          )}
                        </div>
                      )
                    })
                    /* v8 ignore stop */

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
        <div className="flex-shrink-0 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.5625rem', fontWeight: 600 }} className="uppercase tracking-wide mb-2">
            Context voor deze dag
          </div>
          <EvidencePanel commits={commits} linearIssues={linearIssues} />
        </div>
      )}
    </div>
  )
}
