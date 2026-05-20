# Copilot Token Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the GitHub Copilot token from the macOS Keychain into Zustand on app startup, so it is available immediately without needing to visit the Settings page first.

**Architecture:** A new `useAppInit` hook reads `copilot-token` from `keychainRepo` once on mount and calls `setCopilotToken`. This hook is called once in `App.tsx`. No domain, infrastructure, or store changes are needed.

**Tech Stack:** React (hooks), Zustand, existing `KeychainRepository` (`keychainRepo` from `src/application/container.ts`)

---

### Task 1: Create `useAppInit` hook and wire it into `App.tsx`

**Files:**
- Create: `src/ui/hooks/useAppInit.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/ui/hooks/useAppInit.ts`**

```typescript
import { useEffect } from 'react'
import { keychainRepo } from '../../application/container'
import { useAppStore } from '../../store/appStore'

export function useAppInit(): void {
  const setCopilotToken = useAppStore(s => s.setCopilotToken)

  useEffect(() => {
    async function init() {
      try {
        const ct = await keychainRepo.get('copilot-token')
        if (ct) setCopilotToken(ct)
      } catch (err) {
        console.error('[AppInit] Failed to load copilot token from keychain:', err)
      }
    }
    void init()
  }, [])
}
```

- [ ] **Step 2: Add `useAppInit` call to `src/App.tsx`**

Open `src/App.tsx`. The current file looks like:

```tsx
import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import ImportPage from './ui/pages/ImportPage'

type Page = 'home' | 'import'

function App() {
  const user = useAppStore((s) => s.user)
  const [currentPage, setCurrentPage] = useState<Page>('home')
  // ...
```

Add the import and call:

```tsx
import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import ImportPage from './ui/pages/ImportPage'
import { useAppInit } from './ui/hooks/useAppInit'

type Page = 'home' | 'import'

function App() {
  useAppInit()
  const user = useAppStore((s) => s.user)
  const [currentPage, setCurrentPage] = useState<Page>('home')
  // rest unchanged
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck 2>&1 | grep -v node_modules
```

Expected: 0 errors.

- [ ] **Step 4: Run tests**

```bash
npm run test
```

Expected: all tests pass (no regressions — `useAppInit` has no unit test since it is a thin wiring layer with no logic).

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useAppInit.ts src/App.tsx
git commit -m "feat: load copilot token from keychain on app startup"
```
