# Copilot Model Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings UI to dynamically select which GitHub Copilot model is used for AI classification, with the selection persisted to a JSON file in the app data folder.

**Architecture:** New `ISettingsRepository` + `TauriSettingsRepository` (using Tauri's `plugin-fs` + `appDataDir`, matching the `StarredProjectsStore` pattern). `ICopilotRepository` gets a new `listModels()` method. Three new use cases wire domain to infra. Zustand store gets `selectedCopilotModel`. Settings UI gains an "AI Model" section at the top of `AccountSettings`.

**Tech Stack:** TypeScript strict, React 19, Zustand 5, Tauri 2 / `@tauri-apps/plugin-fs`, `@tauri-apps/api/path`, Vitest

---

## File Map

| File | Action |
|---|---|
| `src/domain/entities/CopilotModel.ts` | Create |
| `src/domain/repositories/ISettingsRepository.ts` | Create |
| `src/domain/repositories/ICopilotRepository.ts` | Modify — add `listModels()`, add `model?` param to `classify` + `classifyDay` |
| `src/domain/usecases/GetCopilotModelsUseCase.ts` | Create |
| `src/domain/usecases/GetSelectedModelUseCase.ts` | Create |
| `src/domain/usecases/SetSelectedModelUseCase.ts` | Create |
| `src/infrastructure/storage/TauriSettingsRepository.ts` | Create |
| `src/infrastructure/storage/TauriSettingsRepository.test.ts` | Create |
| `src/infrastructure/copilot/CopilotRepository.ts` | Modify — add `listModels()`, pass `model` param |
| `src/application/container.ts` | Modify — add factory + use case wiring |
| `src/store/appStore.ts` | Modify — add `selectedCopilotModel` |
| `src/ui/hooks/useCopilotModels.ts` | Create |
| `src/ui/pages/Settings/AccountSettings.tsx` | Modify — add AI Model section at top |
| `src/App.tsx` | Modify — load selected model on startup |

---

## Task 1: Domain entity `CopilotModel`

**Files:**
- Create: `src/domain/entities/CopilotModel.ts`

- [ ] **Step 1: Write the file**

```ts
// src/domain/entities/CopilotModel.ts
export type CopilotModel = {
  id: string              // e.g. "gpt-4o"
  name: string            // display name
  tokenMultiplier: number // relative token cost — defaults to 1.0 if not present in API response
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/entities/CopilotModel.ts
git commit -m "feat: add CopilotModel domain entity"
```

---

## Task 2: Domain interface `ISettingsRepository`

**Files:**
- Create: `src/domain/repositories/ISettingsRepository.ts`

- [ ] **Step 1: Write the file**

```ts
// src/domain/repositories/ISettingsRepository.ts
export interface ISettingsRepository {
  getSelectedModel(): Promise<string | null>
  setSelectedModel(modelId: string): Promise<void>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/repositories/ISettingsRepository.ts
git commit -m "feat: add ISettingsRepository domain interface"
```

---

## Task 3: Extend `ICopilotRepository`

**Files:**
- Modify: `src/domain/repositories/ICopilotRepository.ts`

- [ ] **Step 1: Add import and `listModels()` to the interface**

Add at the top of the file:
```ts
import type { CopilotModel } from '../entities/CopilotModel'
```

Add `listModels()` to the `ICopilotRepository` interface, and add optional `model?` parameter to `classify` and `classifyDay`:

```ts
export interface ICopilotRepository {
  classify(
    blocks: HistoryBlock[],
    availableProjects: Project[],
    availableServices: Service[],
    calendarEvents?: CalendarEvent[],
    model?: string,
  ): Promise<ClassifiedBlock[]>

  classifyDay(
    date: string,
    items: DayItem[],
    availableProjects: Project[],
    availableServices: Service[],
    cacheHints: Record<string, { projectName: string; serviceName: string }>,
    context?: DayContext,
    historicalEntries?: HourEntry[],
    model?: string,
  ): Promise<DayClassificationResult[]>

  listModels(): Promise<CopilotModel[]>
}
```

- [ ] **Step 2: Run typecheck to verify no errors**

```bash
npm run typecheck
```

Expected: 0 errors (CopilotRepository doesn't implement `listModels` yet — that's fine, TypeScript only checks concrete classes when they claim to implement the interface)

- [ ] **Step 3: Commit**

```bash
git add src/domain/repositories/ICopilotRepository.ts
git commit -m "feat: extend ICopilotRepository with listModels and model param"
```

---

## Task 4: Three use cases

**Files:**
- Create: `src/domain/usecases/GetCopilotModelsUseCase.ts`
- Create: `src/domain/usecases/GetSelectedModelUseCase.ts`
- Create: `src/domain/usecases/SetSelectedModelUseCase.ts`

- [ ] **Step 1: Write `GetCopilotModelsUseCase`**

```ts
// src/domain/usecases/GetCopilotModelsUseCase.ts
import type { CopilotModel } from '../entities/CopilotModel'
import type { ICopilotRepository } from '../repositories/ICopilotRepository'

export class GetCopilotModelsUseCase {
  constructor(private readonly copilotRepo: ICopilotRepository) {}

  async execute(): Promise<CopilotModel[]> {
    return this.copilotRepo.listModels()
  }
}
```

- [ ] **Step 2: Write `GetSelectedModelUseCase`**

```ts
// src/domain/usecases/GetSelectedModelUseCase.ts
import type { ISettingsRepository } from '../repositories/ISettingsRepository'

const DEFAULT_MODEL = 'gpt-4o'

export class GetSelectedModelUseCase {
  constructor(private readonly settingsRepo: ISettingsRepository) {}

  async execute(): Promise<string> {
    const stored = await this.settingsRepo.getSelectedModel()
    return stored ?? DEFAULT_MODEL
  }
}
```

- [ ] **Step 3: Write `SetSelectedModelUseCase`**

```ts
// src/domain/usecases/SetSelectedModelUseCase.ts
import type { ISettingsRepository } from '../repositories/ISettingsRepository'

export class SetSelectedModelUseCase {
  constructor(private readonly settingsRepo: ISettingsRepository) {}

  async execute(modelId: string): Promise<void> {
    await this.settingsRepo.setSelectedModel(modelId)
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/usecases/GetCopilotModelsUseCase.ts src/domain/usecases/GetSelectedModelUseCase.ts src/domain/usecases/SetSelectedModelUseCase.ts
git commit -m "feat: add GetCopilotModels, GetSelectedModel, SetSelectedModel use cases"
```

---

## Task 5: `TauriSettingsRepository` — tests first

**Files:**
- Create: `src/infrastructure/storage/TauriSettingsRepository.test.ts`
- Create: `src/infrastructure/storage/TauriSettingsRepository.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/infrastructure/storage/TauriSettingsRepository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
}))

import { TauriSettingsRepository } from './TauriSettingsRepository'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = readTextFile as ReturnType<typeof vi.fn>
const mockWrite = writeTextFile as ReturnType<typeof vi.fn>

describe('TauriSettingsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWrite.mockResolvedValue(undefined)
  })

  it('returns null when file does not exist', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const repo = new TauriSettingsRepository()
    expect(await repo.getSelectedModel()).toBeNull()
  })

  it('returns null when file has no copilot_model key', async () => {
    mockRead.mockResolvedValue(JSON.stringify({}))
    const repo = new TauriSettingsRepository()
    expect(await repo.getSelectedModel()).toBeNull()
  })

  it('returns stored model id', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ copilot_model: 'claude-sonnet' }))
    const repo = new TauriSettingsRepository()
    expect(await repo.getSelectedModel()).toBe('claude-sonnet')
  })

  it('writes model id to file', async () => {
    mockRead.mockRejectedValue(new Error('not found'))
    const repo = new TauriSettingsRepository()
    await repo.setSelectedModel('gpt-4o')
    expect(mockWrite).toHaveBeenCalledOnce()
    const written = JSON.parse(mockWrite.mock.calls[0]![1] as string) as unknown
    expect(written).toEqual({ copilot_model: 'gpt-4o' })
  })

  it('merges with existing data when writing', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ other_key: 'value' }))
    const repo = new TauriSettingsRepository()
    await repo.setSelectedModel('gpt-4o')
    const written = JSON.parse(mockWrite.mock.calls[0]![1] as string) as unknown
    expect(written).toEqual({ other_key: 'value', copilot_model: 'gpt-4o' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- TauriSettingsRepository
```

Expected: FAIL — `TauriSettingsRepository` module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/infrastructure/storage/TauriSettingsRepository.ts
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { ISettingsRepository } from '../../domain/repositories/ISettingsRepository'

const FILENAME = 'settings.json'

export class TauriSettingsRepository implements ISettingsRepository {
  private cachedPath: string | undefined

  private async filePath(): Promise<string> {
    if (!this.cachedPath) {
      const dir = await appDataDir()
      this.cachedPath = `${dir}/${FILENAME}`
    }
    return this.cachedPath
  }

  private async readAll(): Promise<Record<string, unknown>> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      return {}
    } catch {
      return {}
    }
  }

  private async writeAll(data: Record<string, unknown>): Promise<void> {
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(data))
  }

  async getSelectedModel(): Promise<string | null> {
    const data = await this.readAll()
    const val = data['copilot_model']
    return typeof val === 'string' ? val : null
  }

  async setSelectedModel(modelId: string): Promise<void> {
    const data = await this.readAll()
    data['copilot_model'] = modelId
    await this.writeAll(data)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- TauriSettingsRepository
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/storage/TauriSettingsRepository.ts src/infrastructure/storage/TauriSettingsRepository.test.ts
git commit -m "feat: add TauriSettingsRepository with tests"
```

---

## Task 6: Extend `CopilotRepository` with `listModels()` and `model` param

**Files:**
- Modify: `src/infrastructure/copilot/CopilotRepository.ts`

- [ ] **Step 1: Add `CopilotModel` import at the top of the file**

After the existing imports, add:
```ts
import type { CopilotModel } from '../../domain/entities/CopilotModel'
```

- [ ] **Step 2: Add interface for models API response**

After the existing `CopilotResponse` interface (around line 16), add:
```ts
interface CopilotModelsResponse {
  data: Array<{
    id: string
    name?: string
    capabilities?: {
      tokenizer?: string
      limits?: {
        max_prompt_tokens?: number
      }
    }
    policy?: {
      premium_model_multiplier?: number
    }
  }>
}
```

- [ ] **Step 3: Add `listModels()` method**

Add this method to the `CopilotRepository` class (before `classify`):
```ts
async listModels(): Promise<CopilotModel[]> {
  const responseText = await invoke<string>('copilot_request', {
    args: {
      token: this.copilotToken,
      endpoint: 'https://api.githubcopilot.com/models',
      method: 'GET',
      body: null,
    },
  })

  const data = JSON.parse(responseText) as CopilotModelsResponse
  return (data.data ?? []).map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    tokenMultiplier: m.policy?.premium_model_multiplier ?? 1.0,
  }))
}
```

> **Note:** Check the Tauri `copilot_request` command signature in `src-tauri/src/` to confirm the exact argument names for a GET request without a body. Adjust the invoke args if needed.

- [ ] **Step 4: Update `classify()` signature to accept optional `model` param**

Find the `classify(` method signature and add `model = 'gpt-4o'` as last parameter:
```ts
async classify(
  blocks: HistoryBlock[],
  availableProjects: Project[],
  availableServices: Service[],
  calendarEvents: CalendarEvent[] = [],
  model = 'gpt-4o',
): Promise<ClassifiedBlock[]> {
```

Replace the hardcoded `model: 'gpt-4o'` inside `classify` (around line 174):
```ts
body: JSON.stringify({
  model,
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.1,
}),
```

- [ ] **Step 5: Update `classifyDay()` signature to accept optional `model` param**

Find the `classifyDay(` method signature and add `model = 'gpt-4o'` as last parameter:
```ts
async classifyDay(
  date: string,
  items: DayItem[],
  availableProjects: Project[],
  availableServices: Service[],
  cacheHints: Record<string, { projectName: string; serviceName: string }>,
  context?: DayContext,
  historicalEntries?: HourEntry[],
  model = 'gpt-4o',
): Promise<DayClassificationResult[]> {
```

Replace the hardcoded `model: 'gpt-4o'` inside `classifyDay` (around line 358):
```ts
body: JSON.stringify({
  model,
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.1,
}),
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/copilot/CopilotRepository.ts
git commit -m "feat: add listModels and model param to CopilotRepository"
```

---

## Task 7: Wire up `container.ts`

**Files:**
- Modify: `src/application/container.ts`

- [ ] **Step 1: Add imports**

Add to the imports at the top:
```ts
import { TauriSettingsRepository } from '../infrastructure/storage/TauriSettingsRepository'
import { GetCopilotModelsUseCase } from '../domain/usecases/GetCopilotModelsUseCase'
import { GetSelectedModelUseCase } from '../domain/usecases/GetSelectedModelUseCase'
import { SetSelectedModelUseCase } from '../domain/usecases/SetSelectedModelUseCase'
```

- [ ] **Step 2: Export singleton and factories**

After `export const starredProjectsStore = new StarredProjectsStore()`, add:
```ts
export const settingsRepo = new TauriSettingsRepository()

export function createGetCopilotModelsUseCase(copilotRepo: ICopilotRepository): GetCopilotModelsUseCase {
  return new GetCopilotModelsUseCase(copilotRepo)
}

export function createGetSelectedModelUseCase(): GetSelectedModelUseCase {
  return new GetSelectedModelUseCase(settingsRepo)
}

export function createSetSelectedModelUseCase(): SetSelectedModelUseCase {
  return new SetSelectedModelUseCase(settingsRepo)
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/application/container.ts
git commit -m "feat: wire settings repository and model use cases in container"
```

---

## Task 8: Extend Zustand store

**Files:**
- Modify: `src/store/appStore.ts`

- [ ] **Step 1: Add `selectedCopilotModel` to the store**

In the `AppState` interface, add after `copilotToken`:
```ts
selectedCopilotModel: string
setSelectedCopilotModel: (model: string) => void
```

In `initialState`, add:
```ts
selectedCopilotModel: 'gpt-4o',
```

In the `create` call, add:
```ts
setSelectedCopilotModel: (selectedCopilotModel) => set({ selectedCopilotModel }),
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/store/appStore.ts
git commit -m "feat: add selectedCopilotModel to Zustand store"
```

---

## Task 9: Load selected model on app startup

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Find the startup initialization logic in `App.tsx`**

Look for the `useEffect` that loads tokens from Keychain (via `keychainRepo.get`). This is where we add model loading.

- [ ] **Step 2: Add model loading to startup**

Import at the top of `App.tsx`:
```ts
import { createGetSelectedModelUseCase } from './application/container'
import { useAppStore } from './store/appStore'
```

Inside the startup `useEffect` (after loading tokens), add:
```ts
const setSelectedCopilotModel = useAppStore.getState().setSelectedCopilotModel
const selectedModel = await createGetSelectedModelUseCase().execute()
setSelectedCopilotModel(selectedModel)
```

- [ ] **Step 3: Pass `selectedCopilotModel` to classification calls**

Find where `copilotRepo.classify()` and `copilotRepo.classifyDay()` are called in the app (search for `classifyDay` and `classify` usages). Pass the store value as the last argument:

```ts
const model = useAppStore.getState().selectedCopilotModel
// then pass `model` as the last argument to classify() / classifyDay()
```

> Exact locations may be in `ProcessWeekUseCase`, `ProcessDayUseCase`, or hooks — check call sites with grep and update accordingly.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: load selected copilot model on app startup"
```

---

## Task 10: `useCopilotModels` hook

**Files:**
- Create: `src/ui/hooks/useCopilotModels.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/ui/hooks/useCopilotModels.ts
import { useState, useEffect } from 'react'
import type { CopilotModel } from '../../domain/entities/CopilotModel'
import { createCopilotRepository, createGetCopilotModelsUseCase } from '../../application/container'
import { useAppStore } from '../../store/appStore'

export function useCopilotModels(): { models: CopilotModel[]; loading: boolean; error: string | null } {
  const copilotToken = useAppStore((s) => s.copilotToken)
  const [models, setModels] = useState<CopilotModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!copilotToken) {
      setError('Geen Copilot token ingesteld')
      return
    }

    setLoading(true)
    setError(null)

    const copilotRepo = createCopilotRepository(copilotToken)
    const useCase = createGetCopilotModelsUseCase(copilotRepo)

    useCase
      .execute()
      .then((result) => {
        setModels(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Ophalen modellen mislukt')
        setLoading(false)
      })
  }, [copilotToken])

  return { models, loading, error }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useCopilotModels.ts
git commit -m "feat: add useCopilotModels hook"
```

---

## Task 11: Settings UI — AI Model section

**Files:**
- Modify: `src/ui/pages/Settings/AccountSettings.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `AccountSettings.tsx`:
```ts
import { useCopilotModels } from '../../hooks/useCopilotModels'
import { createSetSelectedModelUseCase } from '../../../application/container'
```

- [ ] **Step 2: Add store selector and hook call**

Inside the `AccountSettings` component, add:
```ts
const selectedCopilotModel = useAppStore((s) => s.selectedCopilotModel)
const setSelectedCopilotModel = useAppStore((s) => s.setSelectedCopilotModel)
const { models, loading: modelsLoading, error: modelsError } = useCopilotModels()
```

- [ ] **Step 3: Add change handler**

```ts
async function handleModelChange(modelId: string) {
  setSelectedCopilotModel(modelId)
  await createSetSelectedModelUseCase().execute(modelId)
}
```

- [ ] **Step 4: Add UI section at the top of the returned JSX**

Insert this section as the **first child** inside the component's root element (before the Simplicate API section):

```tsx
{/* AI Model */}
<section>
  <h2 className="text-sm font-semibold text-gray-700 mb-2">AI Model</h2>
  {modelsLoading && (
    <p className="text-xs text-gray-400">Modellen ophalen...</p>
  )}
  {modelsError && !modelsLoading && (
    <p className="text-xs text-red-500">{modelsError}</p>
  )}
  {!modelsLoading && !modelsError && models.length > 0 && (
    <select
      value={selectedCopilotModel}
      onChange={(e) => { void handleModelChange(e.target.value) }}
      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} — {m.tokenMultiplier}×
        </option>
      ))}
    </select>
  )}
  {!modelsLoading && !modelsError && models.length === 0 && (
    <p className="text-xs text-gray-400">Geen modellen beschikbaar</p>
  )}
  {!modelsLoading && models.length > 0 && !models.find((m) => m.id === selectedCopilotModel) && (
    <p className="text-xs text-yellow-600 mt-1">
      Huidig model ({selectedCopilotModel}) staat niet in de lijst — mogelijk verouderd.
    </p>
  )}
</section>
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/pages/Settings/AccountSettings.tsx
git commit -m "feat: add AI Model section to Settings"
```

---

## Task 12: Verify Tauri command signature for GET requests

**Files:**
- Read: `src-tauri/src/` (check `copilot_request` command)

- [ ] **Step 1: Check the Tauri command**

```bash
grep -r "copilot_request" src-tauri/src/
```

- [ ] **Step 2: If the command only supports POST with a body**

The `listModels()` endpoint is a GET request. If the Rust command doesn't support GET, add a separate Tauri command `copilot_get` or extend the existing one to accept an optional method + body. Update `CopilotRepository.listModels()` to use whichever command is appropriate.

- [ ] **Step 3: Run full typecheck and tests**

```bash
npm run typecheck && npm run test
```

Expected: 0 type errors, all tests pass

- [ ] **Step 4: Commit any Tauri changes**

```bash
git add src-tauri/
git commit -m "feat: extend copilot_request Tauri command to support GET"
```

(Skip this step if no changes were needed)

---

## Task 13: Final verification

- [ ] **Step 1: Run all checks**

```bash
npm run typecheck && npm run lint && npm run test
```

Expected: 0 errors, 0 warnings, all tests pass

- [ ] **Step 2: Start the dev app and manually verify**

```bash
make run
```

- Open Settings
- Confirm "AI Model" section appears at the top
- Confirm models load from the Copilot API with multiplier labels
- Select a different model
- Restart the app
- Confirm the selected model is remembered

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: post-integration fixes for model selection"
```
