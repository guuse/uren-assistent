import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export function useSimplicateData() {
  const user = useAppStore((s) => s.user)
  const setSimplicateData = useAppStore((s) => s.setSimplicateData)
  const setSimplicateEmployeeId = useAppStore((s) => s.setSimplicateEmployeeId)
  const [needsCredentials, setNeedsCredentials] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const sync = useCallback(async () => {
    if (!user) return
    setIsSyncing(true)
    setSyncError(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) {
        setNeedsCredentials(true)
        return
      }

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)

      // Look up employee to get Simplicate ID
      const employee = await simplicateRepo.getEmployee(user.email)
      setSimplicateEmployeeId(employee.id)

      const { fetchSimplicateData } = createUseCases(simplicateRepo)
      const data = await fetchSimplicateData.execute()
      setSimplicateData(data)
      setNeedsCredentials(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('401') || msg.includes('credentials') || msg.includes('Unauthorized')) {
        setNeedsCredentials(true)
      } else {
        setSyncError(msg)
      }
    } finally {
      setIsSyncing(false)
    }
  }, [user, setSimplicateData, setSimplicateEmployeeId])

  useEffect(() => {
    void sync()
  }, [sync])

  return { needsCredentials, isSyncing, syncError, sync }
}
