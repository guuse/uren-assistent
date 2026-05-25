import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'

export function LoginPage() {
  const { loginWithGoogle } = useAuth()
  const isLoading = useAppStore((s) => s.isLoading)
  const error = useAppStore((s) => s.error)

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-app)' }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '36px 32px',
          width: 320,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        {/* Wordmark */}
        <div className="flex flex-col items-center mb-7">
          <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -1, lineHeight: 1 }}>
            Uren<span style={{ color: 'var(--accent)' }}>.</span>
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)', marginTop: 4 }}>
            Assistent
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', width: 'calc(100% + 64px)', marginLeft: -32, marginBottom: 24 }} />

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Log in met je Google-account om je uren bij te houden en te verwerken met AI.
        </p>

        {error && (
          <div
            className="w-full text-center mb-3"
            style={{
              fontSize: 11,
              color: 'var(--danger)',
              background: '#fff1f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '8px 16px',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 transition-colors"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontFamily: 'inherit',
          }}
        >
          {/* Google G SVG */}
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoading ? 'Bezig met inloggen…' : 'Inloggen met Google'}
        </button>
      </div>
    </div>
  )
}
