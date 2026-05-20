// src/ui/hooks/useImport.ts
import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import {
  mappingCacheRepo,
  createCopilotRepository,
  keychainRepo,
  createSimplicateRepository,
  createCalendarRepository,
  createFetchCalendarEventsUseCase,
  createGroupAndClassifyDayUseCase,
} from '../../application/container'
import { ParseBrowserHistoryUseCase, ParseError } from '../../domain/usecases/ParseBrowserHistoryUseCase'
import { BookTemplateUseCase } from '../../domain/usecases/BookTemplateUseCase'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { CalendarEvent } from '../../domain/entities/CalendarEvent'
import type { CachedMapping } from '../../domain/repositories/IMappingCacheRepository'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type ImportStatus = 'idle' | 'parsing' | 'classifying' | 'ready' | 'booking' | 'done'

export interface ImportState {
  status: ImportStatus
  error: string | null
  blocks: ClassifiedBlock[]
  minVisits: number
  setMinVisits: (n: number) => void
  analyseFile: (csvContent: string) => Promise<void>
  updateBlock: (index: number, updates: Partial<ClassifiedBlock>) => void
  removeBlock: (index: number) => void
  confirmBlock: (index: number, mapping: CachedMapping) => Promise<void>
  bookAll: () => Promise<void>
  bookingResults: Record<number, 'success' | 'error' | string>
  selectedBlockIndex: number | null
  openBlock: (index: number) => void
  closeBlock: () => void
  fetchServices: (projectId: string) => Promise<{ id: string; name: string }[]>
  hasCalendarScope: boolean
}

export function useImport(): ImportState {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<ClassifiedBlock[]>([])
  const [minVisits, setMinVisits] = useState(3)
  const [bookingResults, setBookingResults] = useState<Record<number, 'success' | 'error' | string>>({})
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null)
  const [hasCalendarScope, setHasCalendarScope] = useState(true)

  const openBlock = useCallback((index: number) => {
    setSelectedBlockIndex(index)
  }, [])

  const closeBlock = useCallback(() => {
    setSelectedBlockIndex(null)
  }, [])

  const fetchServices = useCallback(async (projectId: string) => {
    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    if (!apiKey || !apiSecret) return []
    const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    return simplicateRepo.getServices(projectId)
  }, [])

  const projects = useAppStore(s => s.projects)
  const services = useAppStore(s => s.services)
  const copilotToken = useAppStore(s => s.copilotToken)

  const analyseFile = useCallback(async (csvContent: string) => {
    setError(null)
    setStatus('parsing')
    try {
      await mappingCacheRepo.load()

      const parseUseCase = new ParseBrowserHistoryUseCase()
      const historyBlocks = await parseUseCase.execute(csvContent, minVisits)

      if (historyBlocks.length === 0) {
        setBlocks([])
        setStatus('ready')
        return
      }

      if (projects.length === 0) {
        setError('Laad eerst je projecten via de instellingen.')
        setStatus('idle')
        return
      }

      const token = copilotToken
      if (!token) {
        setError('Stel eerst een GitHub Copilot token in via de instellingen.')
        setStatus('idle')
        return
      }

      // Determine date range from parsed blocks
      const dates = historyBlocks.map(b => b.date).sort()
      const startDate = new Date(dates[0]! + 'T00:00:00')
      const endDate = new Date(dates[dates.length - 1]! + 'T23:59:59')

      // Fetch calendar events — never blocks the import on failure
      let calendarEvents: CalendarEvent[] = []
      try {
        const calendarRepo = createCalendarRepository()
        const hasScope = await calendarRepo.hasCalendarScope()
        console.log('[Calendar] hasCalendarScope:', hasScope)
        setHasCalendarScope(hasScope)
        if (hasScope) {
          const calendarUc = createFetchCalendarEventsUseCase()
          calendarEvents = await calendarUc.execute(startDate, endDate)
          console.log('[Calendar] fetched events:', calendarEvents.length, calendarEvents.map(e => `${e.start.toISOString()} ${e.title}`))
        }
      } catch (err) {
        console.error('[Calendar] fetch failed:', err)
        calendarEvents = []
      }

      setStatus('classifying')

      const copilotRepo = createCopilotRepository(token)
      const groupAndClassifyUseCase = createGroupAndClassifyDayUseCase(copilotRepo, projects, services)

      // Group unique dates, classify each day
      const uniqueDates = [...new Set(historyBlocks.map(b => b.date))].sort()
      const allDayBlocks: ClassifiedBlock[] = []

      for (const date of uniqueDates) {
        const dayBlocks = historyBlocks.filter(b => b.date === date)
        const dayEvents = calendarEvents.filter(e => {
          const evDate = `${e.start.getFullYear()}-${String(e.start.getMonth() + 1).padStart(2, '0')}-${String(e.start.getDate()).padStart(2, '0')}`
          return evDate === date
        })
        const classified = await groupAndClassifyUseCase.execute(date, dayBlocks, dayEvents)
        allDayBlocks.push(...classified)
      }

      // Sort by date + startTime
      const allBlocks = allDayBlocks.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return a.startTime.localeCompare(b.startTime)
      })

      setBlocks(allBlocks)
      setStatus('ready')
    } catch (e) {
      if (e instanceof ParseError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
      setStatus('idle')
    }
  }, [minVisits, projects, services, copilotToken])

  const updateBlock = useCallback((index: number, updates: Partial<ClassifiedBlock>) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...updates } : b))
  }, [])

  const removeBlock = useCallback((index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index))
  }, [])

  const confirmBlock = useCallback(async (index: number, mapping: CachedMapping) => {
    await mappingCacheRepo.set(blocks[index]!.urlPattern, {
      projectId: mapping.projectId,
      serviceId: mapping.serviceId,
      note: mapping.note,
      blockName: blocks[index]!.blockName,
      summary: blocks[index]!.summary,
    })
    updateBlock(index, {
      projectId: mapping.projectId,
      serviceId: mapping.serviceId,
      note: mapping.note,
      origin: 'manual',
      confidence: 1.0,
    })
  }, [blocks, updateBlock])

  const bookAll = useCallback(async () => {
    setStatus('booking')
    const results: Record<number, 'success' | 'error' | string> = {}

    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    const employeeId = await keychainRepo.get('simplicate-employee-id')
    if (!apiKey || !apiSecret || !employeeId) {
      setError('Simplicate credentials niet ingesteld.')
      setStatus('idle')
      return
    }
    const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    const bookTemplate = new BookTemplateUseCase(simplicateRepo)

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!
      if (!block.projectId || !block.serviceId) {
        results[i] = 'Ontbrekende project of dienst'
        continue
      }
      try {
        await bookTemplate.execute({
          template: {
            id: `import-${i}`,
            name: block.blockName,
            type: 'single',
            color: '#6c63ff',
            projectId: block.projectId,
            serviceId: block.serviceId,
            startTime: block.startTime,
            endTime: block.endTime,
          },
          employeeId,
          note: block.note ?? '',
          weekStartDate: block.date,
        })
        results[i] = 'success'
        // Only cache mappings for non-calendar blocks (calendar blocks have synthetic urlPattern)
        if (block.origin !== 'calendar') {
          await mappingCacheRepo.set(block.urlPattern, {
            projectId: block.projectId,
            serviceId: block.serviceId,
            note: block.note ?? '',
            blockName: block.blockName,
            summary: block.summary,
          })
        }
      } catch (e) {
        results[i] = e instanceof Error ? e.message : 'error'
      }
    }

    setBookingResults(results)
    setStatus('done')
  }, [blocks])

  return {
    status,
    error,
    blocks,
    minVisits,
    setMinVisits,
    analyseFile,
    updateBlock,
    removeBlock,
    confirmBlock,
    bookAll,
    bookingResults,
    selectedBlockIndex,
    openBlock,
    closeBlock,
    fetchServices,
    hasCalendarScope,
  }
}
