import { useState, useEffect, useCallback } from 'react'
import { historyStore } from '../../application/container'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

export function useHistoryStore(selectedDate: string) {
  const [blocksForDate, setBlocksForDate] = useState<ClassifiedBlock[]>([])
  const [hasData, setHasData] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const reload = useCallback(async (date: string) => {
    await historyStore.load()
    const blocks = await historyStore.getBlocksForDate(date)
    const has = await historyStore.hasDataForDate(date)
    setBlocksForDate(blocks)
    setHasData(has)
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    setBlocksForDate([])
    setHasData(false)
    setIsLoaded(false)
    void reload(selectedDate)
  }, [selectedDate, reload])

  const saveBlocksForDate = useCallback(async (date: string, blocks: ClassifiedBlock[]) => {
    await historyStore.setBlocksForDate(date, blocks)
    void reload(date)
  }, [reload])

  const removeBlock = useCallback(async (date: string, urlPattern: string) => {
    await historyStore.removeBlock(date, urlPattern)
    void reload(date)
  }, [reload])

  const conceptCountForDate = useCallback(async (date: string): Promise<number> => {
    const blocks = await historyStore.getBlocksForDate(date)
    return blocks.length
  }, [])

  return {
    blocksForDate,
    hasData,
    isLoaded,
    saveBlocksForDate,
    removeBlock,
    conceptCountForDate,
    reloadForDate: reload,
  }
}
