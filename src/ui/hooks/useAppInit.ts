import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { keychainRepo, createGetSelectedModelUseCase } from '../../application/container'
import { useAppStore } from '../../store/appStore'
import { testCopilotToken, testGitHubToken, testLinearToken } from '../../infrastructure/tokenTest'

export function useAppInit(): void {
  const setCopilotToken = useAppStore(s => s.setCopilotToken)
  const setGithubToken = useAppStore(s => s.setGithubToken)
  const setGithubUsername = useAppStore(s => s.setGithubUsername)
  const setLinearToken = useAppStore(s => s.setLinearToken)
  const setTokenStatus = useAppStore(s => s.setTokenStatus)
  const setSelectedCopilotModel = useAppStore(s => s.setSelectedCopilotModel)

  useEffect(() => {
    async function init() {
      try {
        await invoke('ensure_app_data_dir')
        const ct = await keychainRepo.get('copilot-token')
        if (ct) {
          setCopilotToken(ct)
          testCopilotToken(ct).then(r => setTokenStatus('copilot', r.ok ? 'ok' : 'fail')).catch(() => setTokenStatus('copilot', 'fail'))
        }

        const gt = await keychainRepo.get('github-token')
        if (gt) {
          setGithubToken(gt)
          testGitHubToken(gt).then(r => setTokenStatus('github', r.ok ? 'ok' : 'fail')).catch(() => setTokenStatus('github', 'fail'))
        }

        const gu = await keychainRepo.get('github-username')
        if (gu) setGithubUsername(gu)

        const lt = await keychainRepo.get('linear-token')
        if (lt) {
          setLinearToken(lt)
          testLinearToken(lt).then(r => setTokenStatus('linear', r.ok ? 'ok' : 'fail')).catch(() => setTokenStatus('linear', 'fail'))
        }

        try {
          const selectedModel = await createGetSelectedModelUseCase().execute()
          if (selectedModel) {
            setSelectedCopilotModel(selectedModel)
          }
        } catch {
          console.warn('[AppInit] Could not load saved model, using default')
        }
      } catch (err) {
        console.error('[AppInit] Failed to load tokens from keychain:', err)
      }
    }
    void init()
  }, [setCopilotToken, setGithubToken, setGithubUsername, setLinearToken, setTokenStatus, setSelectedCopilotModel])
}
