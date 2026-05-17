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
