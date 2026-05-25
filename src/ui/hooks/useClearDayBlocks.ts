import { useState, useCallback } from 'react'
import { createClearDayBlocksUseCase } from '../../application/container'

export function useClearDayBlocks(onSuccess: (date: string) => void) {
  const [isClearing, setIsClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  const clearDay = useCallback(async (date: string) => {
    setIsClearing(true)
    setClearError(null)
    try {
      const useCase = createClearDayBlocksUseCase()
      await useCase.execute(date)
      onSuccess(date)
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setIsClearing(false)
    }
  }, [onSuccess])

  return { clearDay, isClearing, clearError }
}
