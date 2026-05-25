# Settings Project Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search input and sorted favorites-first display to the project list in the Settings screen.

**Architecture:** Pure UI change in `AccountSettings.tsx` — add a `projectSearch` state variable, derive a filtered+sorted list from `projects` and `starredIds`, and render a group separator between starred and non-starred groups.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

### Task 1: Add search state and filtered/sorted project list

**Files:**
- Modify: `src/ui/pages/Settings/AccountSettings.tsx`

- [ ] **Step 1: Add `projectSearch` state**

In `AccountSettings.tsx`, after the existing state declarations (around line 50), add:

```typescript
const [projectSearch, setProjectSearch] = useState('')
```

- [ ] **Step 2: Derive the filtered+sorted list**

Before the return statement, add this derived value (after the existing state declarations, before `return (`):

```typescript
const label = (p: { organizationName: string; name: string }) =>
  `${p.organizationName} — ${p.name}`

const filteredProjects = [...projects]
  .filter((p) =>
    projectSearch.trim() === '' ||
    p.name.toLowerCase().includes(projectSearch.trim().toLowerCase())
  )
  .sort((a, b) => label(a).localeCompare(label(b)))

const starredProjects = filteredProjects.filter((p) => starredIds.has(p.id))
const unstarredProjects = filteredProjects.filter((p) => !starredIds.has(p.id))
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/Settings/AccountSettings.tsx
git commit -m "feat(settings): add project search state and filtered list derivation"
```

---

### Task 2: Render search input and grouped list

**Files:**
- Modify: `src/ui/pages/Settings/AccountSettings.tsx`

- [ ] **Step 1: Replace the existing project list JSX**

Find this block (around line 421–443):

```tsx
{projects.length === 0 ? (
  <div className="text-xs text-[#4a4540]">Geen projecten geladen.</div>
) : (
  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
    {[...projects]
      .sort((a, b) => `${a.organizationName} — ${a.name}`.localeCompare(`${b.organizationName} — ${b.name}`))
      .map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => void toggleStar(p.id)}
          className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
            starredIds.has(p.id)
              ? 'bg-[#1e1b18] border border-[#a07848] text-[#e8e2d9]'
              : 'bg-[#1e1b18] border border-[#2e2a26] text-[#7a7268] hover:border-[#3e3a36]'
          }`}
        >
          <span className="text-[#a07848]">{starredIds.has(p.id) ? '★' : '☆'}</span>
          <span>{p.organizationName} — {p.name}</span>
        </button>
      ))}
  </div>
)}
```

Replace it with:

```tsx
{projects.length === 0 ? (
  <div className="text-xs text-[#4a4540]">Geen projecten geladen.</div>
) : (
  <>
    <input
      type="text"
      value={projectSearch}
      onChange={(e) => setProjectSearch(e.target.value)}
      placeholder="Zoek op projectnaam…"
      className="bg-[#1e1b18] border border-[#2e2a26] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 placeholder:text-[#4a4540] focus:outline-none focus:border-[#a07848] transition-colors"
    />
    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
      {starredProjects.length === 0 && unstarredProjects.length === 0 && (
        <div className="text-xs text-[#4a4540] px-1">Geen projecten gevonden.</div>
      )}
      {starredProjects.length > 0 && (
        <>
          {unstarredProjects.length > 0 && (
            <div className="text-xs uppercase tracking-widest text-[#a07848] px-1 pt-1 pb-0.5">Favorieten</div>
          )}
          {starredProjects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void toggleStar(p.id)}
              className="flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors bg-[#1e1b18] border border-[#a07848] text-[#e8e2d9]"
            >
              <span className="text-[#a07848]">★</span>
              <span>{p.organizationName} — {p.name}</span>
            </button>
          ))}
        </>
      )}
      {starredProjects.length > 0 && unstarredProjects.length > 0 && (
        <div className="text-xs uppercase tracking-widest text-[#7a7268] px-1 pt-2 pb-0.5">Overige projecten</div>
      )}
      {unstarredProjects.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => void toggleStar(p.id)}
          className="flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors bg-[#1e1b18] border border-[#2e2a26] text-[#7a7268] hover:border-[#3e3a36]"
        >
          <span className="text-[#a07848]">☆</span>
          <span>{p.organizationName} — {p.name}</span>
        </button>
      ))}
    </div>
  </>
)}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/Settings/AccountSettings.tsx
git commit -m "feat(settings): render search input and grouped starred/unstarred project list"
```
