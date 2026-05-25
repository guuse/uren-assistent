import React, { useState, useEffect } from 'react'
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
  const [expandedToken, setExpandedToken] = useState<'copilot' | 'github' | 'linear' | null>(null)

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

  const terms = projectSearch.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredProjects = [...projects]
    .filter((p) => terms.length === 0 || terms.every((t) => p.name.toLowerCase().includes(t)))
    .sort((a, b) => label(a).localeCompare(label(b)))

  const starredProjects = filteredProjects.filter((p) => starredIds.has(p.id))
  const unstarredProjects = filteredProjects.filter((p) => !starredIds.has(p.id))

  const sectionCard: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
  }
  const sectionHeader: React.CSSProperties = {
    padding: '5px 12px',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    background: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
  }
  const row: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  }
  const rowLast: React.CSSProperties = { ...row, borderBottom: 'none' }
  const rowTitle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }
  const rowSubtitle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }
  const ghostBtn: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  }
  const primaryBtn: React.CSSProperties = {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  }
  const dangerBtn: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid #fecaca',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  }
  const dotConnected: React.CSSProperties = { width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }
  const dotDisconnected: React.CSSProperties = { width: 7, height: 7, borderRadius: '50%', background: 'var(--text-faint)', flexShrink: 0 }
  const labelConnected: React.CSSProperties = { fontSize: 10, fontWeight: 500, color: 'var(--success)' }
  const labelDisconnected: React.CSSProperties = { fontSize: 10, fontWeight: 500, color: 'var(--text-faint)' }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: 12,
    borderRadius: 6,
    padding: '6px 10px',
    border: '1px solid var(--border)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  function TokenRow({
    id: _id,
    label: tokenLabel,
    hasToken,
    expanded,
    onToggle,
    children,
    isLast = false,
  }: {
    id: string
    label: string
    hasToken: boolean
    expanded: boolean
    onToggle: () => void
    children: React.ReactNode
    isLast?: boolean
  }) {
    return (
      <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
        <div style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: hasToken ? 'var(--success)' : 'var(--text-faint)',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tokenLabel}</span>
          </div>
          <button
            type="button"
            onClick={onToggle}
            style={{
              background: expanded ? 'var(--bg)' : 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Annuleren' : hasToken ? 'Wijzigen' : 'Instellen'}
          </button>
        </div>
        {expanded && (
          <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>

      {/* Kaart 1: Profiel & toegang */}
      <div style={sectionCard}>
        <div style={sectionHeader}>Profiel &amp; toegang</div>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <div style={rowTitle}>{user?.name}</div>
            <div style={rowSubtitle}>{user?.email}</div>
          </div>
          <button onClick={logout} style={dangerBtn}>Uitloggen</button>
        </div>
        <div style={rowLast}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={rowTitle}>Copilot model</div>
            {modelsLoading && <div style={rowSubtitle}>Modellen ophalen...</div>}
            {modelsError && !modelsLoading && <div style={{ ...rowSubtitle, color: 'var(--danger)' }}>{modelsError}</div>}
            {!modelsLoading && !modelsError && models.length === 0 && <div style={rowSubtitle}>Geen modellen beschikbaar</div>}
            {!modelsLoading && models.length > 0 && !models.find((m) => m.id === selectedCopilotModel) && (
              <div style={{ ...rowSubtitle, color: 'var(--warning, #a07848)' }}>
                Huidig model ({selectedCopilotModel}) staat niet in de lijst.
              </div>
            )}
          </div>
          {!modelsLoading && !modelsError && models.length > 0 && (
            <select
              value={selectedCopilotModel}
              onChange={(e) => { void handleModelChange(e.target.value) }}
              style={{ ...inputStyle, width: 'auto', minWidth: 160 }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.category !== 'default' ? ` — ${m.category}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Kaart 2: Simplicate API */}
      <div style={sectionCard}>
        <div style={sectionHeader}>Simplicate API</div>

        <div style={row}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {hasExisting && apiKey === '' && (
              <div style={rowSubtitle}>Credentials zijn opgeslagen. Vul nieuwe in om te overschrijven.</div>
            )}
            <input
              type="text"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestState('idle') }}
              placeholder={hasExisting ? 'API Key (laat leeg om huidig te bewaren)' : 'API Key'}
              style={inputStyle}
            />
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => { setApiSecret(e.target.value); setTestState('idle') }}
              placeholder={hasExisting ? 'API Secret (laat leeg om huidig te bewaren)' : 'API Secret'}
              style={inputStyle}
            />
          </div>
        </div>
        <div style={rowLast}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
            {testState === 'ok' && <><span style={dotConnected} /><span style={labelConnected}>✓ Verbinding geslaagd</span></>}
            {testState === 'fail' && <span style={{ ...labelDisconnected, color: 'var(--danger)' }}>{testError ?? 'Verbinding mislukt'}</span>}
            {testState === 'idle' && hasExisting && <><span style={dotConnected} /><span style={labelConnected}>Geconfigureerd</span></>}
            {testState === 'idle' && !hasExisting && <><span style={dotDisconnected} /><span style={labelDisconnected}>Niet geconfigureerd</span></>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={testConnection} disabled={!canTest || testState === 'testing'} style={{ ...ghostBtn, opacity: (!canTest || testState === 'testing') ? 0.4 : 1 }}>
              {testState === 'testing' ? 'Testen...' : 'Test'}
            </button>
            <button onClick={save} disabled={!canSave} style={{ ...primaryBtn, opacity: !canSave ? 0.4 : 1 }}>
              {saved ? '✓ Opgeslagen' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>

      {/* Kaart 3: Tokens */}
      <div style={sectionCard}>
        <div style={sectionHeader}>Tokens</div>

        <TokenRow
          id="copilot"
          label="GitHub Copilot token"
          hasToken={hasCopilotToken}
          expanded={expandedToken === 'copilot'}
          onToggle={() => setExpandedToken(expandedToken === 'copilot' ? null : 'copilot')}
        >
          <div style={rowSubtitle}>Verkrijg via: <code>gh auth token</code> in een terminal.</div>
          <input
            type="password"
            value={copilotTokenInput}
            onChange={(e) => setCopilotTokenInput(e.target.value)}
            placeholder={hasCopilotToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'ghu_...'}
            style={inputStyle}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              {copilotTestState === 'ok' && <><span style={dotConnected} /><span style={labelConnected}>✓ {copilotTestLabel}</span></>}
              {copilotTestState === 'fail' && <span style={{ ...labelDisconnected, color: 'var(--danger)' }}>{copilotTestLabel}</span>}
            </div>
            <button onClick={() => void testCopilot()} disabled={!hasCopilotToken && copilotTokenInput.length === 0} style={{ ...ghostBtn, opacity: (!hasCopilotToken && copilotTokenInput.length === 0) ? 0.4 : 1 }}>
              {copilotTestState === 'testing' ? 'Testen...' : 'Test'}
            </button>
            <button onClick={() => { void saveCopilotToken(); setExpandedToken(null) }} disabled={copilotTokenInput.length === 0} style={{ ...primaryBtn, opacity: copilotTokenInput.length === 0 ? 0.4 : 1 }}>
              {copilotSaved ? '✓ Opgeslagen' : 'Opslaan'}
            </button>
          </div>
        </TokenRow>

        <TokenRow
          id="github"
          label="GitHub token"
          hasToken={hasGithubToken}
          expanded={expandedToken === 'github'}
          onToggle={() => setExpandedToken(expandedToken === 'github' ? null : 'github')}
        >
          <div style={rowSubtitle}>Verkrijg via: <code>gh auth token</code> — heeft <code>repo</code> scope nodig.</div>
          <input
            type="password"
            value={githubTokenInput}
            onChange={(e) => setGithubTokenInput(e.target.value)}
            placeholder={hasGithubToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'gho_...'}
            style={inputStyle}
          />
          <input
            type="text"
            value={githubUsernameInput}
            onChange={(e) => setGithubUsernameInput(e.target.value)}
            placeholder="GitHub gebruikersnaam (bijv. guuse)"
            style={inputStyle}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              {githubTestState === 'ok' && <><span style={dotConnected} /><span style={labelConnected}>✓ {githubTestLabel}</span></>}
              {githubTestState === 'fail' && <span style={{ ...labelDisconnected, color: 'var(--danger)' }}>{githubTestLabel}</span>}
            </div>
            <button onClick={() => void testGithub()} disabled={!hasGithubToken && githubTokenInput.length === 0} style={{ ...ghostBtn, opacity: (!hasGithubToken && githubTokenInput.length === 0) ? 0.4 : 1 }}>
              {githubTestState === 'testing' ? 'Testen...' : 'Test'}
            </button>
            <button onClick={() => { void saveGithubToken(); setExpandedToken(null) }} disabled={githubTokenInput.length === 0 && githubUsernameInput.trim().length === 0} style={{ ...primaryBtn, opacity: (githubTokenInput.length === 0 && githubUsernameInput.trim().length === 0) ? 0.4 : 1 }}>
              {githubSaved ? '✓ Opgeslagen' : 'Opslaan'}
            </button>
          </div>
        </TokenRow>

        <TokenRow
          id="linear"
          label="Linear API key"
          hasToken={hasLinearToken}
          expanded={expandedToken === 'linear'}
          onToggle={() => setExpandedToken(expandedToken === 'linear' ? null : 'linear')}
          isLast
        >
          <div style={rowSubtitle}>Verkrijg via: linear.me → Settings → API → Personal API keys</div>
          <input
            type="password"
            value={linearTokenInput}
            onChange={(e) => setLinearTokenInput(e.target.value)}
            placeholder={hasLinearToken ? 'Nieuw token (laat leeg om huidig te bewaren)' : 'lin_api_...'}
            style={inputStyle}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
              {linearTestState === 'ok' && <><span style={dotConnected} /><span style={labelConnected}>✓ {linearTestLabel}</span></>}
              {linearTestState === 'fail' && <span style={{ ...labelDisconnected, color: 'var(--danger)' }}>{linearTestLabel}</span>}
            </div>
            <button onClick={() => void testLinear()} disabled={!hasLinearToken && linearTokenInput.length === 0} style={{ ...ghostBtn, opacity: (!hasLinearToken && linearTokenInput.length === 0) ? 0.4 : 1 }}>
              {linearTestState === 'testing' ? 'Testen...' : 'Test'}
            </button>
            <button onClick={() => { void saveLinearToken(); setExpandedToken(null) }} disabled={linearTokenInput.length === 0} style={{ ...primaryBtn, opacity: linearTokenInput.length === 0 ? 0.4 : 1 }}>
              {linearSaved ? '✓ Opgeslagen' : 'Opslaan'}
            </button>
          </div>
        </TokenRow>

      </div>

      {/* Kaart 3: Favoriete projecten */}
      <div style={sectionCard}>
        <div style={sectionHeader}>Favoriete projecten</div>
        <div style={{ padding: '5px 12px 6px', borderBottom: '1px solid var(--border)' }}>
          <div style={rowSubtitle}>Gemarkeerde projecten verschijnen bovenaan de dropdown bij het boeken.</div>
        </div>
        {projects.length === 0 ? (
          <div style={{ padding: '0 12px 10px' }}><span style={rowSubtitle}>Geen projecten geladen.</span></div>
        ) : (
          <div style={{ padding: '0 12px 10px' }}>
            <input
              type="text"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Zoek op projectnaam…"
              aria-label="Zoek op projectnaam"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
              {starredProjects.length === 0 && unstarredProjects.length === 0 && (
                <span style={rowSubtitle}>Geen projecten gevonden.</span>
              )}
              {starredProjects.length > 0 && (
                <>
                  {unstarredProjects.length > 0 && (
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warning, #a07848)', padding: '2px 2px' }}>Favorieten</div>
                  )}
                  {starredProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void toggleStar(p.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '6px 10px', borderRadius: 6, fontSize: 12, background: 'var(--surface)', border: '1px solid var(--accent, #a07848)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      <span style={{ color: 'var(--accent, #a07848)' }}>★</span>
                      <span>{p.organizationName} — {p.name}</span>
                    </button>
                  ))}
                </>
              )}
              {starredProjects.length > 0 && unstarredProjects.length > 0 && (
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '4px 2px 2px' }}>Overige projecten</div>
              )}
              {unstarredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void toggleStar(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '6px 10px', borderRadius: 6, fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <span style={{ color: 'var(--accent, #a07848)' }}>☆</span>
                  <span>{p.organizationName} — {p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
