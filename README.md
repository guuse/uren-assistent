# Uren-assistent

A Tauri desktop app that turns a developer's day — browser history, calendar, GitHub/Linear
activity and past bookings — into bookable time blocks in [Simplicate](https://www.simplicate.com/).
An LLM (Gemini Flash) classifies the day, a deterministic packer lays the result out on a
timeline, and you book it with one click. Weeks (and individual days) can be submitted
("ingediend") to Simplicate straight from the app.

## Features

- **Day classification** — turns activity into proposed time blocks with a 1–5 confidence score.
- **Timeline view** — week (Mon–Fri) sidebar + per-day timeline with drag-to-book.
- **Context** — GitHub commits, Linear issues and calendar events shown per day as evidence.
- **Simplicate integration** — read/create/update/delete hours, plus submit and withdraw
  ("indienen"/"intrekken") at week and day granularity.
- **CSV history import** for browser history.

## Tech stack

- [Tauri 2](https://tauri.app/) (Rust shell) + [React 19](https://react.dev/) + TypeScript + [Vite](https://vite.dev/)
- [Zustand](https://github.com/pmndrs/zustand) for state, [Vitest](https://vitest.dev/) for tests
- Google Gemini Flash for classification; Google Calendar, GitHub and Linear APIs for context

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable) + the
  [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS
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

> ⚠️ **Security note.** `VITE_`-prefixed values are bundled into the frontend at build time
> and are therefore present in any distributed binary. Use credentials you control and treat
> distributed builds accordingly; do not ship a build containing keys you don't want exposed.

Your **Simplicate API key + secret** are entered in-app and stored in the OS keychain — they
are never written to `.env` or committed.

## Development

```bash
npm install
npm run tauri dev     # run the desktop app
npm run dev           # run the web frontend only (Vite)
```

## Quality checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest
npm run build         # tsc + vite build
```

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
src-tauri/           # Rust shell + commands
docs/adr/            # architecture decision records
CONTEXT.md           # domain glossary
```

## License

[MIT](./LICENSE)
