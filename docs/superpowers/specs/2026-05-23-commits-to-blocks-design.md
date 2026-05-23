# Design: Commits → tijdblokken

**Datum:** 2026-05-23

## Probleem

GitHub commits worden opgehaald per week maar zijn alleen zichtbaar als kleine groene bolletjes op de tijdlijn. De LLM gebruikt ze als context bij bestaande history blocks, maar als er geen browser history is voor een dag (bijv. een dag puur coderen), verschijnen er geen concept-blokken.

## Oplossing

Commits groeperen in aaneengesloten werk-sessies per repo en omzetten naar `HistoryBlock`-compatibele objecten. Die worden samen met de echte browser history blocks doorgegeven aan `GroupAndClassifyDayUseCase`, zodat de LLM ze classificeert naar projecten en er concept-blokken van maakt.

## Algoritme

1. Groepeer commits per repo (`owner/repo`)
2. Per repo: sorteer commits op tijd
3. Splits op tijdgap > 45 minuten → nieuwe sessie
4. Per sessie: maak een `HistoryBlock`:
   - `urlPattern`: `github.com/{owner}/{repo}`
   - `urls`: `['github.com/{owner}/{repo}']`
   - `titles`: commit-messages (max 10, deduped)
   - `firstVisitTime`: tijd van eerste commit (HH:MM)
   - `lastVisitTime`: tijd van laatste commit + 30 min (max 23:30)
   - `hours`: afgerond op 0.5, min 0.5
   - `visitCount`: aantal commits in sessie
   - `date`: de dag

## Nieuwe component

**`src/domain/usecases/GroupCommitsIntoBlocks.ts`**

Pure functie (geen class, geen dependencies):

```ts
export function groupCommitsIntoBlocks(commits: GitHubCommit[], date: string): HistoryBlock[]
```

- Accepteert alleen commits voor de opgegeven `date`
- Gap-threshold: 45 minuten (constante `SESSION_GAP_MINUTES = 45`)
- Maximaal 10 commit-messages per sessie als `titles`

## Integratie

In `ProcessWeekUseCase.execute()`, na het ophalen van commits:

```ts
const commitBlocks = groupCommitsIntoBlocks(dayCommits, day)
const allBlocks = [...historyBlocks, ...commitBlocks]
// geef allBlocks door aan groupAndClassify.execute()
```

## Geen UI-wijzigingen

De `ClassifiedBlock`s die uit de LLM komen verschijnen automatisch in de bestaande tijdlijn als concept-blokken (origin: `'llm'`). Caching werkt ook automatisch via `urlPattern = github.com/...`.

## Tests

- `groupCommitsIntoBlocks([])` → `[]`
- Commits in één sessie → 1 block
- Commits met gap > 45 min → 2 blocks
- `firstVisitTime` / `lastVisitTime` correct berekend
- `hours` minimaal 0.5, afgerond op 0.5
- Max 10 titles
