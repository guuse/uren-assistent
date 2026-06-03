import type {
  E2EScenario,
  E2EHourEntry,
  E2EGoogleEvent,
  E2EGitHubCommitItem,
  E2ELinearNode,
} from '../bridge/types'

// Frozen "now" = Tuesday 2 June 2026, 09:00 Europe/Amsterdam (CEST = UTC+2).
export const FROZEN_NOW = new Date('2026-06-02T07:00:00.000Z')
const FROZEN_MS = FROZEN_NOW.getTime()

// The frozen week (Mon–Fri). selectedDate defaults to TODAY.
export const DATES = {
  mon: '2026-06-01',
  tue: '2026-06-02',
  wed: '2026-06-03',
  thu: '2026-06-04',
  fri: '2026-06-05',
} as const
export const TODAY = DATES.tue

// Canonical project/service/hour-type ids used across fixtures.
export const IDS = {
  employee: 'emp-1',
  project: 'proj-acme',
  service: 'svc-dev',
  hourType: 'ht-dev',
} as const

export interface ScenarioOverrides {
  user?: Partial<E2EScenario['user']>
  keychain?: Record<string, string>
  tokenTests?: Partial<E2EScenario['tokenTests']>
  simplicate?: Partial<E2EScenario['simplicate']>
  calendarByDate?: Record<string, E2EGoogleEvent[]>
  github?: Partial<E2EScenario['github']>
  linear?: Partial<E2EScenario['linear']>
  files?: Record<string, string>
  gemini?: E2EScenario['gemini']
}

/** A logged-in, fully-credentialed default scenario keyed to the frozen week. */
export function buildScenario(o: ScenarioOverrides = {}): E2EScenario {
  const user = {
    sub: 'e2e-user',
    name: 'Guus E2E',
    email: 'guus.e2e@harborn.test',
    ...o.user,
  }

  const base: E2EScenario = {
    appDataDir: '/e2e-appdata',
    user,
    keychain: {
      'google-access-token': 'e2e-access-token',
      'google-token-expiry': String(FROZEN_MS + 8 * 60 * 60 * 1000),
      'google-refresh-token': 'e2e-refresh-token',
      'simplicate-api-key': 'e2e-api-key',
      'simplicate-api-secret': 'e2e-api-secret',
      'github-token': 'e2e-github-token',
      'github-username': 'e2e-octocat',
      'linear-token': 'e2e-linear-token',
      ...o.keychain,
    },
    tokenTests: { github: 'ok', linear: 'ok', ...o.tokenTests },
    simplicate: {
      employee: { id: IDS.employee, name: user.name, work_email: user.email },
      projects: [{ id: IDS.project, name: 'ACME Website', organizationName: 'ACME B.V.' }],
      services: [
        {
          id: IDS.service,
          name: 'Development',
          projectId: IDS.project,
          hourTypes: [{ id: IDS.hourType, label: 'Ontwikkeling' }],
        },
      ],
      hourTypes: [{ id: IDS.hourType, label: 'Ontwikkeling' }],
      hourEntries: [],
      submissions: [],
      ...o.simplicate,
    },
    calendarByDate: o.calendarByDate ?? {},
    github: { commits: [], ...o.github },
    linear: { issues: [], ...o.linear },
    files: o.files ?? {},
    gemini: o.gemini ?? {},
  }
  return base
}

// --- builders for fixture pieces -------------------------------------------

export function makeHourEntry(p: Partial<E2EHourEntry> = {}): E2EHourEntry {
  return {
    id: p.id ?? `seed-${Math.abs(hash(JSON.stringify(p)))}`,
    employeeId: p.employeeId ?? IDS.employee,
    projectId: p.projectId ?? IDS.project,
    projectServiceId: p.projectServiceId ?? IDS.service,
    hourTypeId: p.hourTypeId ?? IDS.hourType,
    hours: p.hours ?? 1,
    startDate: p.startDate ?? TODAY,
    startTime: p.startTime ?? '09:00',
    endTime: p.endTime ?? '10:00',
    note: p.note ?? 'Bestaande boeking',
  }
}

/** A pre-imported browser-history block (un-classified) for a given date. */
export interface HistoryBlockSeed {
  date: string
  urlPattern: string
  urls: string[]
  titles: string[]
  visitCount: number
  firstVisitTime: string
  lastVisitTime: string
  hours: number
}

export function makeHistoryBlock(p: Partial<HistoryBlockSeed> = {}): HistoryBlockSeed {
  return {
    date: p.date ?? TODAY,
    urlPattern: p.urlPattern ?? 'github.com/acme',
    urls: p.urls ?? ['https://github.com/acme/web/pull/1'],
    titles: p.titles ?? ['PR #1 · acme/web'],
    visitCount: p.visitCount ?? 5,
    firstVisitTime: p.firstVisitTime ?? '10:00',
    lastVisitTime: p.lastVisitTime ?? '11:30',
    hours: p.hours ?? 1.5,
  }
}

/** Serialise history blocks into the history-store.json the fake FS will serve. */
export function historyStoreFile(blocksByDate: Record<string, unknown[]>): Record<string, string> {
  return { 'history-store.json': JSON.stringify(blocksByDate, null, 2) }
}

/** A pre-placed leftover (unplaced) ClassifiedBlock for the sidebar. */
export function makeLeftoverBlock(p: Partial<Record<string, unknown>> = {}) {
  return {
    date: TODAY,
    urlPattern: 'leftover.acme',
    urls: ['https://github.com/acme/web/pull/9'],
    titles: ['PR #9'],
    visitCount: 2,
    firstVisitTime: '14:00',
    lastVisitTime: '15:00',
    hours: 1,
    blockName: 'Overgebleven werk',
    summary: '',
    startTime: '14:00',
    endTime: '15:00',
    projectId: IDS.project,
    serviceId: IDS.service,
    hourTypeId: IDS.hourType,
    confidence: 3,
    origin: 'llm',
    unplaced: true,
    leftoverReason: 'suggestion',
    ...p,
  }
}

export function makeCalendarEvent(p: Partial<E2EGoogleEvent> & { date?: string } = {}): E2EGoogleEvent {
  const date = p.date ?? TODAY
  return {
    id: p.id ?? 'evt-1',
    summary: p.summary ?? 'Daily standup',
    start: p.start ?? { dateTime: `${date}T09:30:00+02:00` },
    end: p.end ?? { dateTime: `${date}T10:00:00+02:00` },
    attendees: p.attendees ?? [{ email: 'guus.e2e@harborn.test', self: true, responseStatus: 'accepted' }],
    status: p.status,
  }
}

export function makeCommit(p: Partial<{ sha: string; message: string; date: string; repo: string }> = {}): E2EGitHubCommitItem {
  return {
    sha: p.sha ?? 'abc1234def',
    commit: { message: p.message ?? 'Fix booking error surfacing', author: { date: p.date ?? `${TODAY}T10:15:00Z` } },
    repository: { full_name: p.repo ?? 'acme/web' },
  }
}

export function makeLinearIssue(p: Partial<E2ELinearNode> = {}): E2ELinearNode {
  return {
    identifier: p.identifier ?? 'ACM-42',
    title: p.title ?? 'Surface booking error',
    completedAt: p.completedAt ?? `${TODAY}T12:00:00Z`,
    url: p.url ?? 'https://linear.app/acme/issue/ACM-42',
  }
}

/** The inner JSON the fake Gemini returns for classifyDay. */
export function classifyDayResponse(
  blocks: Array<{
    index: number
    blockName: string
    summary?: string
    projectId: string | null
    serviceId: string | null
    hourTypeId?: string | null
    note?: string
    confidence: number
  }>,
): E2EScenario['gemini'] {
  return {
    classifyDay: {
      blocks: blocks.map((b) => ({
        index: b.index,
        blockName: b.blockName,
        summary: b.summary ?? '',
        projectId: b.projectId,
        serviceId: b.serviceId,
        hourTypeId: b.hourTypeId ?? null,
        note: b.note ?? '',
        confidence: b.confidence,
        relatedIssueIds: [],
      })),
    },
  }
}

/**
 * Overrides for a day that can be classified into exactly one green concept block
 * (one imported history block -> one Gemini-classified ACME block). Reused by the
 * verwerk / boeken / clear / timeline-edit specs.
 */
export function classifiableDay(opts: { bookError?: string; extraHourEntries?: E2EHourEntry[] } = {}): ScenarioOverrides {
  return {
    simplicate: {
      hourEntries: [
        makeHourEntry({ startDate: '2026-05-26', note: 'vorige week' }),
        makeHourEntry({ startDate: '2026-05-19', note: 'week ervoor' }),
        ...(opts.extraHourEntries ?? []),
      ],
      ...(opts.bookError ? { bookError: opts.bookError } : {}),
    },
    files: historyStoreFile({ [TODAY]: [makeHistoryBlock({ urlPattern: 'github.com/acme' })] }),
    gemini: classifyDayResponse([
      {
        index: 0,
        blockName: 'ACME Website werk',
        summary: 'PR review',
        projectId: IDS.project,
        serviceId: IDS.service,
        hourTypeId: IDS.hourType,
        note: 'PR #1 review',
        confidence: 4,
      },
    ]),
  }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
