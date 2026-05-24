// src/ui/hooks/useImport.ts
import { useState, useCallback } from 'react'
import {
  mappingCacheRepo,
  keychainRepo,
  createSimplicateRepository,
} from '../../application/container'
import { ParseBrowserHistoryUseCase, ParseError } from '../../domain/usecases/ParseBrowserHistoryUseCase'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { HistoryBlock } from '../../domain/entities/HistoryBlock'
import type { CachedMapping } from '../../domain/repositories/IMappingCacheRepository'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type ImportStatus = 'idle' | 'parsing' | 'classifying' | 'ready' | 'booking' | 'done'

export interface UploadResult {
  dateCount: number
  dateFrom: string
  dateTo: string
  blocks: HistoryBlock[]
}

export interface ImportState {
  status: ImportStatus
  error: string | null
  blocks: ClassifiedBlock[]
  minVisits: number
  setMinVisits: (n: number) => void
  analyseFile: (csvContent: string) => Promise<UploadResult | null>
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
  const [hasCalendarScope] = useState(true)

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

  const analyseFile = useCallback(async (csvContent: string): Promise<UploadResult | null> => {
    setError(null)
    setStatus('parsing')
    try {
      const parseUseCase = new ParseBrowserHistoryUseCase()
      const rawBlocks = await parseUseCase.execute(csvContent, minVisits)

      if (rawBlocks.length === 0) {
        setBlocks([] as ClassifiedBlock[])
        setStatus('ready')
        return null
      }

      setBlocks(rawBlocks as unknown as ClassifiedBlock[])
      setStatus('ready')

      const dates = [...new Set(rawBlocks.map(b => b.date))].sort()
      return {
        dateCount: dates.length,
        dateFrom: dates[0]!,
        dateTo: dates[dates.length - 1]!,
        blocks: rawBlocks,
      }
    } catch (e) {
      if (e instanceof ParseError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
      setStatus('idle')
      return null
    }
  }, [minVisits])

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
      confidence: 1,
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

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!
      if (!block.projectId || !block.serviceId) {
        results[i] = 'Ontbrekende project of dienst'
        continue
      }
      try {
        const [sh, sm] = block.startTime.split(':').map(Number)
        const [eh, em] = block.endTime.split(':').map(Number)
        const hours = ((eh! * 60 + em!) - (sh! * 60 + sm!)) / 60
        await simplicateRepo.bookHours([{
          employeeId,
          projectId: block.projectId,
          projectServiceId: block.serviceId,
          hourTypeId: '',
          hours,
          startDate: block.date,
          startTime: block.startTime,
          endTime: block.endTime,
          note: block.note ?? '',
        }])
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
