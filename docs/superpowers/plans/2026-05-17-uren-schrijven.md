# Uren Schrijven Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS desktop app (Tauri 2.0 + React/TypeScript) that lets users book recurring hours to Simplicate via configurable templates with one click.

**Architecture:** Clean architecture with four layers (Domain → Application → Infrastructure → UI). Dependencies only point inward. Use cases are injected with repository interfaces; concrete implementations live in the infrastructure layer. Zustand holds UI state only.

**Tech Stack:** Tauri 2.0, React 18, TypeScript (strict), Tailwind CSS, Zustand, Vitest, Playwright, ESLint, Prettier, Vite.

---

## File Map

```
src/
  domain/
    entities/
      Template.ts              # Template types + discriminated union
      HourEntry.ts             # Value object for a Simplicate hour entry
      User.ts                  # Authenticated user entity
    repositories/
      ITemplateRepository.ts   # Interface: CRUD for templates
      ISimplicateRepository.ts # Interface: projects, services, hour types, book
      IKeychainRepository.ts   # Interface: read/write secrets
    usecases/
      BookTemplateUseCase.ts   # Resolves missing fields, builds HourEntry[], POSTs
      SaveTemplateUseCase.ts   # Validates + persists a template
      DeleteTemplateUseCase.ts # Removes a template by id
      FetchSimplicateDataUseCase.ts # Loads projects/services/hourTypes into store
  infrastructure/
    simplicate/
      SimplicateRepository.ts  # Implements ISimplicateRepository via fetch
      simplicate.types.ts      # Raw Simplicate API response types
    storage/
      TemplateStorageRepository.ts # Implements ITemplateRepository via Tauri fs
    keychain/
      KeychainRepository.ts    # Implements IKeychainRepository via Tauri keyring
  application/
    container.ts               # DI: wires interfaces to implementations
  store/
    appStore.ts                # Zustand: simplicateData, templates, authState
  ui/
    pages/
      LoginPage.tsx            # Google OAuth login screen
      Home.tsx                 # Template grid
      BookingModal.tsx         # Booking flow modal
      Settings/
        SettingsPage.tsx       # Tab container
        TemplateForm.tsx       # Create/edit template form
        AccountSettings.tsx    # API key + logout
    components/
      TemplateCard.tsx         # Single template card
      FieldSelector.tsx        # Reusable project/service/hourType dropdown
      DayPicker.tsx            # Day-of-week toggle buttons
    hooks/
      useTemplates.ts          # CRUD templates via use cases
      useBooking.ts            # Booking flow state machine
      useSimplicateData.ts     # Access cached Simplicate data from store
  main.tsx

src-tauri/
  src/
    main.rs
    lib.rs
    commands/
      auth.rs                  # Google OAuth PKCE: open browser, handle callback
      keychain.rs              # Tauri commands: get_secret, set_secret, delete_secret

AGENTS.md
.gitignore
.env.example
tests/
  unit/
  e2e/
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `src-tauri/tauri.conf.json` (via scaffold)
- Create: `AGENTS.md`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/main.tsx`

- [ ] **Step 1: Scaffold Tauri 2.0 project**

```bash
npm create tauri-app@latest uren-schrijven -- --template react-ts
cd uren-schrijven
npm install
```

Expected: project boots with `npm run tauri dev` showing default Tauri window.

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install zustand @tanstack/react-query
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Install Tauri plugins**

```bash
npm run tauri add keyring
```

In `src-tauri/Cargo.toml`, verify `tauri-plugin-keyring` is present.

- [ ] **Step 4: Configure Tailwind**

Replace `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Add to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Configure TypeScript strict mode**

In `tsconfig.json`, ensure:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

- [ ] **Step 6: Configure Vitest**

In `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
dist/
.env
*.pem
src-tauri/gen/
src-tauri/target/
.superpowers/
```

- [ ] **Step 8: Create `.env.example`**

```
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
VITE_SIMPLICATE_BASE_URL=https://your-organisation.simplicate.nl/api/v2
```

- [ ] **Step 9: Create `AGENTS.md`**

```markdown
# AGENTS.md — Architecture & Development Rules

This file is the source of truth for all developers and AI agents working on this codebase.
Read it fully before making any changes.

---

## Architecture

This app uses Clean Architecture with four strict layers. Dependencies ONLY point inward:

```
UI Layer (React)
  → Application Layer (use cases)
    → Domain Layer (entities, interfaces)
      ← Infrastructure Layer (implements interfaces)
```

### Layer rules

| Layer | Location | Allowed dependencies |
|---|---|---|
| Domain | `src/domain/` | None — zero external imports |
| Application | `src/application/`, `src/domain/usecases/` | Domain only |
| Infrastructure | `src/infrastructure/` | Domain interfaces, Tauri IPC, fetch |
| UI | `src/ui/`, `src/store/` | Application use cases, domain types, Zustand |

**Never:**
- Import infrastructure from UI directly
- Put business logic in React components or hooks
- Call `fetch` outside of `SimplicateRepository`
- Store secrets in files, localStorage, or Zustand

---

## Adding a New Feature

1. Define/extend types in `src/domain/entities/`
2. Add interface methods to the relevant `src/domain/repositories/I*.ts`
3. Write a use case in `src/domain/usecases/`
4. Implement repository changes in `src/infrastructure/`
5. Wire up in `src/application/container.ts`
6. Add a hook in `src/ui/hooks/`
7. Build UI components — keep them dumb (props in, callbacks out)
8. Write unit tests for use cases first (TDD)

---

## Adding a New Template Type

1. Add the discriminant to `TemplateType` in `src/domain/entities/Template.ts`
2. Add the interface extending `BaseTemplate`
3. Add a handler in `BookTemplateUseCase.ts` for the new type
4. Add UI for it in `TemplateForm.tsx` and `TemplateCard.tsx`
5. Do NOT modify existing type handlers

---

## Secrets & Security

- **Never** hardcode credentials, API keys, or tokens
- **Never** store secrets in Zustand, localStorage, or any file
- All secrets go through `KeychainRepository` → macOS Keychain
- `VITE_GOOGLE_CLIENT_ID` is a build-time env var (not a secret, but not hardcoded)
- `.env` is gitignored — use `.env.example` for documentation

---

## Code Style

- TypeScript strict mode — no `any`, use `unknown` and narrow
- Files > ~200 lines are doing too much — split them
- One export per file (default export = the thing the file is named after)
- Imports ordered: external packages → domain → infrastructure → UI
- No business logic in `.tsx` files

---

## Testing

```bash
npm run test          # unit tests (Vitest)
npm run test:e2e      # e2e tests (Playwright)
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
```

- Write tests before implementation (TDD)
- Unit test every use case
- Mock Tauri IPC in unit tests via `vi.mock`
- Do not test React component internals — test behavior

---

## Running the App

```bash
npm run tauri dev     # development
npm run tauri build   # production build
```

---

## Common Pitfalls

- `serviceId` options depend on `projectId` — always filter services by the selected project
- Tauri commands are async — always `await` them
- The Simplicate API uses `Authentication` header (not `Authorization`)
- Templates with missing fields are valid — the booking modal handles them at runtime
```

- [ ] **Step 10: Verify app runs**

```bash
npm run tauri dev
```

Expected: Tauri window opens with default React content. No TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Tauri 2.0 + React/TypeScript project"
```

---

## Task 2: Domain Layer — Entities & Interfaces

**Files:**
- Create: `src/domain/entities/Template.ts`
- Create: `src/domain/entities/HourEntry.ts`
- Create: `src/domain/entities/User.ts`
- Create: `src/domain/repositories/ITemplateRepository.ts`
- Create: `src/domain/repositories/ISimplicateRepository.ts`
- Create: `src/domain/repositories/IKeychainRepository.ts`
- Test: `tests/unit/domain/Template.test.ts`

- [ ] **Step 1: Write failing test for Template entity**

Create `tests/unit/domain/Template.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  isRecurringTemplate,
  isSingleTemplate,
  isWeeklyBlockTemplate,
  type RecurringTemplate,
  type SingleTemplate,
  type WeeklyBlockTemplate,
} from '../../../src/domain/entities/Template'

describe('Template type guards', () => {
  it('identifies recurring templates', () => {
    const t: RecurringTemplate = {
      id: '1', name: 'Standup', type: 'recurring', color: '#6c63ff',
      startTime: '09:00', endTime: '09:30', days: ['mon', 'tue'],
    }
    expect(isRecurringTemplate(t)).toBe(true)
    expect(isSingleTemplate(t)).toBe(false)
  })

  it('identifies single templates', () => {
    const t: SingleTemplate = {
      id: '2', name: 'Code review', type: 'single', color: '#63ffb4',
      startTime: '10:00', endTime: '11:00',
    }
    expect(isSingleTemplate(t)).toBe(true)
    expect(isWeeklyBlockTemplate(t)).toBe(false)
  })

  it('identifies weekly-block templates', () => {
    const t: WeeklyBlockTemplate = {
      id: '3', name: 'Sprint planning', type: 'weekly-block', color: '#63c5ff',
      startTime: '10:00', endTime: '11:00', day: 'mon',
    }
    expect(isWeeklyBlockTemplate(t)).toBe(true)
    expect(isRecurringTemplate(t)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test tests/unit/domain/Template.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/domain/entities/Template.ts`**

```ts
export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type TemplateType = 'recurring' | 'single' | 'weekly-block'

export interface BaseTemplate {
  id: string
  name: string
  type: TemplateType
  color: string
  projectId?: string
  serviceId?: string
  hourTypeId?: string
  defaultNote?: string
  startTime: string // HH:mm
  endTime: string   // HH:mm
}

export interface RecurringTemplate extends BaseTemplate {
  type: 'recurring'
  days: Day[]
}

export interface SingleTemplate extends BaseTemplate {
  type: 'single'
}

export interface WeeklyBlockTemplate extends BaseTemplate {
  type: 'weekly-block'
  day: Day
}

export type Template = RecurringTemplate | SingleTemplate | WeeklyBlockTemplate

export function isRecurringTemplate(t: Template): t is RecurringTemplate {
  return t.type === 'recurring'
}

export function isSingleTemplate(t: Template): t is SingleTemplate {
  return t.type === 'single'
}

export function isWeeklyBlockTemplate(t: Template): t is WeeklyBlockTemplate {
  return t.type === 'weekly-block'
}
```

- [ ] **Step 4: Create `src/domain/entities/HourEntry.ts`**

```ts
export interface HourEntry {
  employeeId: string
  projectServiceId: string
  hourTypeId: string
  hours: number        // decimal, e.g. 0.5
  startDate: string   // YYYY-MM-DD
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  note: string
}
```

- [ ] **Step 5: Create `src/domain/entities/User.ts`**

```ts
export interface User {
  id: string              // Simplicate employee id
  name: string
  email: string
  googleId: string
}
```

- [ ] **Step 6: Create `src/domain/repositories/ITemplateRepository.ts`**

```ts
import type { Template } from '../entities/Template'

export interface ITemplateRepository {
  getAll(): Promise<Template[]>
  save(template: Template): Promise<void>
  delete(id: string): Promise<void>
}
```

- [ ] **Step 7: Create `src/domain/repositories/ISimplicateRepository.ts`**

```ts
import type { HourEntry } from '../entities/HourEntry'

export interface SimplicateProject {
  id: string
  name: string
  organizationName: string
}

export interface SimplicateService {
  id: string
  name: string
  projectId: string
}

export interface SimplicateHourType {
  id: string
  label: string
}

export interface SimplicateEmployee {
  id: string
  name: string
  email: string
}

export interface ISimplicateRepository {
  getProjects(): Promise<SimplicateProject[]>
  getServices(projectId: string): Promise<SimplicateService[]>
  getHourTypes(): Promise<SimplicateHourType[]>
  getEmployee(email: string): Promise<SimplicateEmployee>
  bookHours(entries: HourEntry[]): Promise<void>
}
```

- [ ] **Step 8: Create `src/domain/repositories/IKeychainRepository.ts`**

```ts
export interface IKeychainRepository {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}
```

- [ ] **Step 9: Run tests — verify they pass**

```bash
npm run test tests/unit/domain/Template.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 10: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/domain tests/unit/domain
git commit -m "feat: add domain layer — entities and repository interfaces"
```

---

## Task 3: Rust Backend — Keychain Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/commands/keychain.rs`

- [ ] **Step 1: Create `src-tauri/src/commands/keychain.rs`**

```rust
use tauri_plugin_keyring::KeyringExt;

#[tauri::command]
pub async fn get_secret(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let keyring = app.keyring();
    match keyring.get_password("uren-schrijven", &key) {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn set_secret(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let keyring = app.keyring();
    keyring
        .set_password("uren-schrijven", &key, &value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_secret(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let keyring = app.keyring();
    match keyring.delete_password("uren-schrijven", &key) {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
```

- [ ] **Step 2: Register commands in `src-tauri/src/lib.rs`**

```rust
mod commands;

use commands::keychain::{delete_secret, get_secret, set_secret};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_keyring::init())
        .invoke_handler(tauri::generate_handler![get_secret, set_secret, delete_secret])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Build to verify Rust compiles**

```bash
npm run tauri build -- --debug 2>&1 | tail -20
```

Expected: build succeeds, no Rust errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/
git commit -m "feat: add Rust keychain commands (get/set/delete)"
```

---

## Task 4: Infrastructure Layer — KeychainRepository

**Files:**
- Create: `src/infrastructure/keychain/KeychainRepository.ts`
- Test: `tests/unit/infrastructure/KeychainRepository.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/infrastructure/KeychainRepository.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeychainRepository } from '../../../src/infrastructure/keychain/KeychainRepository'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'

const mockInvoke = vi.mocked(invoke)

describe('KeychainRepository', () => {
  let repo: KeychainRepository

  beforeEach(() => {
    repo = new KeychainRepository()
    vi.clearAllMocks()
  })

  it('returns null when secret does not exist', async () => {
    mockInvoke.mockResolvedValueOnce(null)
    const result = await repo.get('missing-key')
    expect(result).toBeNull()
    expect(mockInvoke).toHaveBeenCalledWith('get_secret', { key: 'missing-key' })
  })

  it('returns value when secret exists', async () => {
    mockInvoke.mockResolvedValueOnce('my-api-key')
    const result = await repo.get('simplicate-api-key')
    expect(result).toBe('my-api-key')
  })

  it('calls set_secret on set', async () => {
    mockInvoke.mockResolvedValueOnce(undefined)
    await repo.set('simplicate-api-key', 'abc123')
    expect(mockInvoke).toHaveBeenCalledWith('set_secret', { key: 'simplicate-api-key', value: 'abc123' })
  })

  it('calls delete_secret on delete', async () => {
    mockInvoke.mockResolvedValueOnce(undefined)
    await repo.delete('simplicate-api-key')
    expect(mockInvoke).toHaveBeenCalledWith('delete_secret', { key: 'simplicate-api-key' })
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test tests/unit/infrastructure/KeychainRepository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/infrastructure/keychain/KeychainRepository.ts`**

```ts
import { invoke } from '@tauri-apps/api/core'
import type { IKeychainRepository } from '../../domain/repositories/IKeychainRepository'

export class KeychainRepository implements IKeychainRepository {
  async get(key: string): Promise<string | null> {
    return invoke<string | null>('get_secret', { key })
  }

  async set(key: string, value: string): Promise<void> {
    await invoke('set_secret', { key, value })
  }

  async delete(key: string): Promise<void> {
    await invoke('delete_secret', { key })
  }
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npm run test tests/unit/infrastructure/KeychainRepository.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/keychain tests/unit/infrastructure
git commit -m "feat: add KeychainRepository infrastructure"
```

---

## Task 5: Infrastructure Layer — TemplateStorageRepository

**Files:**
- Create: `src/infrastructure/storage/TemplateStorageRepository.ts`
- Test: `tests/unit/infrastructure/TemplateStorageRepository.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/infrastructure/TemplateStorageRepository.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TemplateStorageRepository } from '../../../src/infrastructure/storage/TemplateStorageRepository'
import type { SingleTemplate } from '../../../src/domain/entities/Template'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  BaseDirectory: { AppData: 'AppData' },
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app-data'),
}))

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const mockRead = vi.mocked(readTextFile)
const mockWrite = vi.mocked(writeTextFile)

const template: SingleTemplate = {
  id: 'abc-123',
  name: 'Code review',
  type: 'single',
  color: '#63ffb4',
  startTime: '10:00',
  endTime: '11:00',
}

describe('TemplateStorageRepository', () => {
  let repo: TemplateStorageRepository

  beforeEach(() => {
    repo = new TemplateStorageRepository()
    vi.clearAllMocks()
  })

  it('returns empty array when file does not exist', async () => {
    mockRead.mockRejectedValueOnce(new Error('file not found'))
    const result = await repo.getAll()
    expect(result).toEqual([])
  })

  it('returns parsed templates from file', async () => {
    mockRead.mockResolvedValueOnce(JSON.stringify([template]))
    const result = await repo.getAll()
    expect(result).toEqual([template])
  })

  it('saves template by appending to existing list', async () => {
    mockRead.mockResolvedValueOnce(JSON.stringify([]))
    mockWrite.mockResolvedValueOnce(undefined)
    await repo.save(template)
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('templates.json'),
      JSON.stringify([template], null, 2),
      expect.anything(),
    )
  })

  it('deletes template by id', async () => {
    mockRead.mockResolvedValueOnce(JSON.stringify([template]))
    mockWrite.mockResolvedValueOnce(undefined)
    await repo.delete('abc-123')
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('templates.json'),
      JSON.stringify([], null, 2),
      expect.anything(),
    )
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test tests/unit/infrastructure/TemplateStorageRepository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/infrastructure/storage/TemplateStorageRepository.ts`**

```ts
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import type { ITemplateRepository } from '../../domain/repositories/ITemplateRepository'
import type { Template } from '../../domain/entities/Template'

const FILENAME = 'templates.json'

export class TemplateStorageRepository implements ITemplateRepository {
  private async filePath(): Promise<string> {
    const dir = await appDataDir()
    return `${dir}/${FILENAME}`
  }

  async getAll(): Promise<Template[]> {
    try {
      const path = await this.filePath()
      const raw = await readTextFile(path)
      return JSON.parse(raw) as Template[]
    } catch {
      return []
    }
  }

  async save(template: Template): Promise<void> {
    const all = await this.getAll()
    const index = all.findIndex((t) => t.id === template.id)
    if (index >= 0) {
      all[index] = template
    } else {
      all.push(template)
    }
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(all, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAll()
    const filtered = all.filter((t) => t.id !== id)
    const path = await this.filePath()
    await writeTextFile(path, JSON.stringify(filtered, null, 2), {
      baseDir: BaseDirectory.AppData,
    })
  }
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npm run test tests/unit/infrastructure/TemplateStorageRepository.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/storage tests/unit/infrastructure
git commit -m "feat: add TemplateStorageRepository infrastructure"
```

---

## Task 6: Infrastructure Layer — SimplicateRepository

**Files:**
- Create: `src/infrastructure/simplicate/simplicate.types.ts`
- Create: `src/infrastructure/simplicate/SimplicateRepository.ts`
- Test: `tests/unit/infrastructure/SimplicateRepository.test.ts`

- [ ] **Step 1: Create `src/infrastructure/simplicate/simplicate.types.ts`**

```ts
export interface SimplicateProjectResponse {
  id: string
  name: string
  organization: { name: string }
}

export interface SimplicateServiceResponse {
  id: string
  name: string
  project: { id: string }
}

export interface SimplicateHourTypeResponse {
  id: string
  label: string
}

export interface SimplicateEmployeeResponse {
  id: string
  name: string
  work_email: string
}

export interface SimplicateApiListResponse<T> {
  data: T[]
}

export interface SimplicateApiSingleResponse<T> {
  data: T
}
```

- [ ] **Step 2: Write failing test**

Create `tests/unit/infrastructure/SimplicateRepository.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SimplicateRepository } from '../../../src/infrastructure/simplicate/SimplicateRepository'

const mockFetch = vi.fn()
global.fetch = mockFetch

const baseUrl = 'https://test.simplicate.nl/api/v2'
const apiKey = 'test-api-key'
const apiSecret = 'test-api-secret'

describe('SimplicateRepository', () => {
  let repo: SimplicateRepository

  beforeEach(() => {
    repo = new SimplicateRepository(baseUrl, apiKey, apiSecret)
    vi.clearAllMocks()
  })

  it('fetches projects and maps to domain type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'p1', name: 'Harborn', organization: { name: 'Harborn B.V.' } }],
      }),
    })
    const projects = await repo.getProjects()
    expect(projects).toEqual([{ id: 'p1', name: 'Harborn', organizationName: 'Harborn B.V.' }])
    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/projects/project`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authentication': `App ${apiKey}:${apiSecret}` }),
      }),
    )
  })

  it('fetches services filtered by projectId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 's1', name: 'Ceremonies', project: { id: 'p1' } }],
      }),
    })
    const services = await repo.getServices('p1')
    expect(services).toEqual([{ id: 's1', name: 'Ceremonies', projectId: 'p1' }])
    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/projects/service?project_id=p1`,
      expect.anything(),
    )
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    await expect(repo.getProjects()).rejects.toThrow('Simplicate API error: 401')
  })
})
```

- [ ] **Step 3: Run test — verify it fails**

```bash
npm run test tests/unit/infrastructure/SimplicateRepository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create `src/infrastructure/simplicate/SimplicateRepository.ts`**

```ts
import type {
  ISimplicateRepository,
  SimplicateEmployee,
  SimplicateHourType,
  SimplicateProject,
  SimplicateService,
} from '../../domain/repositories/ISimplicateRepository'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type {
  SimplicateApiListResponse,
  SimplicateEmployeeResponse,
  SimplicateHourTypeResponse,
  SimplicateProjectResponse,
  SimplicateServiceResponse,
} from './simplicate.types'

export class SimplicateRepository implements ISimplicateRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`
    const response = await fetch(url, {
      headers: {
        Authentication: `App ${this.apiKey}:${this.apiSecret}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(`Simplicate API error: ${response.status}`)
    }
    return response.json() as Promise<T>
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authentication: `App ${this.apiKey}:${this.apiSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Simplicate API error: ${response.status} — ${JSON.stringify(error)}`)
    }
    return response.json() as Promise<T>
  }

  async getProjects(): Promise<SimplicateProject[]> {
    const res = await this.get<SimplicateApiListResponse<SimplicateProjectResponse>>('/projects/project')
    return res.data.map((p) => ({
      id: p.id,
      name: p.name,
      organizationName: p.organization.name,
    }))
  }

  async getServices(projectId: string): Promise<SimplicateService[]> {
    const res = await this.get<SimplicateApiListResponse<SimplicateServiceResponse>>(
      `/projects/service?project_id=${projectId}`,
    )
    return res.data.map((s) => ({
      id: s.id,
      name: s.name,
      projectId: s.project.id,
    }))
  }

  async getHourTypes(): Promise<SimplicateHourType[]> {
    const res = await this.get<SimplicateApiListResponse<SimplicateHourTypeResponse>>('/hours/hourtypes')
    return res.data.map((h) => ({ id: h.id, label: h.label }))
  }

  async getEmployee(email: string): Promise<SimplicateEmployee> {
    const res = await this.get<SimplicateApiListResponse<SimplicateEmployeeResponse>>(
      `/hrm/employee?work_email=${encodeURIComponent(email)}`,
    )
    const employee = res.data[0]
    if (!employee) throw new Error(`Employee not found for email: ${email}`)
    return { id: employee.id, name: employee.name, email: employee.work_email }
  }

  async bookHours(entries: HourEntry[]): Promise<void> {
    await Promise.all(
      entries.map((entry) =>
        this.post('/hours/hours', {
          employee: { id: entry.employeeId },
          projectservice: { id: entry.projectServiceId },
          type: { id: entry.hourTypeId },
          hours: entry.hours,
          start_date: entry.startDate,
          start_time: entry.startTime,
          end_time: entry.endTime,
          note: entry.note,
        }),
      ),
    )
  }
}
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npm run test tests/unit/infrastructure/SimplicateRepository.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/simplicate tests/unit/infrastructure/SimplicateRepository.test.ts
git commit -m "feat: add SimplicateRepository infrastructure"
```

---

## Task 7: Application Layer — Use Cases

**Files:**
- Create: `src/application/container.ts`
- Create: `src/domain/usecases/SaveTemplateUseCase.ts`
- Create: `src/domain/usecases/DeleteTemplateUseCase.ts`
- Create: `src/domain/usecases/BookTemplateUseCase.ts`
- Create: `src/domain/usecases/FetchSimplicateDataUseCase.ts`
- Test: `tests/unit/usecases/BookTemplateUseCase.test.ts`
- Test: `tests/unit/usecases/SaveTemplateUseCase.test.ts`

- [ ] **Step 1: Write failing tests for SaveTemplateUseCase**

Create `tests/unit/usecases/SaveTemplateUseCase.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { SaveTemplateUseCase } from '../../../src/domain/usecases/SaveTemplateUseCase'
import type { ITemplateRepository } from '../../../src/domain/repositories/ITemplateRepository'
import type { SingleTemplate } from '../../../src/domain/entities/Template'

const mockRepo: ITemplateRepository = {
  getAll: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
}

const template: SingleTemplate = {
  id: 'abc', name: 'Review', type: 'single', color: '#fff',
  startTime: '10:00', endTime: '11:00',
}

describe('SaveTemplateUseCase', () => {
  it('saves a valid template', async () => {
    vi.mocked(mockRepo.save).mockResolvedValueOnce(undefined)
    const useCase = new SaveTemplateUseCase(mockRepo)
    await useCase.execute(template)
    expect(mockRepo.save).toHaveBeenCalledWith(template)
  })

  it('throws when name is empty', async () => {
    const useCase = new SaveTemplateUseCase(mockRepo)
    await expect(useCase.execute({ ...template, name: '' })).rejects.toThrow('Template name is required')
  })
})
```

- [ ] **Step 2: Write failing tests for BookTemplateUseCase**

Create `tests/unit/usecases/BookTemplateUseCase.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookTemplateUseCase } from '../../../src/domain/usecases/BookTemplateUseCase'
import type { ISimplicateRepository } from '../../../src/domain/repositories/ISimplicateRepository'
import type { RecurringTemplate } from '../../../src/domain/entities/Template'

const mockRepo: ISimplicateRepository = {
  getProjects: vi.fn(),
  getServices: vi.fn(),
  getHourTypes: vi.fn(),
  getEmployee: vi.fn(),
  bookHours: vi.fn(),
}

const recurringTemplate: RecurringTemplate = {
  id: '1', name: 'Standup', type: 'recurring', color: '#6c63ff',
  startTime: '09:00', endTime: '09:30',
  projectId: 'p1', serviceId: 's1', hourTypeId: 'h1',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
}

describe('BookTemplateUseCase', () => {
  let useCase: BookTemplateUseCase

  beforeEach(() => {
    useCase = new BookTemplateUseCase(mockRepo)
    vi.clearAllMocks()
    vi.mocked(mockRepo.bookHours).mockResolvedValue(undefined)
  })

  it('books 5 entries for a recurring template (full week)', async () => {
    await useCase.execute({
      template: recurringTemplate,
      employeeId: 'emp1',
      note: 'Standup',
      weekStartDate: '2026-05-18', // Monday
    })
    expect(mockRepo.bookHours).toHaveBeenCalledTimes(1)
    const entries = vi.mocked(mockRepo.bookHours).mock.calls[0]?.[0] ?? []
    expect(entries).toHaveLength(5)
    expect(entries[0]).toMatchObject({
      employeeId: 'emp1',
      projectServiceId: 's1',
      hourTypeId: 'h1',
      startDate: '2026-05-18',
      startTime: '09:00',
      endTime: '09:30',
      note: 'Standup',
    })
    expect(entries[4]).toMatchObject({ startDate: '2026-05-22' })
  })

  it('throws when required fields are missing', async () => {
    const incomplete = { ...recurringTemplate, projectId: undefined, serviceId: undefined }
    await expect(
      useCase.execute({ template: incomplete, employeeId: 'emp1', note: '', weekStartDate: '2026-05-18' }),
    ).rejects.toThrow('Missing required fields: projectId, serviceId')
  })
})
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npm run test tests/unit/usecases/
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Create `src/domain/usecases/SaveTemplateUseCase.ts`**

```ts
import type { ITemplateRepository } from '../repositories/ITemplateRepository'
import type { Template } from '../entities/Template'

export class SaveTemplateUseCase {
  constructor(private readonly templateRepo: ITemplateRepository) {}

  async execute(template: Template): Promise<void> {
    if (!template.name.trim()) {
      throw new Error('Template name is required')
    }
    await this.templateRepo.save(template)
  }
}
```

- [ ] **Step 5: Create `src/domain/usecases/DeleteTemplateUseCase.ts`**

```ts
import type { ITemplateRepository } from '../repositories/ITemplateRepository'

export class DeleteTemplateUseCase {
  constructor(private readonly templateRepo: ITemplateRepository) {}

  async execute(id: string): Promise<void> {
    await this.templateRepo.delete(id)
  }
}
```

- [ ] **Step 6: Create `src/domain/usecases/FetchSimplicateDataUseCase.ts`**

```ts
import type { ISimplicateRepository, SimplicateHourType, SimplicateProject, SimplicateService } from '../repositories/ISimplicateRepository'

export interface SimplicateData {
  projects: SimplicateProject[]
  services: SimplicateService[]
  hourTypes: SimplicateHourType[]
}

export class FetchSimplicateDataUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(): Promise<SimplicateData> {
    const [projects, hourTypes] = await Promise.all([
      this.simplicateRepo.getProjects(),
      this.simplicateRepo.getHourTypes(),
    ])
    // Services are fetched lazily per project to avoid N+1
    return { projects, services: [], hourTypes }
  }

  async fetchServicesForProject(projectId: string): Promise<SimplicateService[]> {
    return this.simplicateRepo.getServices(projectId)
  }
}
```

- [ ] **Step 7: Create `src/domain/usecases/BookTemplateUseCase.ts`**

```ts
import type { ISimplicateRepository } from '../repositories/ISimplicateRepository'
import type { Template } from '../entities/Template'
import type { HourEntry } from '../entities/HourEntry'
import { isRecurringTemplate, isSingleTemplate, isWeeklyBlockTemplate } from '../entities/Template'

const DAY_OFFSETS: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]!
}

function hoursFromTimes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return ((eh! * 60 + em!) - (sh! * 60 + sm!)) / 60
}

interface BookTemplateInput {
  template: Template
  employeeId: string
  note: string
  weekStartDate: string // YYYY-MM-DD, always a Monday
  overrides?: {
    projectId?: string
    serviceId?: string
    hourTypeId?: string
  }
}

export class BookTemplateUseCase {
  constructor(private readonly simplicateRepo: ISimplicateRepository) {}

  async execute(input: BookTemplateInput): Promise<void> {
    const { template, employeeId, note, weekStartDate, overrides = {} } = input

    const projectId = overrides.projectId ?? template.projectId
    const serviceId = overrides.serviceId ?? template.serviceId
    const hourTypeId = overrides.hourTypeId ?? template.hourTypeId

    const missing: string[] = []
    if (!projectId) missing.push('projectId')
    if (!serviceId) missing.push('serviceId')
    if (!hourTypeId) missing.push('hourTypeId')
    if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`)

    const baseEntry = {
      employeeId,
      projectServiceId: serviceId!,
      hourTypeId: hourTypeId!,
      hours: hoursFromTimes(template.startTime, template.endTime),
      startTime: template.startTime,
      endTime: template.endTime,
      note,
    }

    let entries: HourEntry[] = []

    if (isRecurringTemplate(template)) {
      entries = template.days.map((day) => ({
        ...baseEntry,
        startDate: addDays(weekStartDate, DAY_OFFSETS[day]!),
      }))
    } else if (isSingleTemplate(template)) {
      entries = [{ ...baseEntry, startDate: weekStartDate }]
    } else if (isWeeklyBlockTemplate(template)) {
      entries = [{ ...baseEntry, startDate: addDays(weekStartDate, DAY_OFFSETS[template.day]!) }]
    }

    await this.simplicateRepo.bookHours(entries)
  }
}
```

- [ ] **Step 8: Create `src/application/container.ts`**

```ts
import { KeychainRepository } from '../infrastructure/keychain/KeychainRepository'
import { SimplicateRepository } from '../infrastructure/simplicate/SimplicateRepository'
import { TemplateStorageRepository } from '../infrastructure/storage/TemplateStorageRepository'
import { BookTemplateUseCase } from '../domain/usecases/BookTemplateUseCase'
import { DeleteTemplateUseCase } from '../domain/usecases/DeleteTemplateUseCase'
import { FetchSimplicateDataUseCase } from '../domain/usecases/FetchSimplicateDataUseCase'
import { SaveTemplateUseCase } from '../domain/usecases/SaveTemplateUseCase'

// Repositories
export const keychainRepo = new KeychainRepository()
export const templateRepo = new TemplateStorageRepository()

// SimplicateRepository is created lazily after credentials are loaded
export function createSimplicateRepository(baseUrl: string, apiKey: string, apiSecret: string) {
  return new SimplicateRepository(baseUrl, apiKey, apiSecret)
}

// Use cases (stateless, created with injected repos)
export function createUseCases(simplicateRepo: SimplicateRepository) {
  return {
    saveTemplate: new SaveTemplateUseCase(templateRepo),
    deleteTemplate: new DeleteTemplateUseCase(templateRepo),
    bookTemplate: new BookTemplateUseCase(simplicateRepo),
    fetchSimplicateData: new FetchSimplicateDataUseCase(simplicateRepo),
  }
}
```

- [ ] **Step 9: Run all use case tests**

```bash
npm run test tests/unit/usecases/
```

Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/domain/usecases src/application
git commit -m "feat: add use cases and DI container"
```

---

## Task 8: Zustand Store & Auth State

**Files:**
- Create: `src/store/appStore.ts`
- Test: `tests/unit/store/appStore.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/store/appStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../../src/store/appStore'
import { act } from '@testing-library/react'

describe('appStore', () => {
  beforeEach(() => {
    act(() => useAppStore.setState(useAppStore.getInitialState()))
  })

  it('starts unauthenticated', () => {
    expect(useAppStore.getState().user).toBeNull()
  })

  it('setUser updates auth state', () => {
    act(() => {
      useAppStore.getState().setUser({ id: 'e1', name: 'Guus', email: 'guus@test.nl', googleId: 'g1' })
    })
    expect(useAppStore.getState().user?.email).toBe('guus@test.nl')
  })

  it('clearUser resets auth state', () => {
    act(() => {
      useAppStore.getState().setUser({ id: 'e1', name: 'Guus', email: 'guus@test.nl', googleId: 'g1' })
      useAppStore.getState().clearUser()
    })
    expect(useAppStore.getState().user).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test tests/unit/store/appStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/store/appStore.ts`**

```ts
import { create } from 'zustand'
import type { User } from '../domain/entities/User'
import type {
  SimplicateHourType,
  SimplicateProject,
  SimplicateService,
} from '../domain/repositories/ISimplicateRepository'

interface AppState {
  // Auth
  user: User | null
  setUser: (user: User) => void
  clearUser: () => void

  // Simplicate data cache
  projects: SimplicateProject[]
  services: SimplicateService[]
  hourTypes: SimplicateHourType[]
  setSimplicateData: (data: { projects: SimplicateProject[]; services: SimplicateService[]; hourTypes: SimplicateHourType[] }) => void

  // UI
  isLoading: boolean
  setLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
}

const initialState = {
  user: null,
  projects: [],
  services: [],
  hourTypes: [],
  isLoading: false,
  error: null,
}

export const useAppStore = create<AppState>()((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),

  setSimplicateData: (data) => set(data),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))

// Expose for testing
useAppStore.getInitialState = () => ({
  ...initialState,
  setUser: useAppStore.getState().setUser,
  clearUser: useAppStore.getState().clearUser,
  setSimplicateData: useAppStore.getState().setSimplicateData,
  setLoading: useAppStore.getState().setLoading,
  setError: useAppStore.getState().setError,
})
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npm run test tests/unit/store/appStore.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store tests/unit/store
git commit -m "feat: add Zustand app store"
```

---

## Task 9: Rust Backend — Google OAuth PKCE

**Files:**
- Create: `src-tauri/src/commands/auth.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add OAuth dependencies to `src-tauri/Cargo.toml`**

```toml
[dependencies]
# existing deps...
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rand = "0.8"
sha2 = "0.10"
base64 = "0.22"
```

- [ ] **Step 2: Create `src-tauri/src/commands/auth.rs`**

```rust
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::net::TcpListener;
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener as AsyncTcpListener;

fn generate_code_verifier() -> String {
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

fn generate_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

#[derive(serde::Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
}

#[tauri::command]
pub async fn start_google_oauth(app: AppHandle, client_id: String) -> Result<String, String> {
    let port = find_free_port();
    let redirect_uri = format!("http://localhost:{}/callback", port);
    let verifier = generate_code_verifier();
    let challenge = generate_code_challenge(&verifier);

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
         ?client_id={client_id}\
         &redirect_uri={redirect_uri}\
         &response_type=code\
         &scope=openid%20email%20profile\
         &code_challenge={challenge}\
         &code_challenge_method=S256",
    );

    // Open browser
    tauri::opener::open_url(&auth_url, None::<&str>).map_err(|e| e.to_string())?;

    // Wait for callback
    let listener = AsyncTcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| e.to_string())?;

    let (stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
    let (reader, mut writer) = tokio::io::split(stream);
    let mut reader = BufReader::new(reader);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).await.map_err(|e| e.to_string())?;

    // Extract code from GET /callback?code=xxx
    let code = request_line
        .split_whitespace()
        .nth(1)
        .and_then(|path| {
            url::Url::parse(&format!("http://localhost{}", path)).ok()
        })
        .and_then(|url| {
            url.query_pairs()
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.into_owned())
        })
        .ok_or("No code in callback")?;

    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><h2>Inloggen geslaagd! Je kunt dit venster sluiten.</h2></body></html>";
    writer.write_all(response.as_bytes()).await.map_err(|e| e.to_string())?;

    // Exchange code for tokens — return code + verifier to JS for exchange
    // (exchange happens in JS to avoid storing client_secret in Rust)
    Ok(serde_json::json!({ "code": code, "verifier": verifier, "redirect_uri": redirect_uri }).to_string())
}
```

- [ ] **Step 3: Register auth command in `src-tauri/src/lib.rs`**

```rust
mod commands;

use commands::auth::start_google_oauth;
use commands::keychain::{delete_secret, get_secret, set_secret};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_keyring::init())
        .invoke_handler(tauri::generate_handler![
            get_secret,
            set_secret,
            delete_secret,
            start_google_oauth,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Build to verify Rust compiles**

```bash
npm run tauri build -- --debug 2>&1 | tail -30
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat: add Google OAuth PKCE Rust command"
```

---

## Task 10: UI — Login Page & Auth Flow

**Files:**
- Create: `src/ui/pages/LoginPage.tsx`
- Create: `src/ui/hooks/useAuth.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/ui/hooks/useAuth.ts`**

```ts
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export function useAuth() {
  const { setUser, setLoading, setError, clearUser } = useAppStore()

  async function loginWithGoogle() {
    setLoading(true)
    setError(null)
    try {
      // 1. Start PKCE flow in Rust — opens browser, waits for callback
      const resultJson = await invoke<string>('start_google_oauth', { clientId: GOOGLE_CLIENT_ID })
      const { code, verifier, redirect_uri } = JSON.parse(resultJson) as {
        code: string
        verifier: string
        redirect_uri: string
      }

      // 2. Exchange code for tokens in JS (no client_secret needed for PKCE)
      const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }),
      })
      if (!tokenRes.ok) throw new Error('Token exchange failed')
      const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; id_token?: string }

      // 3. Get user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const googleUser = await userRes.json() as { sub: string; name: string; email: string }

      // 4. Store tokens securely
      await keychainRepo.set('google-access-token', tokens.access_token)
      if (tokens.refresh_token) {
        await keychainRepo.set('google-refresh-token', tokens.refresh_token)
      }

      // 5. Look up Simplicate employee
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (apiKey && apiSecret) {
        const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
        const employee = await simplicateRepo.getEmployee(googleUser.email)
        setUser({ id: employee.id, name: employee.name, email: employee.email, googleId: googleUser.sub })
      } else {
        // No API key yet — set partial user, redirect to settings
        setUser({ id: '', name: googleUser.name, email: googleUser.email, googleId: googleUser.sub })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await keychainRepo.delete('google-access-token')
    await keychainRepo.delete('google-refresh-token')
    clearUser()
  }

  return { loginWithGoogle, logout }
}
```

- [ ] **Step 2: Create `src/ui/pages/LoginPage.tsx`**

```tsx
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'

export function LoginPage() {
  const { loginWithGoogle } = useAuth()
  const { isLoading, error } = useAppStore()

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
      <div className="bg-[#2d2d44] rounded-xl p-10 flex flex-col items-center gap-6 shadow-2xl w-80">
        <div className="text-white text-2xl font-bold">Uren schrijven</div>
        <div className="text-gray-400 text-sm text-center">
          Log in met je Google account om uren te schrijven naar Simplicate.
        </div>
        {error && (
          <div className="bg-red-900/40 text-red-300 text-sm rounded-lg px-4 py-2 w-full text-center">
            {error}
          </div>
        )}
        <button
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {isLoading ? 'Bezig met inloggen...' : 'Login met Google'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `src/main.tsx` with routing**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { useAppStore } from './store/appStore'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import './index.css'

function App() {
  const user = useAppStore((s) => s.user)
  return user ? <HomePage /> : <LoginPage />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 4: Verify app compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors (HomePage will be a stub for now — create a placeholder).

Create `src/ui/pages/Home.tsx` (stub):
```tsx
export function HomePage() {
  return <div className="min-h-screen bg-[#1a1a2e] text-white p-8">Home (coming soon)</div>
}
```

- [ ] **Step 5: Commit**

```bash
git add src/ui src/main.tsx
git commit -m "feat: add login page and Google OAuth flow"
```

---

## Task 11: UI — Home Page (Template Grid)

**Files:**
- Create: `src/ui/components/TemplateCard.tsx`
- Create: `src/ui/hooks/useTemplates.ts`
- Modify: `src/ui/pages/Home.tsx`

- [ ] **Step 1: Create `src/ui/hooks/useTemplates.ts`**

```ts
import { useEffect, useState } from 'react'
import { templateRepo } from '../../application/container'
import { SaveTemplateUseCase } from '../../domain/usecases/SaveTemplateUseCase'
import { DeleteTemplateUseCase } from '../../domain/usecases/DeleteTemplateUseCase'
import type { Template } from '../../domain/entities/Template'

const saveUseCase = new SaveTemplateUseCase(templateRepo)
const deleteUseCase = new DeleteTemplateUseCase(templateRepo)

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function load() {
    setIsLoading(true)
    const all = await templateRepo.getAll()
    setTemplates(all)
    setIsLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function save(template: Template) {
    await saveUseCase.execute(template)
    await load()
  }

  async function remove(id: string) {
    await deleteUseCase.execute(id)
    await load()
  }

  return { templates, isLoading, save, remove, reload: load }
}
```

- [ ] **Step 2: Create `src/ui/components/TemplateCard.tsx`**

```tsx
import type { Template } from '../../domain/entities/Template'
import { isRecurringTemplate, isWeeklyBlockTemplate } from '../../domain/entities/Template'

interface Props {
  template: Template
  onBook: (template: Template) => void
  onEdit: (template: Template) => void
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Ma', tue: 'Di', wed: 'Wo', thu: 'Do', fri: 'Vr', sat: 'Za', sun: 'Zo',
}

function templateSubtitle(template: Template): string {
  if (isRecurringTemplate(template)) {
    return `${template.days.map((d) => DAY_LABELS[d]).join('–')} · ${template.startTime}–${template.endTime}`
  }
  if (isWeeklyBlockTemplate(template)) {
    return `Elke ${DAY_LABELS[template.day]} · ${template.startTime}–${template.endTime}`
  }
  return `${template.startTime}–${template.endTime}`
}

function actionLabel(template: Template): string {
  if (isRecurringTemplate(template)) return 'Week invullen'
  if (isWeeklyBlockTemplate(template)) return 'Vandaag boeken'
  return 'Nu boeken'
}

export function TemplateCard({ template, onBook, onEdit }: Props) {
  return (
    <div
      className="bg-[#2d2d44] rounded-xl p-4 flex flex-col gap-2 cursor-pointer group hover:bg-[#35355a] transition-colors"
      style={{ borderLeft: `3px solid ${template.color}` }}
    >
      <div className="flex items-start justify-between">
        <div className="text-white font-semibold text-sm">{template.name}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(template) }}
          className="text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
        >
          ✏
        </button>
      </div>
      <div className="text-gray-400 text-xs">{templateSubtitle(template)}</div>
      {(template.projectId ?? template.serviceId) ? (
        <div className="text-gray-500 text-xs">
          {template.projectId ?? '—'} · {template.serviceId ?? '—'}
        </div>
      ) : (
        <div className="text-amber-400 text-xs">⚠ Velden ontbreken</div>
      )}
      <button
        onClick={() => onBook(template)}
        className="mt-1 text-white text-xs font-medium py-1.5 px-3 rounded-md self-start transition-colors"
        style={{ backgroundColor: template.color }}
      >
        {actionLabel(template)}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Replace stub `src/ui/pages/Home.tsx`**

```tsx
import { useState } from 'react'
import { useTemplates } from '../hooks/useTemplates'
import { TemplateCard } from '../components/TemplateCard'
import { BookingModal } from './BookingModal'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'
import type { Template } from '../../domain/entities/Template'

export function HomePage() {
  const { templates, isLoading, remove } = useTemplates()
  const { logout } = useAuth()
  const user = useAppStore((s) => s.user)
  const [bookingTemplate, setBookingTemplate] = useState<Template | null>(null)

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <div className="p-6 flex-1">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-6">Uren schrijven</div>
        {isLoading ? (
          <div className="text-gray-400 text-sm">Laden...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onBook={setBookingTemplate}
                onEdit={() => {/* settings navigation */}}
              />
            ))}
            <button
              onClick={() => {/* navigate to settings */}}
              className="bg-[#2d2d44] border border-dashed border-gray-600 rounded-xl p-4 flex items-center justify-center text-gray-500 hover:text-gray-400 hover:border-gray-500 transition-colors text-sm"
            >
              + Template toevoegen
            </button>
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
        <span>Ingelogd als {user?.name}</span>
        <div className="flex gap-4">
          <button onClick={() => {/* navigate to settings */}} className="hover:text-gray-300">⚙ Instellingen</button>
          <button onClick={logout} className="hover:text-gray-300">Uitloggen</button>
        </div>
      </div>

      {bookingTemplate && (
        <BookingModal
          template={bookingTemplate}
          onClose={() => setBookingTemplate(null)}
        />
      )}
    </div>
  )
}
```

Create stub `src/ui/pages/BookingModal.tsx` (for compilation):
```tsx
import type { Template } from '../../domain/entities/Template'

interface Props {
  template: Template
  onClose: () => void
}

export function BookingModal({ template, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#2d2d44] rounded-xl p-6 w-80">
        <div className="text-white font-bold mb-4">{template.name}</div>
        <button onClick={onClose} className="text-gray-400 text-sm">Sluiten</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat: add home page with template grid"
```

---

## Task 12: UI — Booking Modal

**Files:**
- Modify: `src/ui/pages/BookingModal.tsx`
- Create: `src/ui/hooks/useBooking.ts`
- Create: `src/ui/components/FieldSelector.tsx`
- Test: `tests/unit/ui/BookingModal.test.tsx`

- [ ] **Step 1: Create `src/ui/components/FieldSelector.tsx`**

```tsx
interface Option {
  id: string
  label: string
}

interface Props {
  label: string
  options: Option[]
  value: string | undefined
  onChange: (id: string) => void
  required?: boolean
  disabled?: boolean
}

export function FieldSelector({ label, options, value, onChange, required, disabled }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-widest text-gray-400">
        {label}
        {required && !value && <span className="text-amber-400 ml-1">⚠</span>}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none disabled:opacity-50"
      >
        <option value="" disabled>Kies...</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/ui/hooks/useBooking.ts`**

```ts
import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'
import type { Template } from '../../domain/entities/Template'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export type BookingStatus = 'idle' | 'loading' | 'success' | 'error'

export function useBooking(template: Template) {
  const user = useAppStore((s) => s.user)
  const { projects, hourTypes } = useAppStore()

  const [projectId, setProjectId] = useState(template.projectId ?? '')
  const [serviceId, setServiceId] = useState(template.serviceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(template.hourTypeId ?? '')
  const [note, setNote] = useState(template.defaultNote ?? '')
  const [weekStartDate, setWeekStartDate] = useState(() => {
    // Default to this Monday
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    today.setDate(today.getDate() + diff)
    return today.toISOString().split('T')[0]!
  })
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [status, setStatus] = useState<BookingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const missingFields = [
    !projectId && 'project',
    !serviceId && 'dienst',
    !hourTypeId && 'urensoort',
  ].filter(Boolean)

  async function loadServices(pid: string) {
    const apiKey = await keychainRepo.get('simplicate-api-key')
    const apiSecret = await keychainRepo.get('simplicate-api-secret')
    if (!apiKey || !apiSecret) return
    const repo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
    const svc = await repo.getServices(pid)
    setServices(svc)
  }

  async function handleProjectChange(pid: string) {
    setProjectId(pid)
    setServiceId('')
    await loadServices(pid)
  }

  async function book() {
    if (!user?.id) return
    setStatus('loading')
    setErrorMessage(null)
    try {
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (!apiKey || !apiSecret) throw new Error('Simplicate API key niet ingesteld')

      const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
      const { bookTemplate } = createUseCases(simplicateRepo)

      await bookTemplate.execute({
        template,
        employeeId: user.id,
        note,
        weekStartDate,
        overrides: { projectId, serviceId, hourTypeId },
      })
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Boeken mislukt')
    }
  }

  return {
    projectId, setProjectId: handleProjectChange,
    serviceId, setServiceId,
    hourTypeId, setHourTypeId,
    note, setNote,
    weekStartDate, setWeekStartDate,
    services,
    status,
    errorMessage,
    missingFields,
    canBook: missingFields.length === 0,
    projects,
    hourTypes,
    book,
  }
}
```

- [ ] **Step 3: Replace stub `src/ui/pages/BookingModal.tsx`**

```tsx
import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { isRecurringTemplate } from '../../domain/entities/Template'
import type { Template } from '../../domain/entities/Template'

interface Props {
  template: Template
  onClose: () => void
}

function getMondayOfWeek(offset: number): string {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  today.setDate(today.getDate() + diff + offset * 7)
  return today.toISOString().split('T')[0]!
}

export function BookingModal({ template, onClose }: Props) {
  const booking = useBooking(template)

  if (booking.status === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#2d2d44] rounded-xl p-6 w-80 text-center flex flex-col gap-4">
          <div className="text-green-400 text-4xl">✓</div>
          <div className="text-white font-semibold">Uren geboekt!</div>
          <button onClick={onClose} className="bg-[#6c63ff] text-white py-2 rounded-lg text-sm font-medium">
            Sluiten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#2d2d44] rounded-xl p-6 w-96 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="text-white font-bold">{template.name}</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
        </div>

        {/* Missing fields */}
        {!template.projectId && (
          <FieldSelector
            label="Project"
            required
            options={booking.projects.map((p) => ({ id: p.id, label: `${p.organizationName} · ${p.name}` }))}
            value={booking.projectId}
            onChange={booking.setProjectId}
          />
        )}
        {!template.serviceId && (
          <FieldSelector
            label="Dienst"
            required
            options={booking.services.map((s) => ({ id: s.id, label: s.name }))}
            value={booking.serviceId}
            onChange={booking.setServiceId}
            disabled={!booking.projectId}
          />
        )}
        {!template.hourTypeId && (
          <FieldSelector
            label="Urensoort"
            required
            options={booking.hourTypes.map((h) => ({ id: h.id, label: h.label }))}
            value={booking.hourTypeId}
            onChange={booking.setHourTypeId}
          />
        )}

        {/* Week selector for recurring templates */}
        {isRecurringTemplate(template) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-gray-400">Week</label>
            <div className="flex gap-2">
              {[0, -1].map((offset) => {
                const monday = getMondayOfWeek(offset)
                const label = offset === 0 ? 'Deze week' : 'Vorige week'
                return (
                  <button
                    key={offset}
                    onClick={() => booking.setWeekStartDate(monday)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      booking.weekStartDate === monday
                        ? 'bg-[#6c63ff] text-white'
                        : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Note */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Toelichting</label>
          <input
            type="text"
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value)}
            placeholder="Optioneel"
            className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
          />
        </div>

        {booking.errorMessage && (
          <div className="bg-red-900/40 text-red-300 text-xs rounded-lg px-3 py-2">
            {booking.errorMessage}
          </div>
        )}

        <button
          onClick={booking.book}
          disabled={!booking.canBook || booking.status === 'loading'}
          className="bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {booking.status === 'loading' ? 'Bezig...' : `Boeken →`}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat: add booking modal with missing field resolution"
```

---

## Task 13: UI — Settings Page (Template Form + Account)

**Files:**
- Create: `src/ui/components/DayPicker.tsx`
- Create: `src/ui/pages/Settings/AccountSettings.tsx`
- Create: `src/ui/pages/Settings/TemplateForm.tsx`
- Create: `src/ui/pages/Settings/SettingsPage.tsx`
- Modify: `src/ui/pages/Home.tsx` (wire settings navigation)

- [ ] **Step 1: Create `src/ui/components/DayPicker.tsx`**

```tsx
import type { Day } from '../../domain/entities/Template'

const DAYS: { key: Day; label: string }[] = [
  { key: 'mon', label: 'Ma' },
  { key: 'tue', label: 'Di' },
  { key: 'wed', label: 'Wo' },
  { key: 'thu', label: 'Do' },
  { key: 'fri', label: 'Vr' },
  { key: 'sat', label: 'Za' },
  { key: 'sun', label: 'Zo' },
]

interface Props {
  selected: Day[]
  onChange: (days: Day[]) => void
}

export function DayPicker({ selected, onChange }: Props) {
  function toggle(day: Day) {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day))
    } else {
      onChange([...selected, day])
    }
  }

  return (
    <div className="flex gap-1">
      {DAYS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            selected.includes(key)
              ? 'bg-[#6c63ff] text-white'
              : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/ui/pages/Settings/AccountSettings.tsx`**

```tsx
import { useState } from 'react'
import { keychainRepo } from '../../../application/container'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../../store/appStore'

export function AccountSettings() {
  const user = useAppStore((s) => s.user)
  const { logout } = useAuth()
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    await keychainRepo.set('simplicate-api-key', apiKey)
    await keychainRepo.set('simplicate-api-secret', apiSecret)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-widest text-gray-400">Ingelogd als</div>
        <div className="text-white text-sm">{user?.name} ({user?.email})</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-gray-400">Simplicate API</div>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
        />
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder="API Secret"
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
        />
        <button
          onClick={save}
          disabled={!apiKey || !apiSecret}
          className="bg-[#6c63ff] disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg"
        >
          {saved ? '✓ Opgeslagen' : 'Opslaan'}
        </button>
      </div>

      <button
        onClick={logout}
        className="text-red-400 hover:text-red-300 text-sm self-start transition-colors"
      >
        Uitloggen
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/ui/pages/Settings/TemplateForm.tsx`**

```tsx
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useTemplates } from '../../hooks/useTemplates'
import { useAppStore } from '../../../store/appStore'
import { DayPicker } from '../../components/DayPicker'
import { FieldSelector } from '../../components/FieldSelector'
import type { Template, TemplateType, Day } from '../../../domain/entities/Template'

// Install uuid: npm install uuid && npm install -D @types/uuid

const COLORS = ['#6c63ff', '#63c5ff', '#63ffb4', '#f59e0b', '#f87171', '#a78bfa']
const TYPE_LABELS: Record<TemplateType, string> = {
  recurring: 'Herhalend (ma–vr)',
  single: 'Los (vandaag)',
  'weekly-block': 'Wekelijks blok',
}

interface Props {
  initial?: Template
  onDone: () => void
}

export function TemplateForm({ initial, onDone }: Props) {
  const { save } = useTemplates()
  const { projects, hourTypes } = useAppStore()

  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<TemplateType>(initial?.type ?? 'recurring')
  const [color, setColor] = useState(initial?.color ?? COLORS[0]!)
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '09:30')
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(initial?.hourTypeId ?? '')
  const [defaultNote, setDefaultNote] = useState(initial?.defaultNote ?? '')
  const [days, setDays] = useState<Day[]>(
    initial?.type === 'recurring' ? initial.days : ['mon', 'tue', 'wed', 'thu', 'fri'],
  )
  const [day, setDay] = useState<Day>(
    initial?.type === 'weekly-block' ? initial.day : 'mon',
  )
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    try {
      const base = { id: initial?.id ?? uuidv4(), name, color, startTime, endTime, projectId: projectId || undefined, serviceId: serviceId || undefined, hourTypeId: hourTypeId || undefined, defaultNote: defaultNote || undefined }
      let template: Template
      if (type === 'recurring') template = { ...base, type: 'recurring', days }
      else if (type === 'single') template = { ...base, type: 'single' }
      else template = { ...base, type: 'weekly-block', day }
      await save(template)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-gray-400">Naam</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Dagelijkse standup"
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-widest text-gray-400">Type</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TYPE_LABELS) as TemplateType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                type === t ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {type === 'recurring' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Dagen</label>
          <DayPicker selected={days} onChange={setDays} />
        </div>
      )}

      {type === 'weekly-block' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Dag</label>
          <DayPicker selected={[day]} onChange={(d) => d[0] && setDay(d[0])} />
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Starttijd</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
            className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none" />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Eindtijd</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
            className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none" />
        </div>
      </div>

      <FieldSelector
        label="Project (optioneel)"
        options={projects.map((p) => ({ id: p.id, label: `${p.organizationName} · ${p.name}` }))}
        value={projectId || undefined}
        onChange={setProjectId}
      />
      <FieldSelector
        label="Dienst (optioneel)"
        options={[]}
        value={serviceId || undefined}
        onChange={setServiceId}
        disabled={!projectId}
      />
      <FieldSelector
        label="Urensoort (optioneel)"
        options={hourTypes.map((h) => ({ id: h.id, label: h.label }))}
        value={hourTypeId || undefined}
        onChange={setHourTypeId}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-gray-400">Standaard toelichting</label>
        <input type="text" value={defaultNote} onChange={(e) => setDefaultNote(e.target.value)}
          placeholder="Optioneel"
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-gray-400">Kleur</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-[#2d2d44]' : ''}`}
            />
          ))}
        </div>
      </div>

      {error && <div className="bg-red-900/40 text-red-300 text-xs rounded-lg px-3 py-2">{error}</div>}

      <button onClick={handleSave}
        className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
        {initial ? 'Opslaan' : 'Template aanmaken'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Install uuid**

```bash
npm install uuid
npm install -D @types/uuid
```

- [ ] **Step 5: Create `src/ui/pages/Settings/SettingsPage.tsx`**

```tsx
import { useState } from 'react'
import { useTemplates } from '../../hooks/useTemplates'
import { TemplateForm } from './TemplateForm'
import { AccountSettings } from './AccountSettings'
import type { Template } from '../../../domain/entities/Template'

type Tab = 'templates' | 'account'

interface Props {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('templates')
  const [editing, setEditing] = useState<Template | null | 'new'>(null)
  const { templates, remove } = useTemplates()

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <div className="p-6 flex items-center gap-4 border-b border-gray-800">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">← Terug</button>
        <div className="font-bold">Instellingen</div>
      </div>

      <div className="flex gap-1 px-6 pt-4">
        {(['templates', 'account'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-[#2d2d44] text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t === 'templates' ? 'Templates' : 'Account'}
          </button>
        ))}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {tab === 'templates' && editing === null && (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-[#2d2d44] rounded-xl p-4 flex justify-between items-center"
                style={{ borderLeft: `3px solid ${t.color}` }}>
                <div>
                  <div className="text-white text-sm font-medium">{t.name}</div>
                  <div className="text-gray-400 text-xs">{t.type}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(t)} className="text-gray-400 hover:text-white text-xs">Bewerken</button>
                  <button onClick={() => remove(t.id)} className="text-red-400 hover:text-red-300 text-xs">Verwijderen</button>
                </div>
              </div>
            ))}
            <button onClick={() => setEditing('new')}
              className="border border-dashed border-gray-600 rounded-xl p-4 text-gray-500 hover:text-gray-400 hover:border-gray-500 text-sm transition-colors">
              + Nieuw template
            </button>
          </div>
        )}

        {tab === 'templates' && editing !== null && (
          <div>
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white text-sm mb-4">← Terug naar templates</button>
            <TemplateForm initial={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
          </div>
        )}

        {tab === 'account' && <AccountSettings />}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire settings navigation in `src/ui/pages/Home.tsx`**

Add `useState` for `showSettings` and conditionally render `SettingsPage`:

```tsx
// Add to Home.tsx imports:
import { useState } from 'react'
import { SettingsPage } from './Settings/SettingsPage'

// Inside HomePage():
const [showSettings, setShowSettings] = useState(false)

if (showSettings) {
  return <SettingsPage onBack={() => setShowSettings(false)} />
}

// Replace the {/* navigate to settings */} comments with:
// onClick={() => setShowSettings(true)}
```

- [ ] **Step 7: Verify compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui
git commit -m "feat: add settings page with template form and account settings"
```

---

## Task 14: Load Simplicate Data on App Start

**Files:**
- Create: `src/ui/hooks/useSimplicateData.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/ui/hooks/useSimplicateData.ts`**

```ts
import { useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository, createUseCases } from '../../application/container'

const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string

export function useSimplicateData() {
  const { user, setSimplicateData, setError } = useAppStore()

  useEffect(() => {
    if (!user?.id) return

    async function load() {
      try {
        const apiKey = await keychainRepo.get('simplicate-api-key')
        const apiSecret = await keychainRepo.get('simplicate-api-secret')
        if (!apiKey || !apiSecret) return

        const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
        const { fetchSimplicateData } = createUseCases(simplicateRepo)
        const data = await fetchSimplicateData.execute()
        setSimplicateData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kon Simplicate data niet laden')
      }
    }

    void load()
  }, [user?.id])
}
```

- [ ] **Step 2: Call hook in `src/ui/pages/Home.tsx`**

Add to `HomePage`:
```tsx
import { useSimplicateData } from '../hooks/useSimplicateData'

// Inside HomePage():
useSimplicateData()
```

- [ ] **Step 3: Verify full app compiles and runs**

```bash
npx tsc --noEmit
npm run tauri dev
```

Expected: app starts, login page shows, no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/hooks/useSimplicateData.ts src/ui/pages/Home.tsx
git commit -m "feat: load Simplicate data on app start after login"
```

---

## Task 15: Run All Tests & Final Cleanup

- [ ] **Step 1: Run all unit tests**

```bash
npm run test
```

Expected: all tests PASS with no warnings.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

Fix any lint errors. Expected: clean output.

- [ ] **Step 4: Verify production build**

```bash
npm run tauri build
```

Expected: build completes, `.dmg` or `.app` produced in `src-tauri/target/release/bundle/`.

- [ ] **Step 5: Verify `.gitignore` is complete**

```bash
git status
```

Verify none of the following appear as untracked: `.env`, `src-tauri/target/`, `dist/`, `node_modules/`.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: verify all tests pass, app builds successfully"
```
