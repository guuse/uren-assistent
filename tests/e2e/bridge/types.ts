// Shared scenario contract between the Playwright-side fixtures (which build
// scenarios) and the in-browser fake bridge (which serves them). Everything here
// must be JSON-serialisable — it crosses into the page via addInitScript.

export interface E2EHourEntry {
  id: string
  employeeId: string
  projectId: string
  projectServiceId: string
  hourTypeId: string
  hours: number
  startDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  note: string
}

export interface E2EProject {
  id: string
  name: string
  organizationName: string
  projectStatusLabel?: string // default 'tab_pactive'; 'tab_pclosed' is filtered out
}

export interface E2EService {
  id: string
  name: string
  projectId: string
  hourTypes?: Array<{ id: string; label: string; blocked?: boolean }>
  writeHoursStartDate?: string | null
  writeHoursEndDate?: string | null
}

export interface E2EGoogleEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  attendees?: Array<{ email: string; self?: boolean; responseStatus?: string }>
  status?: string
}

export interface E2EGitHubCommitItem {
  sha: string
  commit: { message: string; author: { date: string } }
  repository: { full_name: string }
}

export interface E2ELinearNode {
  identifier: string
  title: string
  completedAt: string
  url: string
}

export interface E2EScenario {
  /** Fake app-data dir returned by plugin:path|resolve_directory. */
  appDataDir: string
  user: { sub: string; name: string; email: string }
  /** Pre-seeded secrets (google tokens, simplicate keys, github/linear tokens). */
  keychain: Record<string, string>
  /** Outcome of the GitHub/Linear token-test fetches fired by useAppInit. */
  tokenTests: { github: 'ok' | 'fail'; linear: 'ok' | 'fail' }
  simplicate: {
    employee: { id: string; name: string; work_email: string }
    projects: E2EProject[]
    services: E2EService[]
    hourTypes: Array<{ id: string; label: string }>
    hourEntries: E2EHourEntry[]
    submissions: Array<{ date: string; status: string }>
    /** If set, POST /hours/hours rejects with this message (surface-real-error test). */
    bookError?: string
  }
  calendarByDate: Record<string, E2EGoogleEvent[]>
  github: { commits: E2EGitHubCommitItem[] }
  linear: { issues: E2ELinearNode[] }
  /** Pre-seeded fake filesystem, keyed by file BASENAME (e.g. "history-store.json"). */
  files: Record<string, string>
  /** Inner JSON the fake Gemini returns for classifyDay / classify (blocks). */
  gemini: { classifyDay?: unknown; classifyBlocks?: unknown }
}

declare global {
  interface Window {
    __E2E_SCENARIO__?: E2EScenario
    __E2E_FILES__?: () => Record<string, string>
  }
}
