import { useState, useCallback } from 'react'
import { createClearWeekBlocksUseCase } from '../../application/container'

export function useClearWeekBlocks(onSuccess: (weekDays: string[]) => void) {
  const [isClearingWeek, setIsClearingWeek] = useState(false)
  const [clearWeekError, setClearWeekError] = useState<string | null>(null)

  const clearWeek = useCallback(async (weekDays: string[]) => {
    setIsClearingWeek(true)
    setClearWeekError(null)
    try {
      const useCase = createClearWeekBlocksUseCase()
      await useCase.execute(weekDays)
      onSuccess(weekDays)
    } catch (err) {
      setClearWeekError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setIsClearingWeek(false)
    }
  }, [onSuccess])

  return { clearWeek, isClearingWeek, clearWeekError }
}
