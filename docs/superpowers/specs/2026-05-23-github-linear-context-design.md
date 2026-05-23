# Design: GitHub + Linear context voor LLM classificatie

**Datum:** 2026-05-23  
**Status:** Goedgekeurd

---

## Samenvatting

De LLM-classificatie wordt uitgebreid met twee nieuwe databronnen: GitHub commits (van de ingelogde gebruiker) en Linear issues (afgerond in de betreffende week). Deze data wordt zichtbaar als extra secties in het `EvidencePanel` en meegestuurd in de LLM-prompt. Een nieuwe "Verwerk week" knop in de sidebar verwerkt alle werkdagen van de huidige week in één keer.

---

## Nieuwe entiteiten (Domain)

### `GitHubCommit`
```ts
interface GitHubCommit {
  sha: string
  message: string        // eerste regel van commit message
  repo: string           // "owner/repo"
  branch: string
  timestamp: string      // ISO 8601
  time: string           // "HH:MM" lokale tijd
}
```

### `LinearIssue`
```ts
interface LinearIssue {
  identifier: string     // "ENG-42"
  title: string
  completedAt: string    // ISO 8601
  url: string
}
```

### `DayContext`
```ts
interface DayContext {
  commits: GitHubCommit[]      // commits op die specifieke dag
  linearIssues: LinearIssue[]  // afgerond in de week (zelfde lijst elke dag)
}
```

---

## Repository interfaces (Domain)

### `IGitHubRepository`
```ts
interface IGitHubRepository {
  getCommitsForWeek(username: string, weekStart: string, weekEnd: string): Promise<GitHubCommit[]>
}
```

- Roept `GET /users/:username/events` aan (public events API)
- Filtert op `PushEvent`, extraheert commits per dag
- Authenticatie: `Authorization: Bearer <token>` met PAT uit Keychain (`github-token`)

### `ILinearRepository`
```ts
interface ILinearRepository {
  getCompletedIssuesForWeek(weekStart: string, weekEnd: string): Promise<LinearIssue[]>
}
```

- GraphQL query op `api.linear.app/graphql`
- Filter: `completedAt >= weekStart AND completedAt <= weekEnd AND assignee = viewer`
- Authenticatie: `Authorization: <token>` met Personal API Key uit Keychain (`linear-token`)

---

## Use cases (Domain)

### `FetchGitHubContextUseCase`
- `execute(username: string, weekStart: string, weekEnd: string): Promise<GitHubCommit[]>`
- Roept `IGitHubRepository.getCommitsForWeek` aan
- Geeft lege array terug als token niet geconfigureerd is (geen error)

### `FetchLinearContextUseCase`
- `execute(weekStart: string, weekEnd: string): Promise<LinearIssue[]>`
- Roept `ILinearRepository.getCompletedIssuesForWeek` aan
- Geeft lege array terug als token niet geconfigureerd is (geen error)

### `GroupAndClassifyDayUseCase` uitbreiding

`execute` krijgt een optionele `context?: DayContext` parameter die wordt doorgegeven aan `ICopilotRepository.classifyDay`. Na classificatie worden `commits` (gefilterd op die dag) en `linearIssues` gehecht aan elk teruggegeven `ClassifiedBlock`.

### `ProcessWeekUseCase`
- `execute(weekStart: string, weekEnd: string): AsyncGenerator<ProcessWeekProgress>`
- Stappen:
  1. Haal GitHub commits op voor de hele week (één API call)
  2. Haal Linear issues op voor de hele week (één API call)
  3. Loop ma–vr: per dag `GroupAndClassifyDayUseCase` aanroepen met `DayContext`
  4. Per dag: sla resultaten op via `historyStore.saveBlocksForDate`
- Yield `ProcessWeekProgress` per stap voor UI feedback

```ts
interface ProcessWeekProgress {
  phase: 'fetching-github' | 'fetching-linear' | 'classifying-day' | 'done' | 'error'
  day?: string        // ISO date, aanwezig bij 'classifying-day'
  dayIndex?: number   // 0-4
  error?: string
}
```

---

## Infrastructure

### `GitHubRepository`
- Locatie: `src/infrastructure/github/GitHubRepository.ts`
- Roept GitHub REST API aan via Tauri's `fetch` (of `invoke('http_request')` als CORS blokkering)
- Token ophalen uit Keychain bij elke aanroep
- Rate limit: GitHub public events API geeft max 300 events per pagina; één pagina is voldoende voor een week

### `LinearRepository`
- Locatie: `src/infrastructure/linear/LinearRepository.ts`
- GraphQL via Tauri fetch
- Token ophalen uit Keychain bij elke aanroep

---

## Prompt uitbreiding (CopilotRepository)

`classifyDay` krijgt een optionele `context?: DayContext` parameter. De prompt-builder voegt twee secties toe:

```
## GitHub commits (dinsdag 20 mei)
- 10:23 feat: add booking modal close on ESC [uren-schrijven]
- 11:47 fix: drag logic in DayTimeline container [uren-schrijven]

## Linear issues (afgerond deze week)
- ENG-42 · Booking modal redesign ✓ (afgerond di 20 mei)
- ENG-38 · Dark mode redesign ✓ (afgerond ma 19 mei)
```

Beide secties worden alleen toegevoegd als de respectieve array niet leeg is. De secties staan na de calendar context en voor de browser activity blocks.

`ICopilotRepository.classifyDay` signature wordt uitgebreid:
```ts
classifyDay(
  date: string,
  items: DayItem[],
  availableProjects: Project[],
  availableServices: Service[],
  cacheHints: Record<string, { projectName: string; serviceName: string }>,
  context?: DayContext,   // nieuw, optioneel
): Promise<DayClassificationResult[]>
```

---

## UI

### `EvidencePanel` uitbreiding

Props uitbreiding:
```ts
commits?: GitHubCommit[]
linearIssues?: LinearIssue[]
```

Twee nieuwe secties onder de bestaande browsing/agenda secties, met dezelfde visuele stijl (`bg-[#161412]`, `border-[#2e2a26]`):

**GitHub commits sectie** (alleen als `commits.length > 0`):
- Label: "GitHub commits (N)"
- Per commit: icoon `GH` (achtergrond `#2a1e12`, kleur `#f48024`) + message (truncated) + repo + tijd

**Linear issues sectie** (alleen als `linearIssues.length > 0`):
- Label: "Linear (deze week, afgerond)"
- Per issue: icoon `LN` (achtergrond `#1a1a2e`, kleur `#8b5cf6`) + identifier + titel + groene "✓ done" badge

### `ClassifiedBlock` uitbreiding

```ts
// toevoeging aan bestaande interface
commits?: GitHubCommit[]
linearIssues?: LinearIssue[]
```

`DayClassificationResult` bevat deze velden niet — de context wordt na classificatie aan het block gehecht door `ProcessWeekUseCase` / `GroupAndClassifyDayUseCase`.

### `WeekDayList` uitbreiding

Nieuwe prop: `onProcessWeek?: () => void`

Onderaan de dag-lijst een "Verwerk week" knop:
- Zichtbaar altijd (ook zonder tokens — dan toont het de Settings hint)
- Loading state: `processingDay?: string | null` prop — toont per dag een ✓ of ··· badge
- Tekst: "Verwerk week" / "Bezig..." tijdens verwerking

### `WeekPage` uitbreiding

- Laadt `githubToken` en `linearToken` uit `appStore`
- Instantieert `ProcessWeekUseCase` met de juiste repositories
- Beheert `processingState: Map<string, 'pending' | 'classifying' | 'done'>` tijdens verwerking
- Na voltooiing: `week.refresh()` om geboekte uren opnieuw te laden

### `AccountSettings` uitbreiding

Twee nieuwe secties na het bestaande Copilot-token blok:

**GitHub token sectie:**
- Label: "GitHub token"
- Hint: `gh auth token` — heeft `repo` scope nodig
- Keychain key: `github-token`
- appStore: `setGithubToken`

**Linear API key sectie:**
- Label: "Linear API key"
- Hint: linear.me → Settings → API → Personal API keys
- Keychain key: `linear-token`
- appStore: `setLinearToken`

### `appStore` uitbreiding

```ts
githubToken: string | null
linearToken: string | null
setGithubToken: (token: string) => void
setLinearToken: (token: string) => void
```

---

## Data flow (week verwerking)

```
WeekPage
  → ProcessWeekUseCase.execute(weekStart, weekEnd)
    → FetchGitHubContextUseCase  → GitHubRepository → api.github.com
    → FetchLinearContextUseCase  → LinearRepository  → api.linear.app
    → per dag (ma–vr):
        GroupAndClassifyDayUseCase(date, context: DayContext)
          → CopilotRepository.classifyDay(..., context)
          → resultaten + context gehecht aan ClassifiedBlock
        historyStore.saveBlocksForDate(date, blocks)
  → yield ProcessWeekProgress per stap
WeekPage ontvangt progress → update UI per dag
```

---

## Error handling

- GitHub token ontbreekt of ongeldig: `FetchGitHubContextUseCase` returnt `[]`, classificatie gaat door zonder commits
- Linear token ontbreekt of ongeldig: idem, classificatie gaat door zonder Linear issues
- GitHub rate limit (60 req/uur voor authenticated): niet verwacht bij normaal gebruik (1 call per week-verwerking)
- Classificatie mislukt voor een dag: `ProcessWeekUseCase` yieldt `{ phase: 'error', day, error }`, slaat die dag over, gaat door met volgende dag

---

## Testing

- `FetchGitHubContextUseCase` unit test: mock `IGitHubRepository`, verifieer dag-filtering
- `FetchLinearContextUseCase` unit test: mock `ILinearRepository`
- `ProcessWeekUseCase` unit test: mock alle dependencies, verifieer volgorde van days en progress yields
- `CopilotRepository` prompt test: verifieer dat commits/Linear secties correct in prompt verschijnen
- `EvidencePanel` snapshot/render test: verifieer dat nieuwe secties renderen als data aanwezig is

---

## Niet in scope

- Meerdere GitHub users of orgs (alleen de ingelogde gebruiker via `gh auth token`)
- Linear issues die niet door de ingelogde gebruiker zijn afgerond
- Automatisch boeken na week-verwerking (gebruiker boekt per dag handmatig)
- Caching van GitHub/Linear data tussen sessies
