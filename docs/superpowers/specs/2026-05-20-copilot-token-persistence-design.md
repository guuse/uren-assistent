# Design: Copilot Token Persistence on Startup

**Date:** 2026-05-20

## Problem

The GitHub Copilot token is already stored in the macOS Keychain when the user saves it in Settings. However, it is only loaded back into Zustand (`copilotToken`) inside the `useEffect` in `AccountSettings.tsx`. This `useEffect` only runs when the user navigates to the Settings page.

On every app restart, if the user goes directly to Import without opening Settings first, `copilotToken` is `null` and the import fails with "Stel eerst een GitHub Copilot token in."

## Solution

Add a `useAppInit` hook that runs once on app mount (in `App.tsx`) and loads the copilot token — and any other credentials needed at startup — from Keychain into Zustand.

## Architecture

### New file: `src/ui/hooks/useAppInit.ts`

A hook with a single `useEffect` that fires once on mount. It reads `copilot-token` from `keychainRepo` and calls `setCopilotToken` if a value exists.

```ts
export function useAppInit() {
  const setCopilotToken = useAppStore(s => s.setCopilotToken)

  useEffect(() => {
    async function init() {
      const ct = await keychainRepo.get('copilot-token')
      if (ct) setCopilotToken(ct)
    }
    void init()
  }, [])
}
```

### Change: `src/App.tsx`

Call `useAppInit()` at the top of the `App` component. No other changes.

### No change to `AccountSettings.tsx`

The Settings page already loads the token into Zustand via its own `useEffect` when visited. This is fine — calling `setCopilotToken` twice with the same value is a no-op in Zustand. Leave it as-is.

## Data flow

```
App mounts
  → useAppInit fires
    → keychainRepo.get('copilot-token')
      → if found: setCopilotToken(token)
        → Zustand copilotToken populated
          → useImport can read it immediately
```

## Error handling

- If Keychain read fails (e.g. permission denied): log the error, do not crash. `copilotToken` stays `null` and the existing error message in `useImport` handles it gracefully.

## Testing

- No unit test needed for the hook itself (it's a thin wiring layer with no logic).
- Manual smoke test: set token in Settings, restart app, go directly to Import — import should proceed without the "set token" error.

## Scope

One new file (`useAppInit.ts`), one line added to `App.tsx`. No domain, infrastructure, or store changes.
