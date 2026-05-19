import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { keychainRepo } from '../../application/container'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/**
 * On app startup, attempts to restore a previous session from keychain.
 * - If a valid (non-expired) access token exists → restore directly
 * - If expired but refresh token exists → refresh silently
 * - Otherwise → leave user null (show login)
 *
 * Returns `restoring: true` while the check is in progress so the UI
 * can show a neutral loading screen instead of flashing the login page.
 */
export function useRestoreSession() {
  const setUser = useAppStore((s) => s.setUser)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        const [accessToken, expiryStr, refreshToken] = await Promise.all([
          keychainRepo.get('google-access-token'),
          keychainRepo.get('google-token-expiry'),
          keychainRepo.get('google-refresh-token'),
        ])

        const expiry = expiryStr ? Number(expiryStr) : 0
        const isValid = !!accessToken && Date.now() < expiry

        let tokenToUse: string | null = null

        if (isValid) {
          tokenToUse = accessToken
        } else if (refreshToken) {
          // Try to silently refresh
          const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          })

          if (res.ok) {
            const tokens = await res.json() as { access_token: string; refresh_token?: string }
            const newExpiry = Date.now() + 8 * 60 * 60 * 1000
            await keychainRepo.set('google-access-token', tokens.access_token)
            await keychainRepo.set('google-token-expiry', String(newExpiry))
            if (tokens.refresh_token) {
              await keychainRepo.set('google-refresh-token', tokens.refresh_token)
            }
            tokenToUse = tokens.access_token
          }
          // If refresh fails, tokenToUse stays null → show login
        }

        if (!tokenToUse || cancelled) return

        // Fetch user info with the valid token
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenToUse}` },
        })

        if (!userRes.ok || cancelled) return

        const googleUser = await userRes.json() as { sub: string; name: string; email: string }
        setUser({ id: googleUser.sub, name: googleUser.name, email: googleUser.email, googleId: googleUser.sub })
      } catch {
        // Silently fail — user will see the login page
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }

    void restore()
    return () => { cancelled = true }
  }, [setUser])

  return { restoring }
}
