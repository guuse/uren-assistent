import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import type { CachedMapping } from '../../domain/repositories/IMappingCacheRepository'

const parseExecute = vi.fn()
vi.mock('../../domain/usecases/ParseBrowserHistoryUseCase', () => {
  class ParseError extends Error {}
  return {
    ParseError,
    ParseBrowserHistoryUseCase: class {
      execute(...a: unknown[]) {
        return parseExecute(...a)
      }
    },
  }
})
import { ParseError } from '../../domain/usecases/ParseBrowserHistoryUseCase'

const keychainGet = vi.fn()
const mappingSet = vi.fn()
const getServices = vi.fn()
const bookHours = vi.fn()
const createSimplicateRepository = vi.fn(() => ({
  getServices: (p: string, d: string) => getServices(p, d),
  bookHours: (e: unknown) => bookHours(e),
}))

vi.mock('../../application/container', () => ({
  keychainRepo: { get: (k: string) => keychainGet(k) },
  mappingCacheRepo: { set: (p: string, m: unknown) => mappingSet(p, m) },
  createSimplicateRepository: () => createSimplicateRepository(),
}))

import { useImport } from './useImport'

function block(overrides: Partial<ClassifiedBlock> = {}): ClassifiedBlock {
  return {
    urlPattern: 'github.com/*',
    blockName: 'Coding',
    summary: 'work',
    date: '2026-05-01',
    startTime: '09:00',
    endTime: '10:00',
    projectId: 'p1',
    serviceId: 's1',
    note: 'n',
    origin: 'history',
    confidence: 0.5,
    ...overrides,
  } as unknown as ClassifiedBlock
}

describe('useImport', () => {
  beforeEach(() => {
    parseExecute.mockReset()
    keychainGet.mockReset().mockResolvedValue('secret')
    mappingSet.mockReset().mockResolvedValue(undefined)
    getServices.mockReset().mockResolvedValue([{ id: 's1', name: 'Svc' }])
    bookHours.mockReset().mockResolvedValue(undefined)
    createSimplicateRepository.mockClear()
  })

  it('starts idle', () => {
    const { result } = renderHook(() => useImport())
    expect(result.current.status).toBe('idle')
    expect(result.current.hasCalendarScope).toBe(true)
  })

  it('open/close block tracks selected index', () => {
    const { result } = renderHook(() => useImport())
    act(() => result.current.openBlock(2))
    expect(result.current.selectedBlockIndex).toBe(2)
    act(() => result.current.closeBlock())
    expect(result.current.selectedBlockIndex).toBeNull()
  })

  it('setMinVisits updates the threshold', () => {
    const { result } = renderHook(() => useImport())
    act(() => result.current.setMinVisits(5))
    expect(result.current.minVisits).toBe(5)
  })

  it('analyseFile returns a summary for parsed blocks', async () => {
    parseExecute.mockResolvedValue([
      { ...block(), date: '2026-05-02' },
      { ...block(), date: '2026-05-01' },
    ])
    const { result } = renderHook(() => useImport())
    let res: unknown
    await act(async () => {
      res = await result.current.analyseFile('csv')
    })
    expect(res).toEqual(
      expect.objectContaining({ dateCount: 2, dateFrom: '2026-05-01', dateTo: '2026-05-02' }),
    )
    expect(result.current.status).toBe('ready')
    expect(result.current.blocks.length).toBe(2)
  })

  it('analyseFile returns null when no blocks parsed', async () => {
    parseExecute.mockResolvedValue([])
    const { result } = renderHook(() => useImport())
    let res: unknown = 'x'
    await act(async () => {
      res = await result.current.analyseFile('csv')
    })
    expect(res).toBeNull()
    expect(result.current.status).toBe('ready')
    expect(result.current.blocks).toEqual([])
  })

  it('analyseFile sets a ParseError message', async () => {
    parseExecute.mockRejectedValue(new ParseError('bad csv'))
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    expect(result.current.error).toBe('bad csv')
    expect(result.current.status).toBe('idle')
  })

  it('analyseFile sets a generic Error message', async () => {
    parseExecute.mockRejectedValue(new Error('explode'))
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    expect(result.current.error).toBe('explode')
  })

  it('analyseFile stringifies non-Error throws', async () => {
    parseExecute.mockRejectedValue('weird')
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    expect(result.current.error).toBe('weird')
  })

  it('updateBlock and removeBlock mutate the list', async () => {
    parseExecute.mockResolvedValue([block(), { ...block(), blockName: 'Two' }])
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    act(() => result.current.updateBlock(0, { note: 'updated' }))
    expect(result.current.blocks[0]!.note).toBe('updated')
    act(() => result.current.removeBlock(1))
    expect(result.current.blocks.length).toBe(1)
  })

  it('confirmBlock caches the mapping and updates the block', async () => {
    parseExecute.mockResolvedValue([block()])
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    const mapping: CachedMapping = { projectId: 'p9', serviceId: 's9', note: 'm' } as CachedMapping
    await act(async () => {
      await result.current.confirmBlock(0, mapping)
    })
    expect(mappingSet).toHaveBeenCalledWith('github.com/*', expect.objectContaining({ projectId: 'p9' }))
    expect(result.current.blocks[0]!.origin).toBe('manual')
    expect(result.current.blocks[0]!.confidence).toBe(1)
  })

  it('fetchServices returns services', async () => {
    const { result } = renderHook(() => useImport())
    let svc: unknown
    await act(async () => {
      svc = await result.current.fetchServices('p1')
    })
    expect(svc).toEqual([{ id: 's1', name: 'Svc' }])
  })

  it('fetchServices returns empty when credentials are missing', async () => {
    keychainGet.mockResolvedValue(null)
    const { result } = renderHook(() => useImport())
    let svc: unknown
    await act(async () => {
      svc = await result.current.fetchServices('p1')
    })
    expect(svc).toEqual([])
    expect(getServices).not.toHaveBeenCalled()
  })

  it('bookAll books valid blocks and caches non-calendar mappings', async () => {
    parseExecute.mockResolvedValue([block()])
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    await act(async () => {
      await result.current.bookAll()
    })
    expect(bookHours).toHaveBeenCalled()
    expect(result.current.bookingResults[0]).toBe('success')
    expect(result.current.status).toBe('done')
    expect(mappingSet).toHaveBeenCalled()
  })

  it('bookAll skips mapping cache for calendar blocks', async () => {
    parseExecute.mockResolvedValue([{ ...block(), origin: 'calendar' }])
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    mappingSet.mockClear()
    await act(async () => {
      await result.current.bookAll()
    })
    expect(result.current.bookingResults[0]).toBe('success')
    expect(mappingSet).not.toHaveBeenCalled()
  })

  it('bookAll flags blocks missing project or service', async () => {
    parseExecute.mockResolvedValue([{ ...block(), projectId: '' }])
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    await act(async () => {
      await result.current.bookAll()
    })
    expect(result.current.bookingResults[0]).toBe('Ontbrekende project of dienst')
    expect(bookHours).not.toHaveBeenCalled()
  })

  it('bookAll records an error message when booking throws', async () => {
    parseExecute.mockResolvedValue([block()])
    bookHours.mockRejectedValue(new Error('book fail'))
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    await act(async () => {
      await result.current.bookAll()
    })
    expect(result.current.bookingResults[0]).toBe('book fail')
  })

  it('bookAll records a fallback error for non-Error throws', async () => {
    parseExecute.mockResolvedValue([block()])
    bookHours.mockRejectedValue('weird')
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    await act(async () => {
      await result.current.bookAll()
    })
    expect(result.current.bookingResults[0]).toBe('error')
  })

  it('bookAll aborts when credentials are missing', async () => {
    parseExecute.mockResolvedValue([block()])
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    keychainGet.mockResolvedValue(null)
    await act(async () => {
      await result.current.bookAll()
    })
    expect(result.current.error).toContain('credentials')
    expect(result.current.status).toBe('idle')
  })

  it('bookAll uses an empty note when block.note is absent', async () => {
    parseExecute.mockResolvedValue([{ ...block(), note: undefined }])
    const { result } = renderHook(() => useImport())
    await act(async () => {
      await result.current.analyseFile('csv')
    })
    await act(async () => {
      await result.current.bookAll()
    })
    expect(bookHours).toHaveBeenCalledWith([expect.objectContaining({ note: '' })])
  })
})
