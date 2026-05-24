# Relatieve lookback, projectfilter en patroonherkenning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De LLM krijgt alleen projecten te zien waarop de afgelopen 4 weken (relatief aan de doeldatum) geboekt is, inclusief volledige boekingshistorie als context, en herkent terugkerende patronen om extra blokken voor te stellen.

**Architecture:** Nieuwe use case `GetActiveProjectsForDateUseCase` bepaalt het gefilterde projectenlijst + historische entries. `ProcessDayUseCase` roept deze aan en geeft het resultaat door aan `GroupAndClassifyDayUseCase`, die het doorgeeft aan `CopilotRepository.classifyDay`. De LLM-prompt wordt uitgebreid met een historische sectie en patrooninstructie; de output krijgt een optioneel `patternBlocks`-veld.

**Tech Stack:** TypeScript strict, Vitest, Tauri IPC, GPT-4o via GitHub Copilot

---

## File Map

| Bestand | Actie |
|---|---|
| `src/domain/entities/HourEntrySuggestion.ts` | Modify — `reason` uitbreiden met `'llm-pattern'` |
| `src/domain/usecases/GetActiveProjectsForDateUseCase.ts` | Create |
| `src/domain/usecases/ProcessDayUseCase.ts` | Modify — roept `GetActiveProjectsForDateUseCase` aan |
| `src/domain/usecases/GroupAndClassifyDayUseCase.ts` | Modify — accepteert `activeProjects` + `historicalEntries` |
| `src/infrastructure/copilot/CopilotRepository.ts` | Modify — prompt uitbreiding + `patternBlocks` output |
| `src/application/container.ts` | Modify — registreert `GetActiveProjectsForDateUseCase` |
| `src/domain/repositories/ICopilotRepository.ts` | Modify — `classifyDay` signatuur uitbreiden |
| `src/tests/GetActiveProjectsForDateUseCase.test.ts` | Create |

---

### Task 1: Extend `HourEntrySuggestion.reason` with `'llm-pattern'`

**Files:**
- Modify: `src/domain/entities/HourEntrySuggestion.ts`

- [ ] **Step 1: Open het bestand en pas `reason` aan**

Vervang:
```typescript
reason: 'pattern' | 'last-week'
```
Door:
```typescript
reason: 'pattern' | 'last-week' | 'llm-pattern'
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/entities/HourEntrySuggestion.ts
git commit -m "feat: extend HourEntrySuggestion reason with llm-pattern"
```

---

### Task 2: Create `GetActiveProjectsForDateUseCase`

**Files:**
- Create: `src/domain/usecases/GetActiveProjectsForDateUseCase.ts`
- Create: `src/tests/GetActiveProjectsForDateUseCase.test.ts`

- [ ] **Step 1: Schrijf de failing tests**

Maak `src/tests/GetActiveProjectsForDateUseCase.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { GetActiveProjectsForDateUseCase } from '../domain/usecases/GetActiveProjectsForDateUseCase'
import type { ISimplicateRepository, SimplicateProject } from '../domain/repositories/ISimplicateRepository'
import type { HourEntry } from '../domain/entities/HourEntry'

function makeRepo(entries: HourEntry[], projects: SimplicateProject[]): ISimplicateRepository {
  return {
    getHourEntries: vi.fn().mockResolvedValue(entries),
    getProjects: vi.fn().mockResolvedValue(projects),
    getServices: vi.fn(),
    getHourTypes: vi.fn(),
    getEmployee: vi.fn(),
    bookHours: vi.fn(),
  } as unknown as ISimplicateRepository
}

function makeEntry(projectId: string, startDate: string): HourEntry {
  return {
    id: 'e1',
    employeeId: 'emp1',
    projectId,
    projectServiceId: 'svc1',
    hourTypeId: 'ht1',
    hours: 1,
    startDate,
    startTime: '09:00',
    endTime: '10:00',
    note: '',
  }
}

describe('GetActiveProjectsForDateUseCase', () => {
  it('fetches entries for [targetDate-28d, targetDate) window', async () => {
    const repo = makeRepo([], [])
    const uc = new GetActiveProjectsForDateUseCase(repo)
    await uc.execute('2026-05-24', 'emp1')
    expect(repo.getHourEntries).toHaveBeenCalledWith('emp1', '2026-04-26', '2026-05-24')
  })

  it('returns only projects that appear in the historical entries', async () => {
    const projects: SimplicateProject[] = [
      { id: 'P1', name: 'Actief', organizationName: 'Org' },
      { id: 'P2', name: 'Inactief', organizationName: 'Org' },
    ]
    const entries = [makeEntry('P1', '2026-05-10')]
    const repo = makeRepo(entries, projects)
    const uc = new GetActiveProjectsForDateUseCase(repo)
    const result = await uc.execute('2026-05-24', 'emp1')
    expect(result.activeProjects.map(p => p.id)).toEqual(['P1'])
    expect(result.activeProjects).toHaveLength(1)
  })

  it('sorts projects by booking count descending', async () => {
    const projects: SimplicateProject[] = [
      { id: 'P1', name: 'Weinig', organizationName: 'Org' },
      { id: 'P2', name: 'Veel', organizationName: 'Org' },
    ]
    const entries = [
      makeEntry('P1', '2026-05-10'),
      makeEntry('P2', '2026-05-10'),
      makeEntry('P2', '2026-05-11'),
      makeEntry('P2', '2026-05-12'),
    ]
    const repo = makeRepo(entries, projects)
    const uc = new GetActiveProjectsForDateUseCase(repo)
    const result = await uc.execute('2026-05-24', 'emp1')
    expect(result.activeProjects[0]!.id).toBe('P2')
    expect(result.activeProjects[1]!.id).toBe('P1')
  })

  it('returns all historical entries unchanged', async () => {
    const projects: SimplicateProject[] = [
      { id: 'P1', name: 'A', organizationName: 'Org' },
    ]
    const entries = [makeEntry('P1', '2026-05-10'), makeEntry('P1', '2026-05-11')]
    const repo = makeRepo(entries, projects)
    const uc = new GetActiveProjectsForDateUseCase(repo)
    const result = await uc.execute('2026-05-24', 'emp1')
    expect(result.historicalEntries).toHaveLength(2)
  })

  it('uses targetDate-relative window, not today', async () => {
    const repo = makeRepo([], [])
    const uc = new GetActiveProjectsForDateUseCase(repo)
    await uc.execute('2026-03-10', 'emp1')
    // 2026-03-10 - 28 days = 2026-02-10
    expect(repo.getHourEntries).toHaveBeenCalledWith('emp1', '2026-02-10', '2026-03-10')
  })
})
```

- [ ] **Step 2: Draai de tests — verwacht FAIL**

```bash
npm run test -- GetActiveProjectsForDateUseCase
```
Expected: FAIL met "Cannot find module '../domain/usecases/GetActiveProjectsForDateUseCase'"

- [ ] **Step 3: Implementeer de use case**

Maak `src/domain/usecases/GetActiveProjectsForDateUseCase.ts`:

```typescript
import type { ISimplicateRepository, SimplicateProject } from '../repositories/ISimplicateRepository'
import type { HourEntry } from '../entities/HourEntry'

function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface ActiveProjectsResult {
  activeProjects: SimplicateProject[]
  historicalEntries: HourEntry[]
}

export class GetActiveProjectsForDateUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(targetDate: string, employeeId: string): Promise<ActiveProjectsResult> {
    const windowStart = subtractDays(targetDate, 28)

    const [historicalEntries, allProjects] = await Promise.all([
      this.simplicateRepo.getHourEntries(employeeId, windowStart, targetDate),
      this.simplicateRepo.getProjects(),
    ])

    const bookingCountByProject = new Map<string, number>()
    for (const entry of historicalEntries) {
      bookingCountByProject.set(
        entry.projectId,
        (bookingCountByProject.get(entry.projectId) ?? 0) + 1,
      )
    }

    const activeProjectIds = new Set(bookingCountByProject.keys())

    const activeProjects = allProjects
      .filter(p => activeProjectIds.has(p.id))
      .sort((a, b) => (bookingCountByProject.get(b.id) ?? 0) - (bookingCountByProject.get(a.id) ?? 0))

    return { activeProjects, historicalEntries }
  }
}
```

- [ ] **Step 4: Draai de tests — verwacht PASS**

```bash
npm run test -- GetActiveProjectsForDateUseCase
```
Expected: alle 5 tests PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: geen errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/usecases/GetActiveProjectsForDateUseCase.ts src/tests/GetActiveProjectsForDateUseCase.test.ts
git commit -m "feat: add GetActiveProjectsForDateUseCase with relative 28-day lookback"
```

---

### Task 3: Extend `ICopilotRepository.classifyDay` signature

**Files:**
- Modify: `src/domain/repositories/ICopilotRepository.ts`

- [ ] **Step 1: Lees het bestand**

```bash
cat src/domain/repositories/ICopilotRepository.ts
```

- [ ] **Step 2: Voeg `historicalEntries` parameter en `patternBlocks` return toe**

Zoek de `classifyDay`-signatuur in het interface. Vervang:
```typescript
classifyDay(
  date: string,
  items: DayItem[],
  projects: Project[],
  services: Service[],
  cacheHints: Record<string, { projectName: string; serviceName: string }>,
  context?: DayContext,
): Promise<DayClassificationResult[]>
```
Door:
```typescript
classifyDay(
  date: string,
  items: DayItem[],
  projects: Project[],
  services: Service[],
  cacheHints: Record<string, { projectName: string; serviceName: string }>,
  context?: DayContext,
  historicalEntries?: HourEntry[],
): Promise<DayClassificationResult[]>
```

Voeg ook bovenaan de imports toe (als `HourEntry` nog niet geïmporteerd is):
```typescript
import type { HourEntry } from '../entities/HourEntry'
```

- [ ] **Step 3: Voeg `patternBlocks` toe aan `DayClassificationResult`** (als dat type in dit bestand staat, anders skip)

Zoek `DayClassificationResult`. Voeg toe:
```typescript
patternBlocks?: PatternBlock[]
```

En definieer het type (in hetzelfde bestand):
```typescript
export interface PatternBlock {
  blockName: string
  summary: string
  projectId: string | null
  serviceId: string | null
  note: string
  confidence: number
  estimatedHours: number
  origin: 'llm-pattern'
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: mogelijk errors in `CopilotRepository.ts` — die worden opgelost in Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/domain/repositories/ICopilotRepository.ts
git commit -m "feat: extend ICopilotRepository classifyDay with historicalEntries and patternBlocks"
```

---

### Task 4: Update `CopilotRepository.classifyDay` — prompt + patternBlocks

**Files:**
- Modify: `src/infrastructure/copilot/CopilotRepository.ts`

- [ ] **Step 1: Voeg `HourEntry` import toe bovenaan**

```typescript
import type { HourEntry } from '../../domain/entities/HourEntry'
```

- [ ] **Step 2: Voeg helper `formatHistoricalEntries` toe**

Voeg toe na de bestaande `formatDayContext`-functie:

```typescript
function formatHistoricalEntries(entries: HourEntry[], projects: Project[], services: Service[]): string {
  if (entries.length === 0) return ''

  const projectById = new Map(projects.map(p => [p.id, p.name]))
  const serviceById = new Map(services.map(s => [s.id, s.name]))

  const byDate = new Map<string, HourEntry[]>()
  for (const entry of entries) {
    const list = byDate.get(entry.startDate) ?? []
    list.push(entry)
    byDate.set(entry.startDate, list)
  }

  const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))

  const lines: string[] = ['## Historische boekingen (afgelopen 4 weken)\n']
  for (const date of sortedDates) {
    lines.push(`${date}:`)
    for (const e of byDate.get(date)!) {
      const projectName = projectById.get(e.projectId) ?? e.projectId
      const serviceName = serviceById.get(e.projectServiceId) ?? e.projectServiceId
      const noteStr = e.note ? ` | note: "${e.note}"` : ''
      lines.push(`  - ${e.startTime}–${e.endTime} | Project: ${projectName} (id: ${e.projectId}) / Dienst: ${serviceName} (id: ${e.projectServiceId})${noteStr}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
```

- [ ] **Step 3: Update `classifyDay` signatuur**

Vervang de huidige signatuur:
```typescript
async classifyDay(
  date: string,
  items: DayItem[],
  availableProjects: Project[],
  availableServices: Service[],
  cacheHints: Record<string, { projectName: string; serviceName: string }>,
  context?: DayContext,
): Promise<DayClassificationResult[]> {
```
Door:
```typescript
async classifyDay(
  date: string,
  items: DayItem[],
  availableProjects: Project[],
  availableServices: Service[],
  cacheHints: Record<string, { projectName: string; serviceName: string }>,
  context?: DayContext,
  historicalEntries?: HourEntry[],
): Promise<DayClassificationResult[]> {
```

- [ ] **Step 4: Voeg de historische sectie toe aan de prompt**

Zoek in `classifyDay` de variabele `prompt`. Vlak vóór de regel `const prompt = `` voeg toe:

```typescript
const historicalSection = historicalEntries && historicalEntries.length > 0
  ? formatHistoricalEntries(historicalEntries, availableProjects, availableServices) + '\n'
  : ''
```

Voeg in de template string van `prompt`, ná `${hintsSection}${contextSection}` maar vóór `Beschikbare projecten:`, toe:

```
${historicalSection}
```

- [ ] **Step 5: Voeg patrooninstructie toe aan de prompt**

Zoek de instructieregel in `prompt` die begint met `"Je bent een tijdregistratie-assistent"`. Voeg aan het einde van de systeem-instructie (vóór de secties) toe:

```
Analyseer de historische boekingen op terugkerende patronen:
- Een patroon is een combinatie van project+dienst die op vergelijkbare intervallen voorkomt (bijv. elke week, elke 2 weken)
- Als een patroon matcht met de doeldatum (${date}) EN er is geen browser-activiteit of calendar-event voor die combinatie, voeg dan een extra item toe in het veld "patternBlocks" in de response
- Elk patroonblok heeft: blockName, summary, projectId, serviceId, note, confidence, estimatedHours (schatting in uren op basis van historisch gemiddelde), origin ("llm-pattern")
- Geef patronen hogere confidence dan losse browser-activiteit zonder aanvullende context
```

- [ ] **Step 6: Update de response-parsing om `patternBlocks` te verwerken**

De LLM-response is nu een object met twee velden. Vervang de response-structuur.

Verander de LLM-response interface (lokaal in de functie of bovenaan het bestand):

Vervang:
```typescript
let results: DayClassificationResult[]
try {
  results = JSON.parse(content) as DayClassificationResult[]
} catch {
  throw new Error('Copilot returned invalid JSON for classifyDay')
}

if (!Array.isArray(results)) {
  throw new Error('Copilot classifyDay returned unexpected format (not an array)')
}

return results
```

Door:
```typescript
interface ClassifyDayResponse {
  blocks: DayClassificationResult[]
  patternBlocks?: PatternBlock[]
}

let parsed: ClassifyDayResponse | DayClassificationResult[]
try {
  parsed = JSON.parse(content) as ClassifyDayResponse | DayClassificationResult[]
} catch {
  throw new Error('Copilot returned invalid JSON for classifyDay')
}

// Backward compat: als de LLM een array teruggeeft (geen patternBlocks)
if (Array.isArray(parsed)) {
  return parsed
}

if (!Array.isArray(parsed.blocks)) {
  throw new Error('Copilot classifyDay returned unexpected format')
}

// Voeg patternBlocks toe als extra items achteraan (worden verwerkt in GroupAndClassifyDayUseCase)
const patternResults: DayClassificationResult[] = (parsed.patternBlocks ?? []).map((pb, i) => ({
  index: -1000 - i, // negatieve index = patroonblok
  blockName: pb.blockName,
  summary: pb.summary,
  projectId: pb.projectId,
  serviceId: pb.serviceId,
  note: pb.note,
  confidence: pb.confidence,
  relatedIssueIds: [],
  isPatternBlock: true,
  estimatedHours: pb.estimatedHours,
}))

return [...parsed.blocks, ...patternResults]
```

Voeg bovenaan het bestand de import toe voor `PatternBlock`:
```typescript
import type { PatternBlock } from '../../domain/repositories/ICopilotRepository'
```

- [ ] **Step 7: Update de LLM-output instructie in de prompt**

Vervang de JSON-output instructie in `prompt`:
```
Geef een JSON-array terug. Elk item heeft:
```
Door:
```
Geef een JSON-object terug met twee velden:
- "blocks": array van geclassificeerde items (één per genummerd blok hierboven)
- "patternBlocks": array van extra blokken die puur op patroonherkenning zijn gebaseerd (kan leeg zijn)

Elk item in "blocks" heeft:
```

En voeg toe na de bestaande veld-lijst:
```
Elk item in "patternBlocks" heeft:
- blockName (string, leesbare naam max 60 tekens)
- summary (string, korte samenvatting, max 120 tekens, Nederlands)
- projectId (string | null)
- serviceId (string | null)
- note (string, max 80 tekens)
- confidence (number 0-1)
- estimatedHours (number, schatting in uren op basis van historisch gemiddelde)
- origin (altijd "llm-pattern")
```

- [ ] **Step 8: Typecheck**

```bash
npm run typecheck
```
Expected: geen errors.

- [ ] **Step 9: Commit**

```bash
git add src/infrastructure/copilot/CopilotRepository.ts
git commit -m "feat: extend classifyDay prompt with historical entries, pattern instruction and patternBlocks output"
```

---

### Task 5: Update `GroupAndClassifyDayUseCase` to accept filtered projects + historicalEntries

**Files:**
- Modify: `src/domain/usecases/GroupAndClassifyDayUseCase.ts`

- [ ] **Step 1: Voeg `historicalEntries` toe aan de constructor-parameters**

Vervang de constructor:
```typescript
constructor(
  private readonly copilotRepo: ICopilotRepository,
  private readonly cacheRepo: IMappingCacheRepository,
  private readonly availableProjects: Project[],
  private readonly availableServices: Service[],
) {}
```
Door:
```typescript
import type { HourEntry } from '../entities/HourEntry'

// ... (in de constructor)
constructor(
  private readonly copilotRepo: ICopilotRepository,
  private readonly cacheRepo: IMappingCacheRepository,
  private readonly availableProjects: Project[],
  private readonly availableServices: Service[],
  private readonly historicalEntries: HourEntry[] = [],
) {}
```

- [ ] **Step 2: Geef `historicalEntries` door aan `classifyDay`**

Zoek de aanroep van `this.copilotRepo.classifyDay(...)`. Vervang:
```typescript
const results = await this.copilotRepo.classifyDay(
  date,
  llmItems,
  this.availableProjects,
  this.availableServices,
  cacheHints,
  context,
)
```
Door:
```typescript
const results = await this.copilotRepo.classifyDay(
  date,
  llmItems,
  this.availableProjects,
  this.availableServices,
  cacheHints,
  context,
  this.historicalEntries,
)
```

- [ ] **Step 3: Verwerk patroonblokken (negatieve index) in de result-verwerking**

Zoek de for-loop `for (const result of results)`. Voeg vóór die loop toe:

```typescript
// Verwerk patroonblokken (index < 0, aangemaakt door LLM op basis van patroonherkenning)
const patternClassified: ClassifiedBlock[] = results
  .filter(r => (r as unknown as { isPatternBlock?: boolean }).isPatternBlock === true)
  .map(r => ({
    date,
    urlPattern: `llm-pattern:${r.blockName}`,
    urls: [],
    titles: [r.blockName],
    visitCount: 0,
    firstVisitTime: '00:00',
    lastVisitTime: '00:00',
    hours: (r as unknown as { estimatedHours?: number }).estimatedHours ?? 1,
    blockName: r.blockName,
    summary: r.summary,
    startTime: '00:00',
    endTime: '00:00',
    note: r.note,
    confidence: r.confidence,
    origin: 'llm-pattern' as const,
    rawTitles: [],
    rawUrls: [],
    ...(r.projectId !== null ? { projectId: r.projectId } : {}),
    ...(r.serviceId !== null ? { serviceId: r.serviceId } : {}),
  }))

const regularResults = results.filter(r => !(r as unknown as { isPatternBlock?: boolean }).isPatternBlock)
```

Vervang vervolgens `for (const result of results)` door `for (const result of regularResults)`.

Vervang in de finale samenvoeging:
```typescript
const all = [...cacheResults, ...llmResults]
```
Door:
```typescript
const all = [...cacheResults, ...llmResults, ...patternClassified]
```

- [ ] **Step 4: Voeg `'llm-pattern'` toe aan het `origin` type van `ClassifiedBlock`**

Lees `src/domain/entities/ClassifiedBlock.ts`. Zoek het veld `origin`. Voeg `'llm-pattern'` toe aan de union:
```typescript
origin: 'cache' | 'llm' | 'llm-pattern'
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: geen errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/usecases/GroupAndClassifyDayUseCase.ts src/domain/entities/ClassifiedBlock.ts
git commit -m "feat: GroupAndClassifyDayUseCase passes historicalEntries to LLM and handles patternBlocks"
```

---

### Task 6: Update `ProcessDayUseCase` to use `GetActiveProjectsForDateUseCase`

**Files:**
- Modify: `src/domain/usecases/ProcessDayUseCase.ts`

- [ ] **Step 1: Voeg de nieuwe use case toe als dependency**

Voeg import toe:
```typescript
import { GetActiveProjectsForDateUseCase } from './GetActiveProjectsForDateUseCase'
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
```

Voeg aan de constructor toe:
```typescript
private readonly simplicateRepo: ISimplicateRepository,
private readonly simplicateEmployeeId: string,
```

Voeg in de constructor-body toe:
```typescript
private readonly getActiveProjects: GetActiveProjectsForDateUseCase

// in constructor body:
this.getActiveProjects = new GetActiveProjectsForDateUseCase(simplicateRepo)
```

De volledige nieuwe constructor wordt:
```typescript
constructor(
  githubRepo: IGitHubRepository,
  linearRepo: ILinearRepository,
  private readonly calendarRepo: IGoogleCalendarRepository,
  private readonly historyStore: IHistoryStore,
  private readonly copilotRepo: ICopilotRepository,
  private readonly cacheRepo: IMappingCacheRepository,
  private readonly availableProjects: Project[],
  private readonly availableServices: Service[],
  private readonly githubUsername: string,
  private readonly simplicateRepo: ISimplicateRepository,
  private readonly simplicateEmployeeId: string,
) {
  this.fetchGitHub = new FetchGitHubContextUseCase(githubRepo)
  this.fetchLinear = new FetchLinearContextUseCase(linearRepo)
  this.getActiveProjects = new GetActiveProjectsForDateUseCase(simplicateRepo)
}
```

- [ ] **Step 2: Roep `getActiveProjects` aan in `execute`**

Zoek de `Promise.all`-aanroep in `execute`. Vervang:
```typescript
const [allCommits, linearIssues, calendarEvents, historyBlocks] = await Promise.all([
  this.fetchGitHub.execute(this.githubUsername, date, date),
  this.fetchLinear.execute(date, date),
  this.calendarRepo.fetchEvents(dayStart, dayEnd),
  this.historyStore.getBlocksForDate(date),
])
```
Door:
```typescript
const [allCommits, linearIssues, calendarEvents, historyBlocks, activeProjectsResult] = await Promise.all([
  this.fetchGitHub.execute(this.githubUsername, date, date),
  this.fetchLinear.execute(date, date),
  this.calendarRepo.fetchEvents(dayStart, dayEnd),
  this.historyStore.getBlocksForDate(date),
  this.getActiveProjects.execute(date, this.simplicateEmployeeId),
])
```

- [ ] **Step 3: Geef gefilterde projecten en historische entries door aan `GroupAndClassifyDayUseCase`**

Vervang:
```typescript
const groupAndClassify = new GroupAndClassifyDayUseCase(
  this.copilotRepo,
  this.cacheRepo,
  this.availableProjects,
  this.availableServices,
)
```
Door:
```typescript
const groupAndClassify = new GroupAndClassifyDayUseCase(
  this.copilotRepo,
  this.cacheRepo,
  activeProjectsResult.activeProjects,
  this.availableServices,
  activeProjectsResult.historicalEntries,
)
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: errors in `container.ts` — die worden opgelost in Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/domain/usecases/ProcessDayUseCase.ts
git commit -m "feat: ProcessDayUseCase uses GetActiveProjectsForDateUseCase for filtered project context"
```

---

### Task 7: Update `container.ts` to wire new dependencies

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Step 1: Voeg import toe**

```typescript
import { GetActiveProjectsForDateUseCase } from '../domain/usecases/GetActiveProjectsForDateUseCase'
```

- [ ] **Step 2: Exporteer een factory voor de nieuwe use case**

Voeg toe na de bestaande factories:
```typescript
export function createGetActiveProjectsUseCase(simplicateRepo: ISimplicateRepository): GetActiveProjectsForDateUseCase {
  return new GetActiveProjectsForDateUseCase(simplicateRepo)
}
```

- [ ] **Step 3: Update `createProcessDayUseCase`**

Vervang de signatuur en body van `createProcessDayUseCase`:
```typescript
export function createProcessDayUseCase(
  githubToken: string,
  linearToken: string,
  calendarRepo: ReturnType<typeof createCalendarRepository>,
  copilotRepo: ICopilotRepository,
  projects: Project[],
  services: Service[],
  githubUsername: string,
  simplicateRepo: ISimplicateRepository,
  simplicateEmployeeId: string,
): ProcessDayUseCase {
  return new ProcessDayUseCase(
    new GitHubRepository(githubToken),
    new LinearRepository(linearToken),
    calendarRepo,
    historyStore,
    copilotRepo,
    mappingCacheRepo,
    projects,
    services,
    githubUsername,
    simplicateRepo,
    simplicateEmployeeId,
  )
}
```

- [ ] **Step 4: Zoek callers van `createProcessDayUseCase` en update ze**

```bash
grep -r "createProcessDayUseCase\|createProcessWeekUseCase" src/ --include="*.ts" --include="*.tsx" -l
```

Open elk gevonden bestand en voeg de twee nieuwe parameters `simplicateRepo` en `simplicateEmployeeId` toe aan de aanroep. De `simplicateRepo` is doorgaans beschikbaar via `createSimplicateRepository(...)` en `simplicateEmployeeId` via de Zustand store (`useAppStore(s => s.simplicateEmployeeId)`).

**Let op:** `ProcessWeekUseCase` heeft een vergelijkbare constructor. Die use case roept intern `ProcessDayUseCase` aan of doet dezelfde classificatie. Controleer of `ProcessWeekUseCase` ook `GroupAndClassifyDayUseCase` instantieert en zo ja, pas die constructor-aanroep ook aan zodat hij `activeProjects` en `historicalEntries` doorgeeft (per dag). Als `ProcessWeekUseCase` delegeert aan `ProcessDayUseCase`, dan is de fix al gedekt via Task 6.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: geen errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/container.ts
git commit -m "feat: wire GetActiveProjectsForDateUseCase and update createProcessDayUseCase signature"
```

---

### Task 8: Run all tests and lint

- [ ] **Step 1: Draai alle unit tests**

```bash
npm run test
```
Expected: alle tests PASS

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: geen errors

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: geen errors

- [ ] **Step 4: Final commit als er kleine fixes waren**

```bash
git add -A
git commit -m "fix: address lint and typecheck issues after lookback feature"
```
(Alleen als er wijzigingen zijn.)
