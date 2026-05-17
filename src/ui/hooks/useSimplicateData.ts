import { useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export function useSimplicateData() {
  const user = useAppStore((s) => s.user)
  const setSimplicateData = useAppStore((s) => s.setSimplicateData)
  const setError = useAppStore((s) => s.setError)

  useEffect(() => {
    if (!user?.id) return

    async function load() {
      try {
        const apiKey = await keychainRepo.get('simplicate-api-key')
        const apiSecret = await keychainRepo.get('simplicate-api-secret')
        if (!apiKey || !apiSecret) return

        const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
        const { fetchSimplicateData } = createUseCases(simplicateRepo)
        const data = await fetchSimplicateData.execute()
        setSimplicateData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kon Simplicate data niet laden')
      }
    }

    void load()
  }, [user?.id])
}
