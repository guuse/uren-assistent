<div align="center">

<img src="src-tauri/icons-prod/icon.png" alt="Uren-assistent logo" width="120" height="120" />

# Uren-assistent

**From your day's activity to booked hours in Simplicate — in one click.**

<p>
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white" />
  <img alt="Coverage ≥95%" src="https://img.shields.io/badge/coverage-%E2%89%A595%25-brightgreen" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green" />
</p>

</div>

---

**Uren-assistent** is a Tauri desktop app that turns a developer's day — browser history,
calendar, GitHub/Linear activity and past bookings — into bookable time blocks in
[Simplicate](https://www.simplicate.com/). An LLM (Gemini Flash) classifies the day, a
deterministic packer lays the result out on a clean timeline, and you book it with one click.
Completed weeks are submitted ("ingediend") to Simplicate straight from the app.

## How it works

```
  activity sources                 classify              place & book            submit
 ┌────────────────────┐         ┌────────────┐        ┌──────────────┐       ┌──────────────┐
 │ browser history    │         │  Gemini    │        │ deterministic│       │  Simplicate  │
 │ calendar events    │  ──────▶│  Flash LLM │ ──────▶│  day-packer  │──────▶│  hours +     │
 │ GitHub / Linear    │         │ (1–5 conf) │        │  → timeline  │ book  │  week submit │
 │ past bookings      │         └────────────┘        └──────────────┘       └──────────────┘
 └────────────────────┘
```

The in-app workflow is **verwerken → boeken → indienen**: process a week to generate proposals,
book them to Simplicate, then submit the whole week (Mon–Sun) for review.

## Features

- 🧠 **Day classification** — turns your activity into proposed time blocks, each with a 1–5 confidence score.
- 🗓️ **Timeline view** — a week (Mon–Fri) sidebar plus a per-day timeline with drag-to-book.
- 🔍 **Evidence in context** — GitHub commits, Linear issues and calendar events shown per day.
- ⏱️ **Simplicate integration** — read, create, update and delete hours, and submit a week with one click.
- 🔒 **Submission status** — submitted weeks show as locked / read-only, synced live from Simplicate.
- 📥 **CSV history import** — bring in browser-history exports for richer classification.

## Tech stack

- [Tauri 2](https://tauri.app/) (Rust shell) · [React 19](https://react.dev/) · TypeScript · [Vite](https://vite.dev/)
- [Zustand](https://github.com/pmndrs/zustand) state · [Vitest](https://vitest.dev/) + Testing Library
- Google Gemini Flash (classification) · Google Calendar, GitHub & Linear APIs (context) · Simplicate API (hours)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable) + the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS
- A Simplicate environment with an API key/secret, and your own Google/Gemini credentials

## Configuration

Build-time config lives in a local `.env` (git-ignored — never commit it). Copy the example:

```bash
cp .env.example .env
```

```dotenv
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_CLIENT_SECRET=...
VITE_GEMINI_API_KEY=...
VITE_SIMPLICATE_BASE_URL=https://your-organisation.simplicate.nl/api/v2
```

> ⚠️ **Security note.** `VITE_`-prefixed values are bundled into the frontend at build time and
> are therefore present in any distributed binary. Use credentials you control, and never ship a
> build containing keys you don't want exposed.

Your **Simplicate API key + secret** are entered in-app and stored in the OS keychain — they are
never written to `.env` or committed.

## Development

```bash
npm install
npm run tauri dev     # run the desktop app (hot reload)
npm run dev           # run the web frontend only (Vite)
```

## Quality checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest
npm run coverage      # vitest with coverage (gated at ≥95% on all four metrics)
npm run build         # tsc + vite build
```

The frontend coverage gate enforces **≥95%** statements, branches, functions and lines; the Rust
backend is covered via `cargo llvm-cov` (`cargo cov` in `src-tauri/`).

## Building

```bash
npm run tauri build
```

## Project layout

```
src/
├── domain/          # entities, repository interfaces, use cases (no I/O)
├── infrastructure/  # Simplicate, Gemini, Google Calendar, GitHub, Linear, storage
├── application/     # dependency wiring (container.ts)
├── store/           # Zustand app store
└── ui/              # React components, pages, hooks
src-tauri/           # Rust shell + Tauri commands
docs/adr/            # architecture decision records
CONTEXT.md           # domain glossary
```

## Architecture

The codebase follows a clean, layered structure: pure **domain** logic (use cases over repository
interfaces) is isolated from **infrastructure** (HTTP / keychain / LLM adapters), wired together in
**application**, and consumed by the **ui** layer. Key decisions are recorded as
[ADRs](docs/adr/), and the domain vocabulary lives in [CONTEXT.md](CONTEXT.md).

## License

[MIT](./LICENSE) © Guus Ekkelenkamp
