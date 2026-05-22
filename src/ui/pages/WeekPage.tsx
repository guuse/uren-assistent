import { useState, useCallback, useEffect } from 'react'
import { useWeek } from '../hooks/useWeek'
import { useSuggestions } from '../hooks/useSuggestions'
import { useImport } from '../hooks/useImport'
import { useHistoryStore } from '../hooks/useHistoryStore'
import { WeekDayList } from '../components/WeekDayList'
import { DayTimeline } from '../components/DayTimeline'
import { BookingModal } from './BookingModal'
import { mappingCacheRepo } from '../../application/container'
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

  const [bookingEntry, setBookingEntry] = useState<Partial<HourEntry> | null>(null)
  const [bookingConcept, setBookingConcept] = useState<ClassifiedBlock | null>(null)

  // Concept-count per datum voor de WeekDayList badge (synchronous approximation via in-memory)
  const [conceptCountCache, setConceptCountCache] = useState<Record<string, number>>({})

  function conceptCountForDate(date: string): number {
    return conceptCountCache[date] ?? 0
  }

  // Sync concept-count badge-cache wanneer blokken voor geselecteerde datum wijzigen
  useEffect(() => {
    setConceptCountCache(prev => ({
      ...prev,
      [week.selectedDate]: historyStore.blocksForDate.length,
    }))
  }, [week.selectedDate, historyStore.blocksForDate.length])

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

  const handleUploadCsv = useCallback(async (csvContent: string) => {
    await importState.analyseFile(csvContent)
  }, [importState])

  // Na classificatie: sla blokken op in historyStore
  useEffect(() => {
    if (importState.status !== 'ready' || importState.blocks.length === 0) return
    const byDate: Record<string, ClassifiedBlock[]> = {}
    for (const block of importState.blocks) {
      if (!byDate[block.date]) byDate[block.date] = []
      byDate[block.date]!.push(block)
    }
    for (const [date, blocks] of Object.entries(byDate)) {
      void historyStore.saveBlocksForDate(date, blocks)
    }
  }, [importState.status, importState.blocks, historyStore])

  async function handleBooked() {
    setBookingEntry(null)
    if (bookingConcept) {
      await historyStore.removeBlock(week.selectedDate, bookingConcept.urlPattern)
      // Persist mapping cache
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

  const selectedEntries = week.entriesByDate[week.selectedDate] ?? []
  const isClassifying = importState.status === 'classifying' || importState.status === 'parsing'

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
