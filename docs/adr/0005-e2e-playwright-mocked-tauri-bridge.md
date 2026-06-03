---
status: accepted
---

# End-to-end tests via Playwright/WebKit against a mocked Tauri bridge

Features kept breaking when new ones landed. Unit tests (vitest/jsdom) cover usecases and components in isolation, but nothing exercised the full app — boot, classify, edit the timeline, book, submit — the way a user does. We want a suite that walks every primary flow on every PR and fails when one breaks, **without** any real network, auth, SSO, or calls to Simplicate/Gemini/GitHub/Linear/Google Calendar.

## Decision

- **Drive the real built web frontend with Playwright.** Playwright loads the production bundle (`vite build && vite preview`). The store, hooks, usecases, deterministic packer, timeline, drag, and leftover sidebar all run for real — only the backend is faked.
- **Cut the seam at the Tauri bridge, two channels.** In a plain browser every `@tauri-apps/api/*` call (incl. `plugin-fs` `readTextFile`/`writeTextFile` and `appDataDir`) funnels through `window.__TAURI_INTERNALS__.invoke`; only `fetch` (GitHub, Linear, Google Calendar, Google OAuth) is separate. We intercept exactly these two: `invoke` via `page.addInitScript`, `fetch` via `page.route`.
- **Stateful in-memory fake.** The fake holds mutable state (hour entries, submissions, settings, keychain, history). `book_hours` adds an entry that a subsequent week read returns as booked (blue); `submit_week` locks the week; delete/edit mutate. Flows are tested by cause→effect, not by asserting a call was made.
- **Auth is always seeded, never driven through the UI.** SSO is never performed. A `seedAuth` helper primes the fake keychain so `useRestoreSession` lands straight on the week page. The `LoginPage` SSO flow stays covered by unit tests only.
- **Run on WebKit.** The desktop app ships a WebKit webview (WKWebView / webkit2gtk), not Chromium. Specs run on Playwright's WebKit so WebKit-specific rendering/JS breaks are caught.
- **Determinism via a frozen clock.** `page.clock` pins "now" to a fixed instant; all fixtures are dated relative to it, so week selection, the 8h fill target, and recurring-pattern cadence are stable on any CI run day.
- **Gates merge.** A new `e2e` job in `ci.yml` runs the suite on every PR (build + preview + webkit) and is a required status check.

## Considered options

- **WebdriverIO + tauri-driver against the compiled binary.** Rejected: "no network/auth" is hard when the real Rust commands run (you must inject fakes into Rust too), and it needs webkit2gtk + tauri-driver + a cargo build in CI — slow and flakier. The bridge-mock approach tests the entire frontend experience, which is where the regressions actually happen.
- **Vitest browser mode / vitest+jsdom full-app render.** Rejected as the e2e level: jsdom can't catch real layout/drag/scroll/CSS breaks; browser mode is newer and less battle-tested for full-flow navigation than the Playwright runner. Unit tests stay on vitest/jsdom.
- **Mock at module level via a `VITE_E2E` build that aliases the bridge packages.** Reasonable alternative; rejected in favor of Playwright-side injection so no production build path or app code changes to accommodate tests — the shipped bundle is what gets tested.
- **Chromium engine.** Rejected for fidelity: it is not the engine the desktop app runs on mac/Linux.

## Consequences

- New dev dependency (`@playwright/test`) and a `playwright.config.ts`; a new `test:e2e` script and an `e2e` CI job. Coverage thresholds stay on the unit job; e2e does not count toward them.
- A fake-bridge module (authored in TS, bundled to one JS injected via `addInitScript`) must track the real `invoke` command names and `fetch` URLs/response shapes. When a repository changes a command name or endpoint, the fake must change too — this is intentional: the fake is the contract the frontend depends on.
- Selectors prefer `getByRole`/`getByText` against the real Dutch copy (doubling as a copy regression check); `data-testid` is added to source only for dynamic items (a specific timeline block, leftover row, day cell).
- Making the `e2e` check *required* is a one-time GitHub branch-protection setting, outside the repo.
