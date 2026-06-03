// In-browser fake backend. Bundled by esbuild (tests/e2e/global-setup.ts) into a
// single IIFE and injected with page.addInitScript BEFORE the app loads, so the
// app's real store/hooks/usecases/packer run while every backend call is faked.
//
// Two seams are intercepted:
//   1. window.__TAURI_INTERNALS__.invoke  — all @tauri-apps/* traffic, namely the
//      app commands (simplicate_request, gemini_request, *_secret, ...) AND the
//      plugin:fs|* / plugin:path|* IPC the storage layer rides on.
//   2. window.fetch — GitHub, Linear, Google Calendar and Google OAuth.
//
// State is mutable in-memory: booking adds an hour entry a later week-read returns;
// submitting locks days; deleting/updating mutate. See ADR-0005.

import type { E2EScenario, E2EHourEntry } from './types'

// ---------------------------------------------------------------------------
// Scenario + mutable state
// ---------------------------------------------------------------------------

const scenario: E2EScenario = (window as Window).__E2E_SCENARIO__ ?? emptyScenario()

function emptyScenario(): E2EScenario {
  return {
    appDataDir: '/e2e-appdata',
    user: { sub: 'e2e-user', name: 'E2E User', email: 'e2e@example.test' },
    keychain: {},
    tokenTests: { github: 'ok', linear: 'ok' },
    simplicate: {
      employee: { id: 'emp-0', name: 'E2E User', work_email: 'e2e@example.test' },
      projects: [],
      services: [],
      hourTypes: [],
      hourEntries: [],
      submissions: [],
    },
    calendarByDate: {},
    github: { commits: [] },
    linear: { issues: [] },
    files: {},
    gemini: {},
  }
}

const keychain: Record<string, string> = { ...scenario.keychain }
const hourEntries: E2EHourEntry[] = scenario.simplicate.hourEntries.map((e) => ({ ...e }))
const submissions: Array<{ date: string; status: string }> = scenario.simplicate.submissions.map((s) => ({ ...s }))
const files: Record<string, string> = { ...scenario.files }
let hourSeq = 1

// Expose the fake FS so specs can assert what the app persisted.
;(window as Window).__E2E_FILES__ = () => ({ ...files })

const enc = new TextEncoder()
const dec = new TextDecoder()
const basename = (p: string) => p.split(/[\\/]/).pop() ?? p

// ---------------------------------------------------------------------------
// Simplicate router — every Simplicate call funnels through invoke('simplicate_request')
// ---------------------------------------------------------------------------

interface SimplicateArgs {
  method: string
  url: string
  body: string | null
}

function dateOf(dateTime: string): string {
  return dateTime.slice(0, 10)
}

function projectResponse(p: E2EScenario['simplicate']['projects'][number]) {
  return {
    id: p.id,
    name: p.name,
    organization: { name: p.organizationName },
    project_status: { label: p.projectStatusLabel ?? 'tab_pactive' },
    end_date: null,
  }
}

function serviceResponse(s: E2EScenario['simplicate']['services'][number]) {
  return {
    id: s.id,
    name: s.name,
    project_id: s.projectId,
    write_hours_start_date: s.writeHoursStartDate ?? null,
    write_hours_end_date: s.writeHoursEndDate ?? null,
    hour_types: (s.hourTypes ?? []).map((ht) => ({
      hourstype: { id: ht.id, label: ht.label, blocked: ht.blocked ?? false },
    })),
  }
}

function hourEntryResponse(e: E2EHourEntry) {
  return {
    id: e.id,
    employee: { id: e.employeeId },
    project: { id: e.projectId },
    projectservice: { id: e.projectServiceId },
    type: { id: e.hourTypeId },
    hours: e.hours,
    start_date: `${e.startDate} ${e.startTime}:00`,
    end_date: `${e.startDate} ${e.endTime}:00`,
    note: e.note,
  }
}

function handleSimplicate(args: SimplicateArgs): string {
  const { method, url, body } = args
  const u = new URL(url)
  const path = u.pathname
  const p = u.searchParams

  // POST /hours/hours — book
  if (method === 'POST' && path.endsWith('/hours/hours')) {
    if (scenario.simplicate.bookError) throw new Error(scenario.simplicate.bookError)
    const b = JSON.parse(body ?? '{}')
    const entry: E2EHourEntry = {
      id: `booked-${hourSeq++}`,
      employeeId: b.employee_id,
      projectId: b.project_id,
      projectServiceId: b.projectservice_id,
      hourTypeId: b.type_id,
      hours: b.hours,
      startDate: String(b.start_date).slice(0, 10),
      startTime: String(b.start_date).slice(11, 16),
      endTime: String(b.end_date).slice(11, 16),
      note: b.note ?? '',
    }
    hourEntries.push(entry)
    return JSON.stringify({ data: hourEntryResponse(entry) })
  }

  // PUT /hours/hours/:id — update
  if (method === 'PUT' && /\/hours\/hours\/[^/]+$/.test(path)) {
    const id = decodeURIComponent(path.split('/').pop()!)
    const b = JSON.parse(body ?? '{}')
    const e = hourEntries.find((x) => x.id === id)
    if (e) {
      e.projectId = b.project_id
      e.projectServiceId = b.projectservice_id
      e.hourTypeId = b.type_id
      e.hours = b.hours
      e.startDate = String(b.start_date).slice(0, 10)
      e.startTime = String(b.start_date).slice(11, 16)
      e.endTime = String(b.end_date).slice(11, 16)
      e.note = b.note ?? ''
    }
    return ''
  }

  // DELETE /hours/hours/:id
  if (method === 'DELETE' && /\/hours\/hours\/[^/]+$/.test(path)) {
    const id = decodeURIComponent(path.split('/').pop()!)
    const i = hourEntries.findIndex((x) => x.id === id)
    if (i >= 0) hourEntries.splice(i, 1)
    return ''
  }

  // GET /hours/hours?q[employee.id]=..&q[start_date][ge]=..&q[start_date][le]=..
  if (method === 'GET' && path.endsWith('/hours/hours')) {
    const emp = p.get('q[employee.id]')
    const from = p.get('q[start_date][ge]')
    const to = p.get('q[start_date][le]')
    const data = hourEntries
      .filter((e) => (!emp || e.employeeId === emp) && (!from || e.startDate >= from) && (!to || e.startDate <= to))
      .map(hourEntryResponse)
    return JSON.stringify({ data })
  }

  // POST /hours/submission — submit each day in range
  if (method === 'POST' && path.endsWith('/hours/submission')) {
    const b = JSON.parse(body ?? '{}')
    for (const d of eachDate(b.start_date, b.end_date)) {
      const existing = submissions.find((s) => s.date === d)
      if (existing) existing.status = 'submitted'
      else submissions.push({ date: d, status: 'submitted' })
    }
    // SimplicateRepository.post() always JSON.parses the response, so a POST must
    // return a JSON body (the live submission endpoint does too).
    return JSON.stringify({ data: {} })
  }

  // GET /hours/submission?q[employee_id]=..&q[start_date]=from&q[end_date]=to
  if (method === 'GET' && path.endsWith('/hours/submission')) {
    const from = p.get('q[start_date]')
    const to = p.get('q[end_date]')
    const data = submissions
      .filter((s) => (!from || s.date >= from) && (!to || s.date <= to))
      .map((s) => ({ employee_id: scenario.simplicate.employee.id, date: s.date, status: s.status }))
    return JSON.stringify({ data })
  }

  // GET /projects/service?q[project_id]=..
  if (method === 'GET' && path.endsWith('/projects/service')) {
    const projectId = p.get('q[project_id]')
    const data = scenario.simplicate.services
      .filter((s) => !projectId || s.projectId === projectId)
      .map(serviceResponse)
    return JSON.stringify({ data })
  }

  // GET /projects/project
  if (method === 'GET' && path.endsWith('/projects/project')) {
    return JSON.stringify({ data: scenario.simplicate.projects.map(projectResponse) })
  }

  // GET /hours/hourstype
  if (method === 'GET' && path.endsWith('/hours/hourstype')) {
    return JSON.stringify({ data: scenario.simplicate.hourTypes.map((h) => ({ id: h.id, label: h.label })) })
  }

  // GET /hrm/employee
  if (method === 'GET' && path.endsWith('/hrm/employee')) {
    const e = scenario.simplicate.employee
    return JSON.stringify({ data: [{ id: e.id, name: e.name, work_email: e.work_email }] })
  }

  throw new Error(`[e2e-bridge] unhandled Simplicate request: ${method} ${path}`)
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

// ---------------------------------------------------------------------------
// Tauri invoke router
// ---------------------------------------------------------------------------

function geminiEnvelope(inner: unknown): string {
  const text = typeof inner === 'string' ? inner : JSON.stringify(inner ?? [])
  return JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })
}

function fakeInvoke(cmd: string, args: unknown, options: unknown): unknown {
  const a = (args ?? {}) as Record<string, unknown>

  switch (cmd) {
    case 'ensure_app_data_dir':
      return null
    case 'get_secret':
      return keychain[a.key as string] ?? null
    case 'set_secret':
      keychain[a.key as string] = a.value as string
      return null
    case 'delete_secret':
      delete keychain[a.key as string]
      return null
    case 'simplicate_request':
      return handleSimplicate(a.args as SimplicateArgs)
    case 'gemini_request': {
      const inner = scenario.gemini.classifyDay ?? scenario.gemini.classifyBlocks ?? []
      return geminiEnvelope(inner)
    }
    case 'start_google_oauth':
      return JSON.stringify({ code: 'e2e-code', verifier: 'e2e-verifier', redirect_uri: 'http://localhost/callback' })

    // ---- plugin:path ----
    case 'plugin:path|resolve_directory':
      return scenario.appDataDir

    // ---- plugin:fs ----
    case 'plugin:fs|read_text_file': {
      const name = basename(a.path as string)
      if (!(name in files)) throw new Error(`[e2e-bridge] file not found: ${name}`)
      return Array.from(enc.encode(files[name]))
    }
    case 'plugin:fs|write_text_file': {
      // For writes, the bytes are `args` and the path lives in options.headers.path.
      const headers = (options as { headers?: { path?: string } } | undefined)?.headers
      const rawPath = headers?.path ? decodeURIComponent(headers.path) : (a.path as string)
      const bytes = args as ArrayLike<number>
      files[basename(rawPath)] = dec.decode(Uint8Array.from(Array.from(bytes)))
      return null
    }
    case 'plugin:fs|exists':
      return basename(a.path as string) in files
    case 'plugin:fs|mkdir':
    case 'plugin:fs|create':
      return null
  }

  throw new Error(`[e2e-bridge] unhandled invoke: ${cmd}`)
}

// ---------------------------------------------------------------------------
// fetch router
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const realFetch = window.fetch.bind(window)

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const bodyText =
    typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text().catch(() => '') : ''

  // Google OAuth token endpoint (code exchange + refresh) — disambiguate by grant_type.
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    return jsonResponse({ access_token: 'e2e-access-token', refresh_token: 'e2e-refresh-token', expires_in: 28800 })
  }

  // Google userinfo
  if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
    return jsonResponse(scenario.user)
  }

  // Google token scope check
  if (url.startsWith('https://www.googleapis.com/oauth2/v3/tokeninfo')) {
    return jsonResponse({ scope: 'https://www.googleapis.com/auth/calendar.readonly' })
  }

  // Google Calendar events
  if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events')) {
    const min = new URL(url).searchParams.get('timeMin') ?? ''
    const day = dateOf(min)
    const items = scenario.calendarByDate[day] ?? []
    return jsonResponse({ items })
  }

  // GitHub token test
  if (url.startsWith('https://api.github.com/user')) {
    if (scenario.tokenTests.github === 'ok') return jsonResponse({ login: 'e2e-octocat' })
    return jsonResponse({ message: 'Bad credentials' }, 401)
  }

  // GitHub commit search
  if (url.startsWith('https://api.github.com/search/commits')) {
    const items = scenario.github.commits
    return jsonResponse({ total_count: items.length, items })
  }

  // Linear GraphQL — token test (viewer) vs real query (issues)
  if (url.startsWith('https://api.linear.app/graphql')) {
    if (bodyText.includes('viewer')) {
      if (scenario.tokenTests.linear === 'ok') return jsonResponse({ data: { viewer: { name: 'E2E User' } } })
      return jsonResponse({ errors: [{ message: 'authentication required' }] })
    }
    return jsonResponse({ data: { issues: { nodes: scenario.linear.issues } } })
  }

  // Anything else (fonts, the app's own assets) -> real fetch against the preview server.
  if (url.startsWith('http://localhost') || url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) {
    return realFetch(input as RequestInfo, init)
  }

  throw new Error(`[e2e-bridge] unhandled fetch: ${method} ${url}`)
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

;(window as unknown as { __TAURI_INTERNALS__: Record<string, unknown> }).__TAURI_INTERNALS__ = {
  invoke: (cmd: string, args: unknown, options: unknown) =>
    new Promise((resolve, reject) => {
      try {
        resolve(fakeInvoke(cmd, args, options))
      } catch (err) {
        reject(err)
      }
    }),
  transformCallback: (cb: unknown) => cb,
  unregisterCallback: () => {},
  convertFileSrc: (p: string) => p,
  metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
}

window.fetch = fakeFetch as typeof window.fetch
