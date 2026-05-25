// src/ui/hooks/useCopilotModels.ts
import { useState, useEffect } from 'react'
import type { CopilotModel } from '../../domain/entities/CopilotModel'
import { createCopilotRepository, createGetCopilotModelsUseCase } from '../../application/container'
import { useAppStore } from '../../store/appStore'

export function useCopilotModels(): { models: CopilotModel[]; loading: boolean; error: string | null } {
  const copilotToken = useAppStore((s) => s.copilotToken)
  const [models, setModels] = useState<CopilotModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!copilotToken) {
      setError('Geen Copilot token ingesteld')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const copilotRepo = createCopilotRepository(copilotToken)
    const useCase = createGetCopilotModelsUseCase(copilotRepo)

    useCase
      .execute()
      .then((result) => {
        if (!cancelled) {
          setModels(result)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ophalen modellen mislukt')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [copilotToken])

  return { models, loading, error }
}
