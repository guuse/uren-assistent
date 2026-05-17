# Uren Schrijven — Design Spec

**Date:** 2026-05-17  
**Status:** Approved  

---

## 1. Purpose

A macOS desktop application that makes registering recurring hours in Simplicate fast and frictionless. Instead of navigating Simplicate's full UI, users configure templates (e.g. "Daily standup", "Sprint planning") and book them with one click. The app is team-ready, maintainable, and extensible.

---

## 2. Platform & Stack

| Concern | Choice |
|---|---|
| Desktop runtime | Tauri 2.0 |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State management | Zustand |
| Build tooling | Vite |
| Backend (Rust) | Tauri core + plugins |
| Secure storage | Tauri `keyring` plugin → macOS Keychain |
| Auth | Google OAuth 2.0 (PKCE flow) |
| External API | Simplicate REST API v2 |
| Testing | Vitest (unit), Playwright (e2e) |
| Linting | ESLint + Prettier |

**Why Tauri 2.0:** Lightweight (~10MB bundle vs ~150MB Electron), fast startup, native macOS Keychain access, secure by default (allowlist-based Rust commands).

---

## 3. Architecture

### 3.1 Clean Architecture layers

The frontend follows a strict layered architecture. Dependencies only point inward.

```
┌─────────────────────────────────────────┐
│           UI Layer (React)              │  Pages, components, hooks
├─────────────────────────────────────────┤
│        Application Layer                │  Use cases, orchestration
├─────────────────────────────────────────┤
│          Domain Layer                   │  Entities, business rules, interfaces
├─────────────────────────────────────────┤
│       Infrastructure Layer              │  Simplicate API, Tauri IPC, storage
└─────────────────────────────────────────┘
```

- **Domain layer** has zero external dependencies. It defines types, entities, and repository interfaces.
- **Application layer** contains use cases (e.g. `BookTemplateUseCase`, `SaveTemplateUseCase`). It depends only on domain interfaces.
- **Infrastructure layer** implements domain interfaces: `SimplicateRepository`, `TemplateStorageRepository`, `KeychainRepository`.
- **UI layer** calls use cases via hooks. Components are dumb — they receive props and fire callbacks.

### 3.2 Directory structure

```
uren-schrijven/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Template.ts          # Template entity + type discriminants
│   │   │   ├── HourEntry.ts         # Simplicate hour entry value object
│   │   │   └── User.ts              # Authenticated user
│   │   ├── repositories/
│   │   │   ├── ITemplateRepository.ts
│   │   │   ├── ISimplicateRepository.ts
│   │   │   └── IKeychainRepository.ts
│   │   └── usecases/
│   │       ├── BookTemplateUseCase.ts
│   │       ├── SaveTemplateUseCase.ts
│   │       ├── DeleteTemplateUseCase.ts
│   │       └── FetchSimplicateDataUseCase.ts
│   ├── infrastructure/
│   │   ├── simplicate/
│   │   │   ├── SimplicateRepository.ts   # Implements ISimplicateRepository
│   │   │   └── simplicate.types.ts       # Raw API types
│   │   ├── storage/
│   │   │   └── TemplateStorageRepository.ts  # JSON via Tauri fs plugin
│   │   └── keychain/
│   │       └── KeychainRepository.ts     # Tauri keyring plugin
│   ├── application/
│   │   └── container.ts             # Dependency injection container
│   ├── ui/
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Template grid
│   │   │   ├── BookingModal.tsx     # Book flow (prefill + missing fields)
│   │   │   └── Settings/
│   │   │       ├── SettingsPage.tsx
│   │   │       ├── TemplateForm.tsx
│   │   │       └── AccountSettings.tsx
│   │   ├── components/
│   │   │   ├── TemplateCard.tsx
│   │   │   ├── FieldSelector.tsx    # Reusable project/service/type picker
│   │   │   └── DayPicker.tsx
│   │   └── hooks/
│   │       ├── useTemplates.ts
│   │       ├── useBooking.ts
│   │       └── useSimplicateData.ts
│   ├── store/
│   │   └── appStore.ts              # Zustand store (UI state only)
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── auth.rs              # OAuth PKCE flow, token exchange
│   │   │   └── keychain.rs          # Read/write secrets
│   │   └── lib.rs
│   └── tauri.conf.json
├── tests/
│   ├── unit/
│   └── e2e/
├── AGENTS.md
├── .gitignore
└── .env.example
```

### 3.3 Dependency injection

A central `container.ts` wires up concrete implementations to interfaces. Use cases receive repositories via constructor injection. This makes unit testing trivial (swap real repositories for mocks) and makes it easy to replace implementations (e.g. swap Simplicate for a different time-tracking tool).

```ts
// src/application/container.ts
export const container = {
  templateRepo: new TemplateStorageRepository(),
  simplicateRepo: new SimplicateRepository(),
  keychainRepo: new KeychainRepository(),
};
```

---

## 4. Authentication & Security

### 4.1 Google OAuth (PKCE)

1. User clicks "Login met Google"
2. Tauri opens system browser with Google OAuth URL + PKCE challenge
3. Google redirects to `http://localhost:<ephemeral_port>/callback`
4. Rust command intercepts callback, extracts code, exchanges for tokens
5. Access token + refresh token stored in macOS Keychain (never in files, never in git)
6. On app start: read tokens from Keychain, refresh if expired, resolve Simplicate user

### 4.2 Simplicate API key

- Entered once by the user in Account Settings
- Stored in macOS Keychain via Tauri keyring plugin
- Retrieved at runtime via Rust command — never exposed to the renderer process as a plain string in storage
- Used as `Authentication` header for all Simplicate API calls

### 4.3 Git safety

- `.gitignore` excludes: `.env`, `*.pem`, `src-tauri/gen/`, `node_modules/`, `dist/`
- `.env.example` contains placeholder keys only (e.g. `GOOGLE_CLIENT_ID=your-client-id-here`)
- Google OAuth Client ID is a build-time env var injected via Vite — not a secret, but not hardcoded
- No secrets are ever written to disk outside the Keychain

---

## 5. Template System

### 5.1 Template entity

```ts
type TemplateType = 'recurring' | 'single' | 'weekly-block';

interface BaseTemplate {
  id: string;           // UUID
  name: string;
  type: TemplateType;
  color: string;        // Hex, for card accent
  projectId?: string;   // Optional — if absent, asked at booking time
  serviceId?: string;   // Optional
  hourTypeId?: string;  // Optional
  defaultNote?: string;
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
}

interface RecurringTemplate extends BaseTemplate {
  type: 'recurring';
  days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
}

interface SingleTemplate extends BaseTemplate {
  type: 'single';
}

interface WeeklyBlockTemplate extends BaseTemplate {
  type: 'weekly-block';
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
}

type Template = RecurringTemplate | SingleTemplate | WeeklyBlockTemplate;
```

### 5.2 Booking flow

1. User clicks a template card → `BookingModal` opens
2. App resolves which fields are missing (`projectId`, `serviceId`, `hourTypeId`)
3. If **all fields present**: show only toelichting (pre-filled with `defaultNote`) + week/date selector → Book button active
4. If **fields missing**: show only missing fields as dropdowns (highlighted), toelichting, week/date → Book button active only when all required fields filled
5. Dienst dropdown is filtered by selected project (Simplicate API constraint)
6. On confirm: `BookTemplateUseCase` builds one `HourEntry` per day/date and POSTs to Simplicate API
7. Success → toast notification, modal closes
8. Error → inline error message, retry option

### 5.3 Template storage

Templates stored as a JSON array in Tauri's `app_data_dir()` (e.g. `~/Library/Application Support/uren-schrijven/templates.json`). No database needed at this scale. Repository interface makes it easy to swap to SQLite later if needed.

---

## 6. Simplicate API Integration

### 6.1 Endpoints used

| Action | Endpoint |
|---|---|
| Get current user | `GET /me` |
| List projects | `GET /projects/project` |
| List services for project | `GET /projects/service?project_id=X` |
| List hour types | `GET /hours/hourtypes` |
| Book hours | `POST /hours/hours` |

### 6.2 Data fetching strategy

- Projects, services, and hour types are fetched once on app start and cached in memory (Zustand store)
- Cache is invalidated on app restart or manual refresh
- All API calls go through `SimplicateRepository` — no direct fetch calls in UI components

### 6.3 Error handling

- 401 → prompt user to re-enter API key
- 422 → show validation error from Simplicate response
- Network error → show retry option
- All errors surface to the UI via use case return types (no thrown exceptions crossing layer boundaries)

---

## 7. Development Principles

### 7.1 Core principles

- **Single Responsibility:** Every file/module does one thing. If a file grows beyond ~200 lines, it's doing too much.
- **Dependency Inversion:** UI and use cases depend on interfaces, not concrete implementations.
- **Open/Closed:** Adding a new template type means adding a new type discriminant and handler — not modifying existing booking logic.
- **No business logic in UI:** Components only render and dispatch. All decisions happen in use cases.
- **No secrets in code or git:** All credentials via Keychain or environment variables.

### 7.2 Testing strategy

- **Unit tests** (Vitest): all use cases, domain entities, repository implementations (with mocked Tauri IPC)
- **Integration tests**: `SimplicateRepository` against a mock HTTP server
- **E2e tests** (Playwright): happy path — login, create template, book hours

### 7.3 Code style

- TypeScript strict mode enabled
- ESLint with `@typescript-eslint/recommended` + `react-hooks` rules
- Prettier for formatting
- Imports ordered: external → internal domain → internal infra → UI
- No `any` types — use `unknown` and narrow explicitly

---

## 8. AGENTS.md

A top-level `AGENTS.md` file will be committed to the repository. It contains:

- Architecture overview (layers, directory map)
- Mandatory rules (no business logic in UI, no secrets in files, dependency injection)
- Template for adding new features (which files to touch, in which order)
- How to run tests and linting
- Common pitfalls to avoid

This file is the single source of truth for any developer (or AI agent) working on the codebase.

---

## 9. Out of scope (v1)

- Editing already-booked hours in Simplicate
- Calendar view of booked hours
- Team-shared templates
- Notifications / reminders
- Windows / Linux builds
