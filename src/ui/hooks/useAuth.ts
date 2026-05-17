import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../../store/appStore'
import { keychainRepo, createSimplicateRepository } from '../../application/container'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SIMPLICATE_BASE_URL = import.meta.env.VITE_SIMPLICATE_BASE_URL as string
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export function useAuth() {
  const setUser = useAppStore((s) => s.setUser)
  const setLoading = useAppStore((s) => s.setLoading)
  const setError = useAppStore((s) => s.setError)
  const clearUser = useAppStore((s) => s.clearUser)

  async function loginWithGoogle() {
    setLoading(true)
    setError(null)
    try {
      // 1. Start PKCE flow in Rust — opens browser, waits for callback
      const resultJson = await invoke<string>('start_google_oauth', { clientId: GOOGLE_CLIENT_ID })
      const { code, verifier, redirect_uri } = JSON.parse(resultJson) as {
        code: string
        verifier: string
        redirect_uri: string
      }

      // 2. Exchange code for tokens in JS (no client_secret needed for PKCE)
      const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }),
      })
      if (!tokenRes.ok) throw new Error('Token exchange failed')
      const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; id_token?: string }

      // 3. Get user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const googleUser = await userRes.json() as { sub: string; name: string; email: string }

      // 4. Store tokens securely
      await keychainRepo.set('google-access-token', tokens.access_token)
      if (tokens.refresh_token) {
        await keychainRepo.set('google-refresh-token', tokens.refresh_token)
      }

      // 5. Look up Simplicate employee
      const apiKey = await keychainRepo.get('simplicate-api-key')
      const apiSecret = await keychainRepo.get('simplicate-api-secret')
      if (apiKey && apiSecret) {
        const simplicateRepo = createSimplicateRepository(SIMPLICATE_BASE_URL, apiKey, apiSecret)
        const employee = await simplicateRepo.getEmployee(googleUser.email)
        setUser({ id: employee.id, name: employee.name, email: employee.email, googleId: googleUser.sub })
      } else {
        // No API key yet — set partial user, redirect to settings
        setUser({ id: '', name: googleUser.name, email: googleUser.email, googleId: googleUser.sub })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await keychainRepo.delete('google-access-token')
    await keychainRepo.delete('google-refresh-token')
    clearUser()
  }

  return { loginWithGoogle, logout }
}
