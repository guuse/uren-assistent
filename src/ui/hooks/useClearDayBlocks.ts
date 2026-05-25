import { useState, useCallback } from 'react'
import { createClearDayBlocksUseCase } from '../../application/container'

export function useClearDayBlocks(onSuccess: (date: string) => void) {
  const [isClearing, setIsClearing] = useState(false)

  const clearDay = useCallback(async (date: string) => {
    setIsClearing(true)
    try {
      const useCase = createClearDayBlocksUseCase()
      await useCase.execute(date)
      onSuccess(date)
    } finally {
      setIsClearing(false)
    }
  }, [onSuccess])

  return { clearDay, isClearing }
}
