import { useState, useCallback, useRef, useEffect } from 'react'
import { useWeek } from '../hooks/useWeek'
import { useSuggestions } from '../hooks/useSuggestions'
import { useImport } from '../hooks/useImport'
import { useHistoryStore } from '../hooks/useHistoryStore'
import { useClearDayBlocks } from '../hooks/useClearDayBlocks'
import { useClearWeekBlocks } from '../hooks/useClearWeekBlocks'
import { WeekDayList } from '../components/WeekDayList'
import type { DayProcessingState } from '../components/WeekDayList'
import { DayTimeline } from '../components/DayTimeline'
import { BookingModal } from './BookingModal'
import {
  mappingCacheRepo,
  keychainRepo,
  createProcessWeekUseCase,
  createProcessDayUseCase,
  createCalendarRepository,
  createGeminiRepository,
  createSimplicateRepository,
  historyStore as domainHistoryStore,
} from '../../application/container'
import { NoHistoryWarningModal } from '../components/NoHistoryWarningModal'
import { SubmitConfirmModal } from '../components/SubmitConfirmModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useSubmissions } from '../hooks/useSubmissions'
import { useAppStore } from '../../store/appStore'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string
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
  const submissions = useSubmissions()
  const { suggestions } = useSuggestions(week.selectedDate)
  const importState = useImport()
  const historyStore = useHistoryStore(week.selectedDate)

  const githubToken = useAppStore((s) => s.githubToken)
  const githubUsername = useAppStore((s) => s.githubUsername)
  const linearToken = useAppStore((s) => s.linearToken)
  const projects = useAppStore((s) => s.projects)
  const setDayContext = useAppStore((s) => s.setDayContext)
  const dayContexts = useAppStore((s) => s.dayContexts)
  const services = useAppStore((s) => s.services)
  const hourTypes = useAppStore((s) => s.hourTypes)
  const simplicateEmployeeId = useAppStore((s) => s.simplicateEmployeeId)

  const [bookingEntry, setBookingEntry] = useState<Partial<HourEntry> | null>(null)
  const [bookingConcept, setBookingConcept] = useState<ClassifiedBlock | null>(null)

  // Week processing state
  const [isProcessingWeek, setIsProcessingWeek] = useState(false)
  const [dayProcessingStates, setDayProcessingStates] = useState<Map<string, DayProcessingState>>(new Map())
  const [processWeekError, setProcessWeekError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const [weekLlmCounts, setWeekLlmCounts] = useState<Map<string, number>>(new Map())

  // Dag-verwerking state
  const [isProcessingDay, setIsProcessingDay] = useState(false)

  // Warning modal state
  type WarningScope = { kind: 'week' } | { kind: 'day'; date: string } | null
  const [warningScope, setWarningScope] = useState<WarningScope>(null)

  // File input ref voor WeekDayList CSV-upload
  const csvInputRef = useRef<HTMLInputElement>(null)

  const [uploadToast, setUploadToast] = useState<string | null>(null)
  const pendingScopeRef = useRef<{ kind: 'week' } | { kind: 'day'; date: string } | null>(null)

  // Week/dag indienen + intrekken state
  // Submission is week-granular in Simplicate (Mon–Sun), so the only scope is 'week'.
  type SubmitScope = { scope: 'week'; label: string; from: string; to: string }
  const [submitModal, setSubmitModal] = useState<(SubmitScope & { unbookedCount: number; bookedHours: number }) | null>(null)
  const [withdrawModal, setWithdrawModal] = useState<SubmitScope | null>(null)

  function conceptCountForDate(date: string): number {
    return date === week.selectedDate ? historyStore.blocksForDate.length : 0
  }

  async function loadWeekLlmCounts() {
    const counts = new Map<string, number>()
    for (const date of week.weekDays) {
      const blocks = await domainHistoryStore.getBlocksForDate(date)
      const llmCount = blocks.filter(
        (b) => b.origin === 'llm' || b.origin === 'llm-pattern'
      ).length
      counts.set(date, llmCount)
    }
    setWeekLlmCounts(counts)
  }

  useEffect(() => {
    void loadWeekLlmCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.selectedWeekStart])

  // Load submission status for the selected week's month (cached per month).
  useEffect(() => {
    void submissions.loadMonth(week.selectedWeekStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.selectedWeekStart])

  function llmBlockCountForDate(date: string): number {
    if (date === week.selectedDate) {
      return historyStore.blocksForDate.filter(
        (b) => b.origin === 'llm' || b.origin === 'llm-pattern'
      ).length
    }
    return weekLlmCounts.get(date) ?? 0
  }

  const { clearDay, isClearing, clearError } = useClearDayBlocks((clearedDate) => {
    void reloadForDate(clearedDate)
  })

  const { clearWeek, isClearingWeek, clearWeekError: clearWeekErr } = useClearWeekBlocks(
    async (clearedDays) => {
      for (const date of clearedDays) {
        await reloadForDate(date)
      }
      void loadWeekLlmCounts()
    }
  )

  const totalLlmBlockCount = week.weekDays.reduce((sum, date) => sum + llmBlockCountForDate(date), 0)

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
    if (block.hourTypeId) entry.hourTypeId = block.hourTypeId
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
    if (!githubToken || !linearToken) return
    const hasHistory = await domainHistoryStore.hasHistoryForWeek(week.selectedWeekStart)
    if (!hasHistory) {
      setWarningScope({ kind: 'week' })
      return
    }
    await handleProcessWeek()
  }

  async function handleProcessWeek() {
    if (!githubToken || !linearToken) return
    if (!githubUsername) {
      setProcessWeekError('Stel eerst je GitHub-gebruikersnaam in bij Instellingen.')
      return
    }
    const username = githubUsername

    setIsProcessingWeek(true)
    setDayProcessingStates(new Map())
    setProcessWeekError(null)
    abortRef.current = false

    try {
      const calendarRepo = createCalendarRepository()
      const copilotRepo = createGeminiRepository()
      const domainProjects = projects.map(p => ({ id: p.id, name: `${p.organizationName} — ${p.name}` }))
      const domainServices = services.map(s => ({
        id: s.id,
        name: s.name,
        projectId: s.projectId,
        hourTypes: s.hourTypeIds.map(id => ({ id, label: hourTypes.find(h => h.id === id)?.label ?? id })),
      }))

      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey!, apiSecret!)

      const useCase = createProcessWeekUseCase(
        githubToken,
        linearToken,
        calendarRepo,
        copilotRepo,
        domainProjects,
        domainServices,
        username,
        simplicateRepo,
        simplicateEmployeeId ?? '',
      )

      for await (const progress of useCase.execute(week.selectedWeekStart, week.selectedWeekEnd)) {
        if (abortRef.current) break
        if (progress.phase === 'context-ready' && progress.commitsByDay && progress.linearIssues) {
          for (const [date, commits] of Object.entries(progress.commitsByDay)) {
            setDayContext(date, { commits, linearIssues: progress.linearIssues })
          }
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
    if (!githubToken || !linearToken) return
    const hasHistory = await domainHistoryStore.hasDataForDate(date)
    if (!hasHistory) {
      setWarningScope({ kind: 'day', date })
      return
    }
    await runProcessDay(date)
  }

  async function runProcessDay(date: string) {
    if (!githubToken || !linearToken) return
    if (!githubUsername) {
      setProcessWeekError('Stel eerst je GitHub-gebruikersnaam in bij Instellingen.')
      return
    }
    const username = githubUsername

    setIsProcessingDay(true)
    setDayProcessingStates(prev => new Map(prev).set(date, 'classifying'))

    try {
      const calendarRepo = createCalendarRepository()
      const copilotRepo = createGeminiRepository()
      const domainProjects = projects.map(p => ({ id: p.id, name: `${p.organizationName} — ${p.name}` }))
      const domainServices = services.map(s => ({
        id: s.id,
        name: s.name,
        projectId: s.projectId,
        hourTypes: s.hourTypeIds.map(id => ({ id, label: hourTypes.find(h => h.id === id)?.label ?? id })),
      }))

      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey!, apiSecret!)

      const useCase = createProcessDayUseCase(
        githubToken,
        linearToken,
        calendarRepo,
        copilotRepo,
        domainProjects,
        domainServices,
        username,
        simplicateRepo,
        simplicateEmployeeId ?? '',
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

  // Count unbooked concept blocks (those still on the timeline = not yet booked) across dates.
  async function countUnbooked(dates: string[]): Promise<number> {
    let count = 0
    for (const date of dates) {
      const blocks = await domainHistoryStore.getBlocksForDate(date)
      count += blocks.filter((b) => b.startTime != null).length
    }
    return count
  }

  async function handleSubmitWeekClick() {
    const unbookedCount = await countUnbooked(week.weekDays)
    const bookedHours = week.weekDays.reduce((s, d) => s + week.hoursForDate(d), 0)
    submissions.clearSubmitError()
    setSubmitModal({ scope: 'week', label: weekLabel(week.selectedWeekStart), from: week.selectedWeekStart, to: week.selectedWeekEnd, unbookedCount, bookedHours })
  }

  async function handleSubmitConfirm() {
    if (!submitModal) return
    const target = submitModal
    setSubmitModal(null)
    const ok = await submissions.submit(target.from, target.to)
    if (ok) void week.refresh()
  }

  async function handleWithdrawConfirm() {
    if (!withdrawModal) return
    const target = withdrawModal
    setWithdrawModal(null)
    const ok = await submissions.withdraw(target.from, target.to)
    if (ok) void week.refresh()
  }

  const today = toLocalDateString(new Date())
  const daySubmitted = submissions.isDateSubmitted(week.selectedDate)
  const allWeekSubmitted = week.weekDays.length > 0 && week.weekDays.every(submissions.isDateSubmitted)
  const canSubmitWeek = week.selectedWeekStart <= today // future weeks can't be submitted yet

  const selectedEntries = week.entriesByDate[week.selectedDate] ?? []
  const isClassifying = importState.status === 'parsing'

  const dayCommits = dayContexts[week.selectedDate]?.commits ?? historyStore.blocksForDate[0]?.commits ?? []
  const dayLinearIssues = dayContexts[week.selectedDate]?.linearIssues ?? historyStore.blocksForDate[0]?.linearIssues ?? []
  const canProcessWeek = !!(githubToken && linearToken)

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      <WeekDayList
        weekDays={week.weekDays}
        selectedDate={week.selectedDate}
        hoursForDate={week.hoursForDate}
        conceptCountForDate={conceptCountForDate}
        onSelectDate={week.selectDate}
        onPrevWeek={week.prevWeek}
        onNextWeek={week.nextWeek}
        isCurrentWeek={week.isCurrentWeek}
        onGoToCurrentWeek={week.goToCurrentWeek}
        onGoToDate={week.goToDate}
        weekLabel={weekLabel(week.selectedWeekStart)}
        {...(canProcessWeek ? { onProcessWeek: handleProcessWeekWithCheck } : {})}
        {...(canProcessWeek ? { onUploadCsv: () => csvInputRef.current?.click() } : {})}
        processingStateForDate={processingStateForDate}
        isProcessingWeek={isProcessingWeek}
        llmBlockCountForDate={llmBlockCountForDate}
        onClearDayBlocks={clearDay}
        isClearingDay={isClearing}
        clearError={clearError}
        onClearWeekBlocks={() => clearWeek(week.weekDays)}
        isClearingWeek={isClearingWeek}
        clearWeekError={clearWeekErr}
        totalLlmBlockCount={totalLlmBlockCount}
        isWeekSubmitted={allWeekSubmitted}
        canSubmitWeek={canSubmitWeek}
        onSubmitWeek={() => void handleSubmitWeekClick()}
        onWithdrawWeek={() => { submissions.clearSubmitError(); setWithdrawModal({ scope: 'week', label: weekLabel(week.selectedWeekStart), from: week.selectedWeekStart, to: week.selectedWeekEnd }) }}
        isSubmittingWeek={submissions.isSubmitting}
        submitError={submissions.submitError}
        isDateSubmitted={submissions.isDateSubmitted}
        onPickerMonthChange={submissions.loadMonth}
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
            suggestions={daySubmitted ? [] : suggestions}
            conceptBlocks={historyStore.blocksForDate.filter(b => b.startTime != null)}
            commits={dayCommits}
            linearIssues={dayLinearIssues}
            onBookSuggestion={handleBookSuggestion}
            onEditEntry={handleEditEntry}
            onConceptClick={handleConceptClick}
            isClassifying={isClassifying || isProcessingDay}
            readOnly={daySubmitted}
            {...(daySubmitted ? {} : { onUploadCsv: handleUploadCsv, onDragNew: handleDragNew })}
            {...(canProcessWeek && !daySubmitted ? { onProcessDay: () => void handleProcessDay(week.selectedDate) } : {})}
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
          onDeleted={() => void handleBooked()}
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] text-[0.75rem] shadow-lg pointer-events-none">
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

      {/* Indienen: bevestiging / waarschuwing (week of dag) */}
      {submitModal && (
        <SubmitConfirmModal
          scope={submitModal.scope}
          label={submitModal.label}
          unbookedCount={submitModal.unbookedCount}
          bookedHours={submitModal.bookedHours}
          isSubmitting={submissions.isSubmitting}
          onConfirm={() => void handleSubmitConfirm()}
          onCancel={() => setSubmitModal(null)}
        />
      )}

      {/* Intrekken: bevestiging (week of dag) */}
      {withdrawModal && (
        <ConfirmDialog
          title="Indiening intrekken"
          description={`${withdrawModal.label} is ingediend. Intrekken zodat je de uren weer kunt wijzigen?`}
          confirmLabel="Intrekken"
          isLoading={submissions.isSubmitting}
          onConfirm={() => void handleWithdrawConfirm()}
          onCancel={() => setWithdrawModal(null)}
        />
      )}
    </div>
  )
}
