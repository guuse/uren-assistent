import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'

export function LoginPage() {
  const { loginWithGoogle } = useAuth()
  const isLoading = useAppStore((s) => s.isLoading)
  const error = useAppStore((s) => s.error)

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
      <div className="bg-[#2d2d44] rounded-xl p-10 flex flex-col items-center gap-6 shadow-2xl w-80">
        <div className="text-white text-2xl font-bold">Uren schrijven</div>
        <div className="text-gray-400 text-sm text-center">
          Log in met je Google account om uren te schrijven naar Simplicate.
        </div>
        {error && (
          <div className="bg-red-900/40 text-red-300 text-sm rounded-lg px-4 py-2 w-full text-center">
            {error}
          </div>
        )}
        <button
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {isLoading ? 'Bezig met inloggen...' : 'Login met Google'}
        </button>
      </div>
    </div>
  )
}
