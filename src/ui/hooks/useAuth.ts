import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../../store/appStore'
import { keychainRepo } from '../../application/container'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string
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

      // 2. Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }),
      })
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({})) as { error?: string; error_description?: string }
        throw new Error(`Token exchange failed: ${body.error ?? tokenRes.status} — ${body.error_description ?? ''}`)
      }
      const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string }

      // 3. Get user info from Google
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const googleUser = await userRes.json() as { sub: string; name: string; email: string }

      // 4. Store Google tokens + expiry (8 hours from now)
      const expiresAt = Date.now() + 8 * 60 * 60 * 1000
      await keychainRepo.set('google-access-token', tokens.access_token)
      await keychainRepo.set('google-token-expiry', String(expiresAt))
      if (tokens.refresh_token) {
        await keychainRepo.set('google-refresh-token', tokens.refresh_token)
      }

      // 5. Set user from Google data — Simplicate lookup happens in useSimplicateData
      setUser({ id: googleUser.sub, name: googleUser.name, email: googleUser.email, googleId: googleUser.sub })
    } catch (err) {
      console.error('[useAuth] loginWithGoogle error:', err)
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err)
      setError(msg || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await keychainRepo.delete('google-access-token')
    await keychainRepo.delete('google-token-expiry')
    await keychainRepo.delete('google-refresh-token')
    clearUser()
  }

  return { loginWithGoogle, logout }
}
