# Design: GitHub Copilot Model Selection

**Date:** 2026-05-25  
**Status:** Approved

## Summary

Add a settings option to select which GitHub Copilot model is used for AI classification. Available models are fetched dynamically from the Copilot API (including their token cost multiplier). The selected model is persisted via Tauri's store plugin in a JSON file in the app data folder.

---

## Domain Layer

### New entity: `CopilotModel`

Location: `src/domain/entities/CopilotModel.ts`

```ts
export type CopilotModel = {
  id: string             // e.g. "gpt-4o"
  name: string           // display name
  tokenMultiplier: number // relative token cost, e.g. 1.0 or 2.0
}
```

### New interface: `ISettingsRepository`

Location: `src/domain/repositories/ISettingsRepository.ts`

```ts
export interface ISettingsRepository {
  getSelectedModel(): Promise<string | null>
  setSelectedModel(modelId: string): Promise<void>
}
```

### Extended interface: `ICopilotRepository`

Add to `src/domain/repositories/ICopilotRepository.ts`:

```ts
listModels(): Promise<CopilotModel[]>
```

`classify()` and `classifyDay()` gain an optional `model?: string` parameter.

### New use cases

- `GetCopilotModelsUseCase` — calls `ICopilotRepository.listModels()`
- `GetSelectedModelUseCase` — calls `ISettingsRepository.getSelectedModel()`
- `SetSelectedModelUseCase` — calls `ISettingsRepository.setSelectedModel()`

---

## Infrastructure Layer

### New: `TauriSettingsRepository`

Location: `src/infrastructure/storage/TauriSettingsRepository.ts`

- Implements `ISettingsRepository`
- Uses `@tauri-apps/plugin-store` to persist a JSON file (`settings.json`) in the Tauri app data folder
- Key: `copilot_model`

### Extended: `CopilotRepository`

- New method `listModels()` — calls the Copilot models endpoint via Tauri IPC, maps response to `CopilotModel[]`
- `classify()` and `classifyDay()` accept an optional `model?: string` parameter, defaulting to `"gpt-4o"` if not provided

### Updated: `container.ts`

- Add `createSettingsRepository()` factory
- Wire `GetCopilotModelsUseCase`, `GetSelectedModelUseCase`, `SetSelectedModelUseCase` with their dependencies

---

## UI Layer

### Zustand store (`appStore`)

- New field: `selectedCopilotModel: string` (default: `"gpt-4o"`)
- On app startup: load from `GetSelectedModelUseCase`, set in store
- `selectedCopilotModel` is passed to `CopilotRepository` when classifying

### New hook: `useCopilotModels`

Location: `src/ui/hooks/useCopilotModels.ts`

- Calls `GetCopilotModelsUseCase`
- Returns `{ models: CopilotModel[], loading: boolean, error: string | null }`
- Only fetches when a valid Copilot token is present

### Settings UI

Location: `src/ui/pages/Settings/AccountSettings.tsx`

- New section at the top: **"AI Model"**
- Dropdown showing available models, each labeled as `{name} — {tokenMultiplier}×`
- Loading state while models are being fetched
- Error message if Copilot token is missing or API call fails
- Selection saves immediately via `SetSelectedModelUseCase` (no Save button needed)

---

## Data Flow

```
AccountSettings
  → useCopilotModels hook
    → GetCopilotModelsUseCase
      → CopilotRepository.listModels()
        → Copilot API /models

User selects model
  → SetSelectedModelUseCase
    → TauriSettingsRepository.setSelectedModel()
      → settings.json (app data folder)
  → appStore.selectedCopilotModel updated

WeekPage triggers classification
  → appStore.selectedCopilotModel passed to CopilotRepository.classify()
```

---

## Error Handling

- If `listModels()` fails (token missing, network error): show inline error in the model section, keep current selection
- If `getSelectedModel()` returns null on startup: use `"gpt-4o"` as default
- If selected model is no longer in the list (e.g. deprecated): still allow use, show warning in UI

---

## Testing

- Unit test each use case with mocked repositories
- Unit test `TauriSettingsRepository` with mocked Tauri store plugin
- Unit test `CopilotRepository.listModels()` with mocked IPC response
- No component internals tested — test behavior via hooks
