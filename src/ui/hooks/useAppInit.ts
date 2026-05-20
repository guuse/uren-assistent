import { useEffect } from 'react'
import { keychainRepo } from '../../application/container'
import { useAppStore } from '../../store/appStore'

export function useAppInit(): void {
  const setCopilotToken = useAppStore(s => s.setCopilotToken)

  useEffect(() => {
    async function init() {
      try {
        const ct = await keychainRepo.get('copilot-token')
        if (ct) setCopilotToken(ct)
      } catch (err) {
        console.error('[AppInit] Failed to load copilot token from keychain:', err)
      }
    }
    void init()
  }, [setCopilotToken])
}
