import { useState, useCallback, useRef } from 'react'
import { useWeek } from '../hooks/useWeek'
import { useSuggestions } from '../hooks/useSuggestions'
import { useImport } from '../hooks/useImport'
import { useHistoryStore } from '../hooks/useHistoryStore'
import { WeekDayList } from '../components/WeekDayList'
import type { DayProcessingState } from '../components/WeekDayList'
import { DayTimeline } from '../components/DayTimeline'
import { BookingModal } from './BookingModal'
import {
  mappingCacheRepo,
  createProcessWeekUseCase,
  createProcessDayUseCase,
  createCalendarRepository,
  createCopilotRepository,
  historyStore as domainHistoryStore,
} from '../../application/container'
import { NoHistoryWarningModal } from '../components/NoHistoryWarningModal'
import { useAppStore } from '../../store/appStore'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekNumber(dateStr: string): number {
  const d = parseLocalDate(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
}

function weekLabel(weekStart: string): string {
  const today = new Date()
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset)
  if (weekStart === toLocalDateString(thisMonday)) return 'deze week'
  const wn = getWeekNumber(weekStart)
  return `week ${wn}`
}

export function WeekPage() {
  const week = useWeek()
  const { suggestions } = useSuggestions(week.selectedDate)
  const importState = useImport()
  const historyStore = useHistoryStore(week.selectedDate)

  const githubToken = useAppStore((s) => s.githubToken)
  const githubUsername = useAppStore((s) => s.githubUsername)
  const linearToken = useAppStore((s) => s.linearToken)
  const copilotToken = useAppStore((s) => s.copilotToken)
  const projects = useAppStore((s) => s.projects)
  const setDayContext = useAppStore((s) => s.setDayContext)
  const dayContexts = useAppStore((s) => s.dayContexts)
  const services = useAppStore((s) => s.services)

  const [bookingEntry, setBookingEntry] = useState<Partial<HourEntry> | null>(null)
  const [bookingConcept, setBookingConcept] = useState<ClassifiedBlock | null>(null)

  // Week processing state
  const [isProcessingWeek, setIsProcessingWeek] = useState(false)
  const [dayProcessingStates, setDayProcessingStates] = useState<Map<string, DayProcessingState>>(new Map())
  const [processWeekError, setProcessWeekError] = useState<string | null>(null)
  const abortRef = useRef(false)

  // Dag-verwerking state
  const [isProcessingDay, setIsProcessingDay] = useState(false)

  // Warning modal state
  type WarningScope = { kind: 'week' } | { kind: 'day'; date: string } | null
  const [warningScope, setWarningScope] = useState<WarningScope>(null)

  // File input ref voor WeekDayList CSV-upload
  const csvInputRef = useRef<HTMLInputElement>(null)

  const [uploadToast, setUploadToast] = useState<string | null>(null)
  const pendingScopeRef = useRef<{ kind: 'week' } | { kind: 'day'; date: string } | null>(null)

  function conceptCountForDate(date: string): number {
    return date === week.selectedDate ? historyStore.blocksForDate.length : 0
  }

  function processingStateForDate(date: string): DayProcessingState {
    return dayProcessingStates.get(date) ?? 'idle'
  }

  function handleBookSuggestion(suggestion: HourEntrySuggestion) {
    const entry: Partial<HourEntry> = {
      projectId: suggestion.projectId,
      projectServiceId: suggestion.projectServiceId,
      hourTypeId: suggestion.hourTypeId,
      startDate: week.selectedDate,
    }
    if (suggestion.startTime !== undefined) entry.startTime = suggestion.startTime
    if (suggestion.endTime !== undefined) entry.endTime = suggestion.endTime
    setBookingConcept(null)
    setBookingEntry(entry)
  }

  function handleEditEntry(entry: HourEntry) {
    setBookingConcept(null)
    setBookingEntry({ ...entry, startDate: entry.startDate })
  }

  function handleConceptClick(block: ClassifiedBlock) {
    const entry: Partial<HourEntry> = {
      startDate: block.date,
      startTime: block.startTime,
      endTime: block.endTime,
      note: block.note ?? block.summary,
    }
    if (block.projectId) entry.projectId = block.projectId
    if (block.serviceId) entry.projectServiceId = block.serviceId
    setBookingEntry(entry)
    setBookingConcept(block)
  }

  function handleDragNew(startTime: string, endTime: string) {
    setBookingConcept(null)
    setBookingEntry({
      startDate: week.selectedDate,
      startTime,
      endTime,
    })
  }

  const { saveBlocksForDate, reloadForDate } = historyStore

  const handleUploadCsv = useCallback(async (csvContent: string) => {
    try {
    const result = await importState.analyseFile(csvContent)
    if (!result) return

    // Save all blocks per date into HistoryStore
    const byDate: Record<string, HistoryBlock[]> = {}
    for (const block of result.blocks) {
      if (!byDate[block.date]) byDate[block.date] = []
      byDate[block.date]!.push(block)
    }
    for (const [date, blocks] of Object.entries(byDate)) {
      void saveBlocksForDate(date, blocks as ClassifiedBlock[])
    }

    // Show toast
    const fromLabel = result.dateFrom.slice(8) + '-' + result.dateFrom.slice(5, 7)
    const toLabel = result.dateTo.slice(8) + '-' + result.dateTo.slice(5, 7)
    const msg = result.dateFrom === result.dateTo
      ? `Geschiedenis geüpload voor ${fromLabel}`
      : `Geschiedenis geüpload voor ${result.dateCount} dagen (${fromLabel} t/m ${toLabel})`
    setUploadToast(msg)
    setTimeout(() => setUploadToast(null), 3000)

    // If there was a pending warning scope, start processing for that scope
    const pending = pendingScopeRef.current
    pendingScopeRef.current = null
    if (pending) {
      if (pending.kind === 'week') {
        void handleProcessWeek()
      } else {
        void runProcessDay(pending.date)
      }
    } else {
      void week.refresh()
    }
    } catch (err) {
      console.error('[handleUploadCsv] crash:', err)
    }
  }, [importState, saveBlocksForDate, week])

  async function handleBooked() {
    setBookingEntry(null)
    if (bookingConcept) {
      await historyStore.removeBlock(week.selectedDate, bookingConcept.urlPattern)
      if (bookingConcept.projectId && bookingConcept.serviceId) {
        await mappingCacheRepo.set(bookingConcept.urlPattern, {
          projectId: bookingConcept.projectId,
          serviceId: bookingConcept.serviceId,
          note: bookingConcept.note ?? '',
          blockName: bookingConcept.blockName,
          summary: bookingConcept.summary,
        })
      }
      setBookingConcept(null)
    }
    void week.refresh()
  }

  async function handleProcessWeekWithCheck() {
    if (!copilotToken || !githubToken || !linearToken) return
    const hasHistory = await domainHistoryStore.hasHistoryForWeek(week.selectedWeekStart)
    if (!hasHistory) {
      setWarningScope({ kind: 'week' })
      return
    }
    await handleProcessWeek()
  }

  async function handleProcessWeek() {
    if (!copilotToken || !githubToken || !linearToken) {
      console.warn('[ProcessWeek] tokens ontbreken:', { copilotToken: !!copilotToken, githubToken: !!githubToken, linearToken: !!linearToken })
      return
    }
    const username = githubUsername ?? 'guuse'
    console.log('[ProcessWeek] start', { username, weekStart: week.selectedWeekStart, weekEnd: week.selectedWeekEnd })

    setIsProcessingWeek(true)
    setDayProcessingStates(new Map())
    setProcessWeekError(null)
    abortRef.current = false

    try {
      const calendarRepo = createCalendarRepository()
      const copilotRepo = createCopilotRepository(copilotToken)
      const domainProjects = projects.map(p => ({ id: p.id, name: `${p.organizationName} — ${p.name}` }))
      const domainServices = services.map(s => ({ id: s.id, name: s.name, projectId: s.projectId }))

      const useCase = createProcessWeekUseCase(
        githubToken,
        linearToken,
        calendarRepo,
        copilotRepo,
        domainProjects,
        domainServices,
        username,
      )

      for await (const progress of useCase.execute(week.selectedWeekStart, week.selectedWeekEnd)) {
        if (abortRef.current) break
        console.log('[ProcessWeek] progress:', progress.phase, 'day' in progress ? progress.day : '')
        if (progress.phase === 'context-ready' && progress.commitsByDay && progress.linearIssues) {
          for (const [date, commits] of Object.entries(progress.commitsByDay)) {
            setDayContext(date, { commits, linearIssues: progress.linearIssues })
          }
          console.log('[ProcessWeek] context-ready: commits per dag:', Object.fromEntries(
            Object.entries(progress.commitsByDay).map(([d, c]) => [d, c.length])
          ))
        } else if (progress.phase === 'classifying-day' && progress.day) {
          // Als een nieuwe dag begint, is de vorige klaar — reload de geselecteerde dag
          void reloadForDate(week.selectedDate)
          setDayProcessingStates(prev => new Map(prev).set(progress.day!, 'classifying'))
        } else if (progress.phase === 'done') {
          // Reload blocks voor de geselecteerde dag zodat de tijdlijn bijwerkt
          void reloadForDate(week.selectedDate)
          setDayProcessingStates(prev => {
            const next = new Map(prev)
            for (const day of week.weekDays) {
              if (!next.has(day) || next.get(day) === 'classifying') {
                next.set(day, 'done')
              }
            }
            return next
          })
        } else if (progress.phase === 'error' && progress.day) {
          const msg = 'error' in progress ? progress.error : 'onbekende fout'
          console.error('[ProcessWeek] error op dag', progress.day, msg)
          setProcessWeekError(`Fout op ${progress.day}: ${msg ?? 'onbekend'}`)
          setDayProcessingStates(prev => new Map(prev).set(progress.day!, 'error'))
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ProcessWeek] fatale fout:', err)
      setProcessWeekError(`Fatale fout: ${msg}`)
    } finally {
      setIsProcessingWeek(false)
      void week.refresh()
    }
  }

  async function handleProcessDay(date: string) {
    if (!copilotToken || !githubToken || !linearToken) return
    const hasHistory = await domainHistoryStore.hasDataForDate(date)
    if (!hasHistory) {
      setWarningScope({ kind: 'day', date })
      return
    }
    await runProcessDay(date)
  }

  async function runProcessDay(date: string) {
    if (!copilotToken || !githubToken || !linearToken) return
    const username = githubUsername ?? 'guuse'

    setIsProcessingDay(true)
    setDayProcessingStates(prev => new Map(prev).set(date, 'classifying'))

    try {
      const calendarRepo = createCalendarRepository()
      const copilotRepo = createCopilotRepository(copilotToken)
      const domainProjects = projects.map(p => ({ id: p.id, name: `${p.organizationName} — ${p.name}` }))
      const domainServices = services.map(s => ({ id: s.id, name: s.name, projectId: s.projectId }))

      const useCase = createProcessDayUseCase(
        githubToken,
        linearToken,
        calendarRepo,
        copilotRepo,
        domainProjects,
        domainServices,
        username,
      )

      for await (const progress of useCase.execute(date)) {
        if (progress.phase === 'error') {
          setDayProcessingStates(prev => new Map(prev).set(date, 'error'))
          setProcessWeekError(`Fout op ${date}: ${progress.error ?? 'onbekend'}`)
        }
      }

      setDayProcessingStates(prev => new Map(prev).set(date, 'done'))
      void reloadForDate(week.selectedDate)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setProcessWeekError(`Fout bij verwerken dag: ${msg}`)
      setDayProcessingStates(prev => new Map(prev).set(date, 'error'))
    } finally {
      setIsProcessingDay(false)
      void week.refresh()
    }
  }

  function warningLabel(): string {
    if (!warningScope) return ''
    if (warningScope.kind === 'week') return weekLabel(week.selectedWeekStart)
    const d = new Date(warningScope.date + 'T12:00:00')
    return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function handleWarningConfirm() {
    const scope = warningScope
    setWarningScope(null)
    if (!scope) return
    if (scope.kind === 'week') void handleProcessWeek()
    else void runProcessDay(scope.date)
  }

  function handleWarningUpload() {
    pendingScopeRef.current = warningScope
    setWarningScope(null)
    csvInputRef.current?.click()
  }

  const selectedEntries = week.entriesByDate[week.selectedDate] ?? []
  const isClassifying = importState.status === 'parsing'

  const dayCommits = dayContexts[week.selectedDate]?.commits ?? historyStore.blocksForDate[0]?.commits ?? []
  const dayLinearIssues = dayContexts[week.selectedDate]?.linearIssues ?? historyStore.blocksForDate[0]?.linearIssues ?? []
  const canProcessWeek = !!(githubToken && linearToken && copilotToken)

  return (
    <div className="h-full flex bg-[#1c1917] text-[#e8e2d9]">
      <WeekDayList
        weekDays={week.weekDays}
        selectedDate={week.selectedDate}
        hoursForDate={week.hoursForDate}
        conceptCountForDate={conceptCountForDate}
        onSelectDate={week.selectDate}
        onPrevWeek={week.prevWeek}
        onNextWeek={week.nextWeek}
        weekLabel={weekLabel(week.selectedWeekStart)}
        {...(canProcessWeek ? { onProcessWeek: handleProcessWeekWithCheck } : {})}
        {...(canProcessWeek ? { onUploadCsv: () => csvInputRef.current?.click() } : {})}
        processingStateForDate={processingStateForDate}
        isProcessingWeek={isProcessingWeek}
      />

      {week.isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[#4a4540] text-sm">
          Laden...
        </div>
      ) : week.error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-red-400 text-sm">{week.error}</div>
          <button
            onClick={week.refresh}
            className="text-[#7a7268] hover:text-[#e8e2d9] text-sm underline cursor-pointer"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : (
        <>
          {processWeekError && (
            <div className="mx-4 mt-3 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700/50 text-red-300 text-sm flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span className="break-all">{processWeekError}</span>
            </div>
          )}
          <DayTimeline
            date={week.selectedDate}
            entries={selectedEntries}
            suggestions={suggestions}
            conceptBlocks={historyStore.blocksForDate.filter(b => b.startTime != null)}
            commits={dayCommits}
            linearIssues={dayLinearIssues}
            onBookSuggestion={handleBookSuggestion}
            onEditEntry={handleEditEntry}
            onConceptClick={handleConceptClick}
            onUploadCsv={handleUploadCsv}
            isClassifying={isClassifying || isProcessingDay}
            onDragNew={handleDragNew}
            {...(canProcessWeek ? { onProcessDay: () => void handleProcessDay(week.selectedDate) } : {})}
          />
        </>
      )}

      {bookingEntry && (
        <BookingModal
          initialEntry={bookingEntry}
          title={bookingConcept?.blockName ?? 'Uren boeken'}
          {...(bookingConcept ? { evidenceBlock: bookingConcept } : {})}
          onClose={() => { setBookingEntry(null); setBookingConcept(null) }}
          onBooked={() => void handleBooked()}
        />
      )}

      {/* Hidden CSV input voor WeekDayList upload-knop */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) {
            void f.text().then(text => handleUploadCsv(text))
          }
          e.target.value = ''
        }}
      />

      {uploadToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1e1b18] border border-[#3e3a36] rounded-lg px-4 py-2.5 text-[#e8e2d9] text-[0.75rem] shadow-lg pointer-events-none">
          {uploadToast}
        </div>
      )}

      {/* Warning modal: geen browsergeschiedenis */}
      {warningScope && (
        <NoHistoryWarningModal
          scope={warningScope.kind}
          label={warningLabel()}
          onConfirm={handleWarningConfirm}
          onUpload={handleWarningUpload}
          onCancel={() => setWarningScope(null)}
        />
      )}
    </div>
  )
}
