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
  const { logout } = useAuth()

  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [hasExisting, setHasExisting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string | null>(null)

  useEffect(() => {
    async function loadExisting() {
      const key = await keychainRepo.get('simplicate-api-key')
      const secret = await keychainRepo.get('simplicate-api-secret')
      if (key && secret) setHasExisting(true)
    }
    void loadExisting()
  }, [])

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
      // getProjects is the simplest reliable auth check
      const projects = await repo.getProjects()
      // Also look up employee ID if we have a user email
      if (user?.email) {
        try {
          const employee = await repo.getEmployee(user.email)
          setSimplicateEmployeeId(employee.id)
        } catch {
          // Not fatal — employee lookup failure doesn't block the connection test
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-widest text-gray-400">Ingelogd als</div>
        <div className="text-white text-sm">{user?.name} ({user?.email})</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-gray-400">Simplicate API</div>

        {hasExisting && apiKey === '' && (
          <div className="text-xs text-gray-500 bg-[#1a1a2e] rounded-lg px-3 py-2 border border-gray-700">
            Credentials zijn opgeslagen. Vul nieuwe in om te overschrijven.
          </div>
        )}

        <input
          type="text"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setTestState('idle') }}
          placeholder={hasExisting ? 'API Key (laat leeg om huidig te bewaren)' : 'API Key'}
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
        />
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => { setApiSecret(e.target.value); setTestState('idle') }}
          placeholder={hasExisting ? 'API Secret (laat leeg om huidig te bewaren)' : 'API Secret'}
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={testConnection}
            disabled={!canTest || testState === 'testing'}
            className="flex-1 bg-[#2d2d44] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg border border-gray-600 hover:border-[#6c63ff] transition-colors"
          >
            {testState === 'testing' ? 'Testen...' : 'Test verbinding'}
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 bg-[#6c63ff] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg"
          >
            {saved ? '✓ Opgeslagen' : 'Opslaan'}
          </button>
        </div>

        {testState === 'ok' && (
          <div className="bg-green-900/40 text-green-300 text-sm rounded-lg px-3 py-2">
            ✓ Verbinding geslaagd
          </div>
        )}
        {testState === 'fail' && (
          <div className="bg-red-900/40 text-red-300 text-sm rounded-lg px-3 py-2">
            {testError ?? 'Verbinding mislukt'}
          </div>
        )}
      </div>

      <button
        onClick={logout}
        className="text-red-400 hover:text-red-300 text-sm self-start transition-colors"
      >
        Uitloggen
      </button>
    </div>
  )
}
