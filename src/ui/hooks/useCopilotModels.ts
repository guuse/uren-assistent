// src/ui/hooks/useCopilotModels.ts
import { useState, useEffect, useCallback } from 'react'
import type { CopilotModel } from '../../domain/entities/CopilotModel'
import { createCopilotRepository, createGetCopilotModelsUseCase } from '../../application/container'
import { useAppStore } from '../../store/appStore'

export function useCopilotModels(): { models: CopilotModel[]; loading: boolean; error: string | null } {
  const copilotToken = useAppStore((s) => s.copilotToken)
  const [models, setModels] = useState<CopilotModel[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    if (!copilotToken) return

    setLoading(true)
    setFetchError(null)

    const copilotRepo = createCopilotRepository(copilotToken)
    const useCase = createGetCopilotModelsUseCase(copilotRepo)

    try {
      const result = await useCase.execute()
      setModels(result)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Ophalen modellen mislukt')
    } finally {
      setLoading(false)
    }
  }, [copilotToken])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchModels()
  }, [fetchModels])

  // Derive the no-token error outside the effect
  const error = !copilotToken ? 'Geen Copilot token ingesteld' : fetchError

  return { models, loading, error }
}
