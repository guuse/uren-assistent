import { useState, useEffect } from 'react'
import { keychainRepo, createSimplicateRepository, createSetSelectedModelUseCase } from '../../../application/container'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../../store/appStore'
import { useStarredProjects } from '../../hooks/useStarredProjects'
import { testCopilotToken, testGitHubToken, testLinearToken } from '../../../infrastructure/tokenTest'
import { useCopilotModels } from '../../hooks/useCopilotModels'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export function AccountSettings() {
  const user = useAppStore((s) => s.user)
  const setSimplicateData = useAppStore((s) => s.setSimplicateData)
  const setSimplicateEmployeeId = useAppStore((s) => s.setSimplicateEmployeeId)
  const setCopilotToken = useAppStore((s) => s.setCopilotToken)
  const setGithubToken = useAppStore((s) => s.setGithubToken)
  const setGithubUsername = useAppStore((s) => s.setGithubUsername)
  const setLinearToken = useAppStore((s) => s.setLinearToken)
  const setTokenStatus = useAppStore((s) => s.setTokenStatus)
  const projects = useAppStore((s) => s.projects)
  const selectedCopilotModel = useAppStore((s) => s.selectedCopilotModel)
  const setSelectedCopilotModel = useAppStore((s) => s.setSelectedCopilotModel)
  const { logout } = useAuth()
  const { starredIds, toggle: toggleStar } = useStarredProjects()
  const { models, loading: modelsLoading, error: modelsError } = useCopilotModels()

  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [hasExisting, setHasExisting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string | null>(null)

  const [copilotTokenInput, setCopilotTokenInput] = useState('')
  const [hasCopilotToken, setHasCopilotToken] = useState(false)
  const [copilotSaved, setCopilotSaved] = useState(false)
  const [copilotTestState, setCopilotTestState] = useState<TestState>('idle')
  const [copilotTestLabel, setCopilotTestLabel] = useState<string | null>(null)

  const [githubTokenInput, setGithubTokenInput] = useState('')
  const [githubUsernameInput, setGithubUsernameInput] = useState('')
  const [hasGithubToken, setHasGithubToken] = useState(false)
  const [githubSaved, setGithubSaved] = useState(false)
  const [githubTestState, setGithubTestState] = useState<TestState>('idle')
  const [githubTestLabel, setGithubTestLabel] = useState<string | null>(null)

  const [linearTokenInput, setLinearTokenInput] = useState('')
  const [hasLinearToken, setHasLinearToken] = useState(false)
  const [linearSaved, setLinearSaved] = useState(false)
  const [linearTestState, setLinearTestState] = useState<TestState>('idle')
  const [linearTestLabel, setLinearTestLabel] = useState<string | null>(null)

  const [projectSearch, setProjectSearch] = useState('')

  useEffect(() => {
    async function loadExisting() {
      const key = await keychainRepo.get('simplicate-api-key')
      const secret = await keychainRepo.get('simplicate-api-secret')
      if (key && secret) setHasExisting(true)
      const ct = await keychainRepo.get('copilot-token')
      if (ct) { setHasCopilotToken(true); setCopilotToken(ct) }
      const gt = await keychainRepo.get('github-token')
      if (gt) { setHasGithubToken(true); setGithubToken(gt) }
      const gu = await keychainRepo.get('github-username')
      if (gu) { setGithubUsernameInput(gu); setGithubUsername(gu) }
      const lt = await keychainRepo.get('linear-token')
      if (lt) { setHasLinearToken(true); setLinearToken(lt) }
    }
    void loadExisting()
  }, [setCopilotToken, setGithubToken, setGithubUsername, setLinearToken])

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

  async function saveGithubToken() {
    await keychainRepo.set('github-token', githubTokenInput)
    setGithubToken(githubTokenInput)
    if (githubUsernameInput.trim()) {
      await keychainRepo.set('github-username', githubUsernameInput.trim())
      setGithubUsername(githubUsernameInput.trim())
    }
    setHasGithubToken(true)
    setGithubSaved(true)
    setTimeout(() => setGithubSaved(false), 2000)
  }

  async function saveLinearToken() {
    await keychainRepo.set('linear-token', linearTokenInput)
    setLinearToken(linearTokenInput)
    setHasLinearToken(true)
    setLinearSaved(true)
    setTimeout(() => setLinearSaved(false), 2000)
  }

  async function testCopilot() {
    const token = copilotTokenInput || await keychainRepo.get('copilot-token')
    if (!token) return
    setCopilotTestState('testing')
    const result = await testCopilotToken(token)
    setCopilotTestState(result.ok ? 'ok' : 'fail')
    setCopilotTestLabel(result.label)
    setTokenStatus('copilot', result.ok ? 'ok' : 'fail')
  }

  async function testGithub() {
    const token = githubTokenInput || await keychainRepo.get('github-token')
    if (!token) return
    setGithubTestState('testing')
    const result = await testGitHubToken(token)
    setGithubTestState(result.ok ? 'ok' : 'fail')
    setGithubTestLabel(result.label)
    setTokenStatus('github', result.ok ? 'ok' : 'fail')
  }

  async function testLinear() {
    const token = linearTokenInput || await keychainRepo.get('linear-token')
    if (!token) return
    setLinearTestState('testing')
    const result = await testLinearToken(token)
    setLinearTestState(result.ok ? 'ok' : 'fail')
    setLinearTestLabel(result.label)
    setTokenStatus('linear', result.ok ? 'ok' : 'fail')
  }

  async function handleModelChange(modelId: string) {
    const previous = selectedCopilotModel
    setSelectedCopilotModel(modelId)
    try {
      await createSetSelectedModelUseCase().execute(modelId)
    } catch (err) {
      setSelectedCopilotModel(previous)
      console.error('[Settings] Model opslaan mislukt:', err)
    }
  }

  const label = (p: { organizationName: string; name: string }) =>
    `${p.organizationName} — ${p.name}`

  const filteredProjects = [...projects]
    .filter((p) =>
      projectSearch.trim() === '' ||
      p.name.toLowerCase().includes(projectSearch.trim().toLowerCase())
    )
    .sort((a, b) => label(a).localeCompare(label(b)))

  const starredProjects = filteredProjects.filter((p) => starredIds.has(p.id))
  const unstarredProjects = filteredProjects.filter((p) => !starredIds.has(p.id))
  // TODO(Task 2): projectSearch, starredProjects, unstarredProjects used in JSX
  void projectSearch
  void setProjectSearch
  void starredProjects
  void unstarredProjects

  return (
    <div className="flex flex-col gap-6">
      {/* AI Model */}
      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">AI Model</div>
        {modelsLoading && (
          <p className="text-xs text-[#4a4540]">Modellen ophalen...</p>
        )}
        {modelsError && !modelsLoading && (
          <p className="text-xs text-[#b85a3a]">{modelsError}</p>
        )}
        {!modelsLoading && !modelsError && models.length > 0 && (
          <select
            value={selectedCopilotModel}
            onChange={(e) => { void handleModelChange(e.target.value) }}
            className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.category !== 'default' ? ` — ${m.category}` : ''}
              </option>
            ))}
          </select>
        )}
        {!modelsLoading && !modelsError && models.length === 0 && (
          <p className="text-xs text-[#4a4540]">Geen modellen beschikbaar</p>
        )}
        {!modelsLoading && models.length > 0 && !models.find((m) => m.id === selectedCopilotModel) && (
          <p className="text-xs text-[#a07848] mt-1">
            Huidig model ({selectedCopilotModel}) staat niet in de lijst — mogelijk verouderd.
          </p>
        )}
      </div>

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

        <div className="flex gap-2">
          <button
            onClick={() => void testCopilot()}
            disabled={!hasCopilotToken && copilotTokenInput.length === 0}
            className="flex-1 bg-[#252220] disabled:opacity-40 text-[#e8e2d9] text-sm font-medium py-2 rounded-lg border border-[#2e2a26] hover:border-[#3e3a36] transition-colors"
          >
            {copilotTestState === 'testing' ? 'Testen...' : 'Test verbinding'}
          </button>
          <button
            onClick={saveCopilotToken}
            disabled={copilotTokenInput.length === 0}
            className="flex-1 bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
          >
            {copilotSaved ? '✓ Opgeslagen' : 'Opslaan'}
          </button>
        </div>
        {copilotTestState === 'ok' && (
          <div className="bg-[#1a2b1e] text-[#5a8a6a] text-sm rounded-lg px-3 py-2">✓ {copilotTestLabel}</div>
        )}
        {copilotTestState === 'fail' && (
          <div className="bg-[#221e1b] text-[#b85a3a] text-sm rounded-lg px-3 py-2">{copilotTestLabel}</div>
        )}
      </div>

      {/* GitHub token sectie */}
      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">GitHub token</div>
        <div className="text-xs text-[#4a4540]">
          Verkrijg via: <code className="bg-[#1e1b18] px-1 rounded">gh auth token</code> — heeft <code className="bg-[#1e1b18] px-1 rounded">repo</code> scope nodig.
        </div>

        {hasGithubToken && githubTokenInput === '' && (
          <div className="text-xs text-[#4a4540] bg-[#1e1b18] rounded-lg px-3 py-2 border border-[#2e2a26]">
            Token is opgeslagen. Vul een nieuw token in om te overschrijven.
          </div>
        )}

        <input
          type="password"
          value={githubTokenInput}
          onChange={e => setGithubTokenInput(e.target.value)}
          placeholder={hasGithubToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'gho_...'}
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />
        <input
          type="text"
          value={githubUsernameInput}
          onChange={e => setGithubUsernameInput(e.target.value)}
          placeholder="GitHub gebruikersnaam (bijv. guuse)"
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={() => void testGithub()}
            disabled={!hasGithubToken && githubTokenInput.length === 0}
            className="flex-1 bg-[#252220] disabled:opacity-40 text-[#e8e2d9] text-sm font-medium py-2 rounded-lg border border-[#2e2a26] hover:border-[#3e3a36] transition-colors"
          >
            {githubTestState === 'testing' ? 'Testen...' : 'Test verbinding'}
          </button>
          <button
            onClick={saveGithubToken}
            disabled={githubTokenInput.length === 0 && githubUsernameInput.trim().length === 0}
            className="flex-1 bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
          >
            {githubSaved ? '✓ Opgeslagen' : 'Opslaan'}
          </button>
        </div>
        {githubTestState === 'ok' && (
          <div className="bg-[#1a2b1e] text-[#5a8a6a] text-sm rounded-lg px-3 py-2">✓ {githubTestLabel}</div>
        )}
        {githubTestState === 'fail' && (
          <div className="bg-[#221e1b] text-[#b85a3a] text-sm rounded-lg px-3 py-2">{githubTestLabel}</div>
        )}
      </div>

      {/* Linear API key sectie */}
      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">Linear API key</div>
        <div className="text-xs text-[#4a4540]">
          Verkrijg via: linear.me → Settings → API → Personal API keys
        </div>

        {hasLinearToken && linearTokenInput === '' && (
          <div className="text-xs text-[#4a4540] bg-[#1e1b18] rounded-lg px-3 py-2 border border-[#2e2a26]">
            Token is opgeslagen. Vul een nieuw token in om te overschrijven.
          </div>
        )}

        <input
          type="password"
          value={linearTokenInput}
          onChange={e => setLinearTokenInput(e.target.value)}
          placeholder={hasLinearToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'lin_api_...'}
          className="bg-[#1e1b18] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={() => void testLinear()}
            disabled={!hasLinearToken && linearTokenInput.length === 0}
            className="flex-1 bg-[#252220] disabled:opacity-40 text-[#e8e2d9] text-sm font-medium py-2 rounded-lg border border-[#2e2a26] hover:border-[#3e3a36] transition-colors"
          >
            {linearTestState === 'testing' ? 'Testen...' : 'Test verbinding'}
          </button>
          <button
            onClick={saveLinearToken}
            disabled={linearTokenInput.length === 0}
            className="flex-1 bg-[#e8e2d9] disabled:opacity-40 text-[#1c1917] text-sm font-medium py-2 rounded-lg hover:bg-[#d5cfc6] transition-colors"
          >
            {linearSaved ? '✓ Opgeslagen' : 'Opslaan'}
          </button>
        </div>
        {linearTestState === 'ok' && (
          <div className="bg-[#1a2b1e] text-[#5a8a6a] text-sm rounded-lg px-3 py-2">✓ {linearTestLabel}</div>
        )}
        {linearTestState === 'fail' && (
          <div className="bg-[#221e1b] text-[#b85a3a] text-sm rounded-lg px-3 py-2">{linearTestLabel}</div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-[#7a7268]">Favoriete projecten</div>
        <div className="text-xs text-[#4a4540]">
          Gemarkeerde projecten verschijnen bovenaan de dropdown bij het boeken.
        </div>
        {projects.length === 0 ? (
          <div className="text-xs text-[#4a4540]">Geen projecten geladen.</div>
        ) : (
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {[...projects]
              .sort((a, b) => `${a.organizationName} — ${a.name}`.localeCompare(`${b.organizationName} — ${b.name}`))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void toggleStar(p.id)}
                  className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    starredIds.has(p.id)
                      ? 'bg-[#1e1b18] border border-[#a07848] text-[#e8e2d9]'
                      : 'bg-[#1e1b18] border border-[#2e2a26] text-[#7a7268] hover:border-[#3e3a36]'
                  }`}
                >
                  <span className="text-[#a07848]">{starredIds.has(p.id) ? '★' : '☆'}</span>
                  <span>{p.organizationName} — {p.name}</span>
                </button>
              ))}
          </div>
        )}
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
