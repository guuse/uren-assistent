# Replace GitHub Copilot with Gemini Flash via API key

The app no longer uses GitHub Copilot, so the Copilot API was replaced with Google Gemini Flash (`gemini-2.0-flash`) for block classification. The API key is baked in via `VITE_GEMINI_API_KEY` in `.env`, and calls are made directly from TypeScript — the same pattern used for Google Calendar. The model is hardcoded; there is no model picker.

## Considered options

- **Vertex AI with OAuth** — would have reused the existing Google OAuth login, but requires adding `cloud-platform` scope (forcing re-authentication) and couples Calendar auth to LLM auth.
- **API key in Keychain (user-entered)** — consistent with how Copilot token was managed, but unnecessary for a personal app where the developer controls the build.
