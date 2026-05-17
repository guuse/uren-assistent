import { useState } from 'react'
import { keychainRepo } from '../../../application/container'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../../store/appStore'

export function AccountSettings() {
  const user = useAppStore((s) => s.user)
  const { logout } = useAuth()
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    await keychainRepo.set('simplicate-api-key', apiKey)
    await keychainRepo.set('simplicate-api-secret', apiSecret)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-widest text-gray-400">Ingelogd als</div>
        <div className="text-white text-sm">{user?.name} ({user?.email})</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-gray-400">Simplicate API</div>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
        />
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder="API Secret"
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
        />
        <button
          onClick={save}
          disabled={!apiKey || !apiSecret}
          className="bg-[#6c63ff] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg"
        >
          {saved ? '✓ Opgeslagen' : 'Opslaan'}
        </button>
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
