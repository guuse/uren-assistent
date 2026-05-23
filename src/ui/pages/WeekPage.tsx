import { useState, useCallback, useEffect, useRef } from 'react'
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
  createCalendarRepository,
  createCopilotRepository,
} from '../../application/container'
import { useAppStore } from '../../store/appStore'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { HourEntrySuggestion } from '../../domain/entities/HourEntrySuggestion'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
}

function weekLabel(weekStart: string): string {
  const thisMonday = (() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().split('T')[0]!
  })()
  if (weekStart === thisMonday) return 'deze week'
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
  const services = useAppStore((s) => s.services)

  const [bookingEntry, setBookingEntry] = useState<Partial<HourEntry> | null>(null)
  const [bookingConcept, setBookingConcept] = useState<ClassifiedBlock | null>(null)

  // Week processing state
  const [isProcessingWeek, setIsProcessingWeek] = useState(false)
  const [dayProcessingStates, setDayProcessingStates] = useState<Map<string, DayProcessingState>>(new Map())
  const abortRef = useRef(false)

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

  const handleUploadCsv = useCallback(async (csvContent: string) => {
    await importState.analyseFile(csvContent)
  }, [importState])

  const { saveBlocksForDate } = historyStore

  useEffect(() => {
    if (importState.status !== 'ready' || importState.blocks.length === 0) return
    const byDate: Record<string, ClassifiedBlock[]> = {}
    for (const block of importState.blocks) {
      if (!byDate[block.date]) byDate[block.date] = []
      byDate[block.date]!.push(block)
    }
    for (const [date, blocks] of Object.entries(byDate)) {
      void saveBlocksForDate(date, blocks)
    }
  }, [importState.status, importState.blocks, saveBlocksForDate])

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

  async function handleProcessWeek() {
    if (!copilotToken || !githubToken || !linearToken) return
    const username = githubUsername ?? 'guuse'

    setIsProcessingWeek(true)
    setDayProcessingStates(new Map())
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
        if (progress.phase === 'classifying-day' && progress.day) {
          setDayProcessingStates(prev => new Map(prev).set(progress.day!, 'classifying'))
        } else if (progress.phase === 'done') {
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
          setDayProcessingStates(prev => new Map(prev).set(progress.day!, 'error'))
        }
      }
    } finally {
      setIsProcessingWeek(false)
      void week.refresh()
    }
  }

  const selectedEntries = week.entriesByDate[week.selectedDate] ?? []
  const isClassifying = importState.status === 'classifying' || importState.status === 'parsing'
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
        {...(canProcessWeek ? { onProcessWeek: handleProcessWeek } : {})}
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
        <DayTimeline
          date={week.selectedDate}
          entries={selectedEntries}
          suggestions={suggestions}
          conceptBlocks={historyStore.blocksForDate}
          onBookSuggestion={handleBookSuggestion}
          onEditEntry={handleEditEntry}
          onConceptClick={handleConceptClick}
          onUploadCsv={handleUploadCsv}
          isClassifying={isClassifying}
          onDragNew={handleDragNew}
        />
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
    </div>
  )
}
