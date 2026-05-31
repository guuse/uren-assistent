import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import type { SimplicateProject } from '../../../domain/repositories/ISimplicateRepository'

// --- container mock ----------------------------------------------------------
const keychainGet = vi.fn()
const keychainSet = vi.fn()
const getProjects = vi.fn()
const getEmployee = vi.fn()
const getHourTypes = vi.fn()
const createSimplicateRepository = vi.fn((_b?: string, _k?: string, _s?: string) => ({
  getProjects,
  getEmployee,
  getHourTypes,
}))

vi.mock('../../../application/container', () => ({
  keychainRepo: {
    get: (k: string) => keychainGet(k),
    set: (k: string, v: string) => keychainSet(k, v),
  },
  createSimplicateRepository: (b: string, k: string, s: string) =>
    createSimplicateRepository(b, k, s),
}))

// --- useAuth mock ------------------------------------------------------------
const logout = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ logout }),
}))

// --- useStarredProjects mock -------------------------------------------------
const toggleStar = vi.fn()
let starredIds = new Set<string>()
vi.mock('../../hooks/useStarredProjects', () => ({
  useStarredProjects: () => ({ starredIds, toggle: toggleStar }),
}))

// --- tokenTest mock ----------------------------------------------------------
const testGitHubToken = vi.fn()
const testLinearToken = vi.fn()
vi.mock('../../../infrastructure/tokenTest', () => ({
  testGitHubToken: (t: string) => testGitHubToken(t),
  testLinearToken: (t: string) => testLinearToken(t),
}))

import { useAppStore } from '../../../store/appStore'
import { AccountSettings } from './AccountSettings'

const projects: SimplicateProject[] = [
  { id: 'p1', name: 'Alpha', organizationName: 'Org' } as SimplicateProject,
  { id: 'p2', name: 'Beta', organizationName: 'Org' } as SimplicateProject,
]

function resetStore() {
  useAppStore.setState({
    user: { id: 'u', name: 'Jane', email: 'jane@x.com', googleId: 'g' },
    projects: [],
    simplicateEmployeeId: null,
    githubToken: null,
    githubUsername: null,
    linearToken: null,
    tokenStatuses: { github: 'unknown', linear: 'unknown' },
  })
}

beforeEach(() => {
  keychainGet.mockReset().mockResolvedValue(null)
  keychainSet.mockReset().mockResolvedValue(undefined)
  getProjects.mockReset().mockResolvedValue(projects)
  getEmployee.mockReset().mockResolvedValue({ id: 'emp-1' })
  getHourTypes.mockReset().mockResolvedValue([{ id: 'ht1', label: 'Dev' }])
  createSimplicateRepository.mockClear()
  logout.mockReset()
  toggleStar.mockReset()
  testGitHubToken.mockReset()
  testLinearToken.mockReset()
  starredIds = new Set<string>()
  resetStore()
})

/** Locate a section card <div> by its uppercase header text. */
function card(headerText: string): HTMLElement {
  const header = screen.getByText(headerText)
  return header.parentElement as HTMLElement
}

/** The Simplicate card. */
const simplicateCard = () => card('Simplicate API')
/** The Tokens card. */
const tokensCard = () => card('Tokens')

/** A TokenRow's outer wrapper, located via its label. */
function tokenRow(label: string): HTMLElement {
  const labelEl = within(tokensCard()).getByText(label)
  // label span → flex div → header div → row wrapper
  return labelEl.closest('div[style]')!.parentElement!.parentElement as HTMLElement
}

/** Wait out the 2-second "saved label" reset timeout (covers its callback). */
async function flushSaveTimeout() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 2100))
  })
}

async function renderSettled(ui: React.ReactElement) {
  const result = render(ui)
  // Let the loadExisting effect resolve.
  await waitFor(() => expect(keychainGet).toHaveBeenCalled())
  return result
}

describe('AccountSettings', () => {
  it('renders the user profile and logs out', async () => {
    await renderSettled(<AccountSettings />)
    expect(screen.getByText('Jane')).toBeInTheDocument()
    expect(screen.getByText('jane@x.com')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Uitloggen'))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('shows "Niet geconfigureerd" when no existing credentials', async () => {
    await renderSettled(<AccountSettings />)
    expect(screen.getByText('Niet geconfigureerd')).toBeInTheDocument()
  })

  it('loads existing credentials and tokens on mount', async () => {
    keychainGet.mockImplementation(async (k: string) => {
      const map: Record<string, string> = {
        'simplicate-api-key': 'KEY',
        'simplicate-api-secret': 'SECRET',
        'github-token': 'gho_x',
        'github-username': 'octocat',
        'linear-token': 'lin_x',
      }
      return map[k] ?? null
    })
    await renderSettled(<AccountSettings />)
    await waitFor(() => expect(screen.getByText('Geconfigureerd')).toBeInTheDocument())
    expect(useAppStore.getState().githubToken).toBe('gho_x')
    expect(useAppStore.getState().githubUsername).toBe('octocat')
    expect(useAppStore.getState().linearToken).toBe('lin_x')
    // Both token rows show "Wijzigen" since tokens exist
    const wijzigen = within(tokensCard()).getAllByText('Wijzigen')
    expect(wijzigen).toHaveLength(2)
    // Expanding GitHub reveals the pre-filled username
    fireEvent.click(within(tokenRow('GitHub token')).getByText('Wijzigen'))
    expect(screen.getByDisplayValue('octocat')).toBeInTheDocument()
  })

  describe('Simplicate save & test', () => {
    const keyInput = () => screen.getByPlaceholderText('API Key')
    const secretInput = () => screen.getByPlaceholderText('API Secret')
    const saveBtn = () => within(simplicateCard()).getByText(/Opslaan|✓ Opgeslagen/)
    const testBtn = () => within(simplicateCard()).getByText(/Test|Testen\.\.\./)

    it('save button disabled until both filled, then saves', async () => {
      await renderSettled(<AccountSettings />)
      expect(saveBtn()).toBeDisabled()
      fireEvent.change(keyInput(), { target: { value: 'KEY' } })
      fireEvent.change(secretInput(), { target: { value: 'SECRET' } })
      expect(saveBtn()).not.toBeDisabled()
      fireEvent.click(saveBtn())
      await waitFor(() => expect(keychainSet).toHaveBeenCalledWith('simplicate-api-key', 'KEY'))
      expect(keychainSet).toHaveBeenCalledWith('simplicate-api-secret', 'SECRET')
      await waitFor(() => expect(screen.getByText('✓ Opgeslagen')).toBeInTheDocument())
      // The 2s timeout resets the label back to "Opslaan".
      await flushSaveTimeout()
      expect(within(simplicateCard()).getByText('Opslaan')).toBeInTheDocument()
    })

    it('test connection succeeds and stores data + employee', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.change(keyInput(), { target: { value: 'KEY' } })
      fireEvent.change(secretInput(), { target: { value: 'SECRET' } })
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('✓ Verbinding geslaagd')).toBeInTheDocument())
      expect(useAppStore.getState().simplicateEmployeeId).toBe('emp-1')
      expect(useAppStore.getState().projects).toHaveLength(2)
    })

    it('tolerates a failing employee lookup', async () => {
      getEmployee.mockRejectedValue(new Error('no employee'))
      await renderSettled(<AccountSettings />)
      fireEvent.change(keyInput(), { target: { value: 'KEY' } })
      fireEvent.change(secretInput(), { target: { value: 'SECRET' } })
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('✓ Verbinding geslaagd')).toBeInTheDocument())
      expect(useAppStore.getState().simplicateEmployeeId).toBeNull()
    })

    it('skips employee lookup when no user email', async () => {
      useAppStore.setState({ user: { id: 'u', name: 'NoMail', email: '', googleId: 'g' } })
      await renderSettled(<AccountSettings />)
      fireEvent.change(keyInput(), { target: { value: 'KEY' } })
      fireEvent.change(secretInput(), { target: { value: 'SECRET' } })
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('✓ Verbinding geslaagd')).toBeInTheDocument())
      expect(getEmployee).not.toHaveBeenCalled()
    })

    it('reports 401 as a friendly error', async () => {
      getProjects.mockRejectedValue(new Error('Request failed 401'))
      await renderSettled(<AccountSettings />)
      fireEvent.change(keyInput(), { target: { value: 'KEY' } })
      fireEvent.change(secretInput(), { target: { value: 'SECRET' } })
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('Ongeldige API key of secret (401).')).toBeInTheDocument())
    })

    it('reports a generic error message', async () => {
      getProjects.mockRejectedValue(new Error('network down'))
      await renderSettled(<AccountSettings />)
      fireEvent.change(keyInput(), { target: { value: 'KEY' } })
      fireEvent.change(secretInput(), { target: { value: 'SECRET' } })
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('network down')).toBeInTheDocument())
    })

    it('reports a non-Error throw via String()', async () => {
      getProjects.mockRejectedValue('weird')
      await renderSettled(<AccountSettings />)
      fireEvent.change(keyInput(), { target: { value: 'KEY' } })
      fireEvent.change(secretInput(), { target: { value: 'SECRET' } })
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('weird')).toBeInTheDocument())
    })

    it('uses stored credentials when inputs empty (existing creds, test ok)', async () => {
      keychainGet.mockImplementation(async (k: string) => {
        const map: Record<string, string> = {
          'simplicate-api-key': 'STORED_KEY',
          'simplicate-api-secret': 'STORED_SECRET',
        }
        return map[k] ?? null
      })
      await renderSettled(<AccountSettings />)
      await waitFor(() => expect(screen.getByText('Geconfigureerd')).toBeInTheDocument())
      expect(testBtn()).not.toBeDisabled()
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('✓ Verbinding geslaagd')).toBeInTheDocument())
      expect(createSimplicateRepository).toHaveBeenCalledWith(
        expect.anything(), 'STORED_KEY', 'STORED_SECRET',
      )
    })

    it('fails with "Geen credentials ingevuld." when stored creds missing', async () => {
      let calls = 0
      keychainGet.mockImplementation(async (k: string) => {
        if (calls < 2) { calls++; return k.includes('secret') ? 'S' : 'K' }
        return null
      })
      await renderSettled(<AccountSettings />)
      await waitFor(() => expect(screen.getByText('Geconfigureerd')).toBeInTheDocument())
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('Geen credentials ingevuld.')).toBeInTheDocument())
    })

    it('clears test state when editing inputs', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.change(keyInput(), { target: { value: 'KEY' } })
      fireEvent.change(secretInput(), { target: { value: 'SECRET' } })
      fireEvent.click(testBtn())
      await waitFor(() => expect(screen.getByText('✓ Verbinding geslaagd')).toBeInTheDocument())
      fireEvent.change(keyInput(), { target: { value: 'KEY2' } })
      expect(screen.queryByText('✓ Verbinding geslaagd')).not.toBeInTheDocument()
    })

    it('shows the "overschrijven" hint when creds exist and key field is empty', async () => {
      keychainGet.mockImplementation(async (k: string) =>
        k.startsWith('simplicate') ? 'X' : null,
      )
      await renderSettled(<AccountSettings />)
      await waitFor(() =>
        expect(
          screen.getByText('Credentials zijn opgeslagen. Vul nieuwe in om te overschrijven.'),
        ).toBeInTheDocument(),
      )
    })
  })

  describe('GitHub token', () => {
    const ghRow = () => tokenRow('GitHub token')
    const ghTestBtn = () => within(ghRow()).getByText(/Test|Testen\.\.\./)
    const ghSaveBtn = () => within(ghRow()).getByText(/Opslaan|✓ Opgeslagen/)

    it('expands, saves token + username, and updates the store', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Instellen'))
      fireEvent.change(screen.getByPlaceholderText('gho_...'), { target: { value: 'gho_new' } })
      fireEvent.change(screen.getByPlaceholderText('GitHub gebruikersnaam (bijv. octocat)'), { target: { value: 'octo' } })
      fireEvent.click(ghSaveBtn())
      await waitFor(() => expect(keychainSet).toHaveBeenCalledWith('github-token', 'gho_new'))
      expect(keychainSet).toHaveBeenCalledWith('github-username', 'octo')
      expect(useAppStore.getState().githubToken).toBe('gho_new')
      expect(useAppStore.getState().githubUsername).toBe('octo')
      // Let the 2s reset timeout fire (covers the setTimeout callback).
      await flushSaveTimeout()
    })

    it('saves a token without a username', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Instellen'))
      fireEvent.change(screen.getByPlaceholderText('gho_...'), { target: { value: 'gho_new' } })
      fireEvent.click(ghSaveBtn())
      await waitFor(() => expect(keychainSet).toHaveBeenCalledWith('github-token', 'gho_new'))
      expect(keychainSet).not.toHaveBeenCalledWith('github-username', expect.anything())
    })

    it('tests the token: success', async () => {
      testGitHubToken.mockResolvedValue({ ok: true, label: 'verbonden als octo' })
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Instellen'))
      fireEvent.change(screen.getByPlaceholderText('gho_...'), { target: { value: 'gho_x' } })
      fireEvent.click(ghTestBtn())
      await waitFor(() => expect(within(ghRow()).getByText('✓ verbonden als octo')).toBeInTheDocument())
      expect(useAppStore.getState().tokenStatuses.github).toBe('ok')
    })

    it('tests the token: failure', async () => {
      testGitHubToken.mockResolvedValue({ ok: false, label: 'GitHub: HTTP 401' })
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Instellen'))
      fireEvent.change(screen.getByPlaceholderText('gho_...'), { target: { value: 'gho_bad' } })
      fireEvent.click(ghTestBtn())
      await waitFor(() => expect(within(ghRow()).getByText('GitHub: HTTP 401')).toBeInTheDocument())
      expect(useAppStore.getState().tokenStatuses.github).toBe('fail')
    })

    it('uses the stored token when the input is empty', async () => {
      keychainGet.mockImplementation(async (k: string) => (k === 'github-token' ? 'gho_stored' : null))
      testGitHubToken.mockResolvedValue({ ok: true, label: 'ok' })
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Wijzigen'))
      fireEvent.click(ghTestBtn())
      await waitFor(() => expect(testGitHubToken).toHaveBeenCalledWith('gho_stored'))
    })

    it('Test button disabled when there is no token at all', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Instellen'))
      expect(ghTestBtn()).toBeDisabled()
    })

    it('returns early when no token resolves at test time', async () => {
      let calls = 0
      keychainGet.mockImplementation(async (k: string) => {
        if (k === 'github-token') { calls++; return calls === 1 ? 'gho_initial' : null }
        return null
      })
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Wijzigen'))
      fireEvent.click(ghTestBtn())
      await waitFor(() => expect(keychainGet).toHaveBeenCalledWith('github-token'))
      expect(testGitHubToken).not.toHaveBeenCalled()
    })

    it('toggling the row twice collapses it', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Instellen'))
      expect(within(ghRow()).getByText('Annuleren')).toBeInTheDocument()
      fireEvent.click(within(ghRow()).getByText('Annuleren'))
      expect(screen.queryByPlaceholderText('gho_...')).not.toBeInTheDocument()
    })

    it('save button disabled when both fields are empty', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(ghRow()).getByText('Instellen'))
      expect(ghSaveBtn()).toBeDisabled()
    })
  })

  describe('Linear token', () => {
    const linRow = () => tokenRow('Linear API key')
    const linTestBtn = () => within(linRow()).getByText(/Test|Testen\.\.\./)
    const linSaveBtn = () => within(linRow()).getByText(/Opslaan|✓ Opgeslagen/)

    it('saves the token to the store', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(linRow()).getByText('Instellen'))
      fireEvent.change(screen.getByPlaceholderText('lin_api_...'), { target: { value: 'lin_x' } })
      fireEvent.click(linSaveBtn())
      await waitFor(() => expect(keychainSet).toHaveBeenCalledWith('linear-token', 'lin_x'))
      expect(useAppStore.getState().linearToken).toBe('lin_x')
      await flushSaveTimeout()
    })

    it('tests the token: success', async () => {
      testLinearToken.mockResolvedValue({ ok: true, label: 'verbonden als Jane' })
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(linRow()).getByText('Instellen'))
      fireEvent.change(screen.getByPlaceholderText('lin_api_...'), { target: { value: 'lin_x' } })
      fireEvent.click(linTestBtn())
      await waitFor(() => expect(within(linRow()).getByText('✓ verbonden als Jane')).toBeInTheDocument())
      expect(useAppStore.getState().tokenStatuses.linear).toBe('ok')
    })

    it('tests the token: failure', async () => {
      testLinearToken.mockResolvedValue({ ok: false, label: 'Linear: ongeldige token' })
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(linRow()).getByText('Instellen'))
      fireEvent.change(screen.getByPlaceholderText('lin_api_...'), { target: { value: 'lin_bad' } })
      fireEvent.click(linTestBtn())
      await waitFor(() => expect(within(linRow()).getByText('Linear: ongeldige token')).toBeInTheDocument())
      expect(useAppStore.getState().tokenStatuses.linear).toBe('fail')
    })

    it('uses the stored token when the input is empty', async () => {
      keychainGet.mockImplementation(async (k: string) => (k === 'linear-token' ? 'lin_stored' : null))
      testLinearToken.mockResolvedValue({ ok: true, label: 'ok' })
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(linRow()).getByText('Wijzigen'))
      fireEvent.click(linTestBtn())
      await waitFor(() => expect(testLinearToken).toHaveBeenCalledWith('lin_stored'))
    })

    it('returns early when no token resolves at test time', async () => {
      let calls = 0
      keychainGet.mockImplementation(async (k: string) => {
        if (k === 'linear-token') { calls++; return calls === 1 ? 'lin_initial' : null }
        return null
      })
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(linRow()).getByText('Wijzigen'))
      fireEvent.click(linTestBtn())
      await waitFor(() => expect(keychainGet).toHaveBeenCalledWith('linear-token'))
      expect(testLinearToken).not.toHaveBeenCalled()
    })

    it('save button disabled when token input empty', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(linRow()).getByText('Instellen'))
      expect(linSaveBtn()).toBeDisabled()
    })

    it('toggling the row twice collapses it', async () => {
      await renderSettled(<AccountSettings />)
      fireEvent.click(within(linRow()).getByText('Instellen'))
      expect(within(linRow()).getByText('Annuleren')).toBeInTheDocument()
      fireEvent.click(within(linRow()).getByText('Annuleren'))
      expect(screen.queryByPlaceholderText('lin_api_...')).not.toBeInTheDocument()
    })
  })

  describe('Favorite projects', () => {
    it('shows empty state when no projects loaded', async () => {
      await renderSettled(<AccountSettings />)
      expect(screen.getByText('Geen projecten geladen.')).toBeInTheDocument()
    })

    it('lists projects and toggles stars', async () => {
      useAppStore.setState({ projects })
      starredIds = new Set(['p1'])
      await renderSettled(<AccountSettings />)
      expect(screen.getByText('Favorieten')).toBeInTheDocument()
      expect(screen.getByText('Overige projecten')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Org — Alpha'))
      expect(toggleStar).toHaveBeenCalledWith('p1')
      fireEvent.click(screen.getByText('Org — Beta'))
      expect(toggleStar).toHaveBeenCalledWith('p2')
    })

    it('filters projects via search and shows the empty-results message', async () => {
      useAppStore.setState({ projects })
      await renderSettled(<AccountSettings />)
      const search = screen.getByLabelText('Zoek op projectnaam')
      fireEvent.change(search, { target: { value: 'alpha' } })
      expect(screen.getByText('Org — Alpha')).toBeInTheDocument()
      expect(screen.queryByText('Org — Beta')).not.toBeInTheDocument()
      fireEvent.change(search, { target: { value: 'zzz nomatch' } })
      expect(screen.getByText('Geen projecten gevonden.')).toBeInTheDocument()
    })

    it('renders only starred projects with no headers when none are unstarred', async () => {
      useAppStore.setState({ projects: [projects[0]!] })
      starredIds = new Set(['p1'])
      await renderSettled(<AccountSettings />)
      expect(screen.queryByText('Favorieten')).not.toBeInTheDocument()
      expect(screen.queryByText('Overige projecten')).not.toBeInTheDocument()
      expect(screen.getByText('Org — Alpha')).toBeInTheDocument()
    })
  })
})
