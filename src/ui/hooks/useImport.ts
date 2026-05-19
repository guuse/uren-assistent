// src/ui/hooks/useImport.ts
import { useState, useCallback } from 'react'
import { useAppStore } from '../../store/appStore'
import { mappingCacheRepo, createCopilotRepository, keychainRepo, createSimplicateRepository } from '../../application/container'
import { ParseBrowserHistoryUseCase, ParseError } from '../../domain/usecases/ParseBrowserHistoryUseCase'
import { ClassifyHistoryBlocksUseCase } from '../../domain/usecases/ClassifyHistoryBlocksUseCase'
import { BookTemplateUseCase } from '../../domain/usecases/BookTemplateUseCase'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
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
}

export function useImport(): ImportState {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<ClassifiedBlock[]>([])
  const [minVisits, setMinVisits] = useState(3)
  const [bookingResults, setBookingResults] = useState<Record<number, 'success' | 'error' | string>>({})

  const projects = useAppStore(s => s.projects)
  const services = useAppStore(s => s.services)
  const copilotToken = useAppStore(s => s.copilotToken)
  // TODO: store.user is not yet in appStore — using keychainRepo for employee lookup in bookAll
  // store.simplicateEmployeeId is also missing; we retrieve employee id at booking time

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

      setStatus('classifying')

      if (projects.length === 0) {
        setError('Laad eerst je projecten via de instellingen.')
        setStatus('idle')
        return
      }

      const token = copilotToken ?? ''
      const copilotRepo = createCopilotRepository(token)
      const classifyUseCase = new ClassifyHistoryBlocksUseCase(copilotRepo, mappingCacheRepo)

      const classified = await classifyUseCase.execute(historyBlocks, projects, services)
      setBlocks(classified)
      setStatus('ready')
    } catch (e) {
      if (e instanceof ParseError) {
        setError(e.message)
      } else {
        setError('Er is een onverwachte fout opgetreden.')
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
    await mappingCacheRepo.set(blocks[index]!.urlPattern, mapping)
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

    // Retrieve credentials at booking time (same pattern as useBooking)
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
            name: block.urlPattern,
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
        await mappingCacheRepo.set(block.urlPattern, {
          projectId: block.projectId,
          serviceId: block.serviceId,
          note: block.note ?? '',
        })
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
  }
}
