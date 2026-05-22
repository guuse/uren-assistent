import { useState, useEffect } from 'react'
import { keychainRepo, createSimplicateRepository } from '../../../application/container'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../../store/appStore'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export function AccountSettings() {
  const user = useAppStore((s) => s.user)
  const setSimplicateData = useAppStore((s) => s.setSimplicateData)
  const setSimplicateEmployeeId = useAppStore((s) => s.setSimplicateEmployeeId)
  const setCopilotToken = useAppStore((s) => s.setCopilotToken)
  const { logout } = useAuth()

  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [hasExisting, setHasExisting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string | null>(null)

  const [copilotTokenInput, setCopilotTokenInput] = useState('')
  const [hasCopilotToken, setHasCopilotToken] = useState(false)
  const [copilotSaved, setCopilotSaved] = useState(false)

  useEffect(() => {
    async function loadExisting() {
      const key = await keychainRepo.get('simplicate-api-key')
      const secret = await keychainRepo.get('simplicate-api-secret')
      if (key && secret) setHasExisting(true)
      const ct = await keychainRepo.get('copilot-token')
      if (ct) { setHasCopilotToken(true); setCopilotToken(ct) }
    }
    void loadExisting()
  }, [setCopilotToken])

  async function save() {
    await keychainRepo.set('simplicate-api-key', apiKey)
    await keychainRepo.set('simplicate-api-secret', apiSecret)
    setHasExisting(true)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testConnection() {
    setTestState('testing')
    setTestError(null)
    try {
      const key = apiKey || await keychainRepo.get('simplicate-api-key')
      const secret = apiSecret || await keychainRepo.get('simplicate-api-secret')
      if (!key || !secret) {
        setTestState('fail')
        setTestError('Geen credentials ingevuld.')
        return
      }
      const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, key, secret)
      const projects = await repo.getProjects()
      if (user?.email) {
        try {
          const employee = await repo.getEmployee(user.email)
          setSimplicateEmployeeId(employee.id)
        } catch {
          // Not fatal
        }
      }
      const [hourTypes] = await Promise.all([repo.getHourTypes()])
      setSimplicateData({ projects, services: [], hourTypes })
      setTestState('ok')
    } catch (err) {
      setTestState('fail')
      const msg = err instanceof Error ? err.message : String(err)
      setTestError(msg.includes('401') ? 'Ongeldige API key of secret (401).' : msg)
    }
  }

  const canSave = apiKey.length > 0 && apiSecret.length > 0
  const canTest = canSave || hasExisting

  async function saveCopilotToken() {
    await keychainRepo.set('copilot-token', copilotTokenInput)
    setCopilotToken(copilotTokenInput)
    setHasCopilotToken(true)
    setCopilotSaved(true)
    setTimeout(() => setCopilotSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">Ingelogd als</div>
        <div className="text-[#e8e2d9] text-sm">{user?.name} ({user?.email})</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">Simplicate API</div>

        {hasExisting && apiKey === '' && (
          <div className="text-xs text-[#4a4540] bg-[#1e1b18] rounded-lg px-3 py-2 border border-[#2e2a26]">
            Credentials zijn opgeslagen. Vul nieuwe in om te overschrijven.
          </div>
        )}

        <input
          type="text"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setTestState('idle') }}
          placeholder={hasExisting ? 'API Key (laat leeg om huidig te bewaren)' : 'API Key'}
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => { setApiSecret(e.target.value); setTestState('idle') }}
          placeholder={hasExisting ? 'API Secret (laat leeg om huidig te bewaren)' : 'API Secret'}
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={testConnection}
            disabled={!canTest || testState === 'testing'}
            className="flex-1 bg-[#252220] disabled:opacity-40 text-[#e8e2d9] text-sm font-medium py-2 rounded-lg border border-[#2e2a26] hover:border-[#3e3a36] transition-colors"
          >
            {testState === 'testing' ? 'Testen...' : 'Test verbinding'}
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
          >
            {saved ? '✓ Opgeslagen' : 'Opslaan'}
          </button>
        </div>

        {testState === 'ok' && (
          <div className="bg-[#1a2b1e] text-[#5a8a6a] text-sm rounded-lg px-3 py-2">
            ✓ Verbinding geslaagd
          </div>
        )}
        {testState === 'fail' && (
          <div className="bg-[#221e1b] text-[#b85a3a] text-sm rounded-lg px-3 py-2">
            {testError ?? 'Verbinding mislukt'}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">GitHub Copilot token</div>
        <div className="text-xs text-[#4a4540]">
          Verkrijg via: <code className="bg-[#1e1b18] px-1 rounded">gh auth token</code> in een terminal.
        </div>

        {hasCopilotToken && copilotTokenInput === '' && (
          <div className="text-xs text-[#4a4540] bg-[#1e1b18] rounded-lg px-3 py-2 border border-[#2e2a26]">
            Token is opgeslagen. Vul een nieuw token in om te overschrijven.
          </div>
        )}

        <input
          type="password"
          value={copilotTokenInput}
          onChange={e => setCopilotTokenInput(e.target.value)}
          placeholder={hasCopilotToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'ghu_...'}
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />

        <button
          onClick={saveCopilotToken}
          disabled={copilotTokenInput.length === 0}
          className="bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
        >
          {copilotSaved ? '✓ Opgeslagen' : 'Opslaan'}
        </button>
      </div>

      <button
        onClick={logout}
        className="text-[#b85a3a] hover:text-[#c86a4a] text-sm self-start transition-colors"
      >
        Uitloggen
      </button>
    </div>
  )
}
