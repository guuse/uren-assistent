import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'

export function LoginPage() {
  const { loginWithGoogle } = useAuth()
  const isLoading = useAppStore((s) => s.isLoading)
  const error = useAppStore((s) => s.error)

  return (
    <div className="min-h-screen bg-[#1c1917] flex items-center justify-center">
      <div className="bg-[#252220] border border-[#2e2a26] rounded-2xl p-10 flex flex-col items-center gap-5 w-80">
        <div className="w-10 h-10 bg-[#e8e2d9] rounded-xl" />
        <div>
          <div className="text-[#e8e2d9] text-[17px] font-bold text-center">Uren schrijven</div>
          <div className="text-[#7a7268] text-[12px] text-center mt-1.5 leading-relaxed">
            Log in met je Google account om uren te schrijven naar Simplicate.
          </div>
        </div>
        {error && (
          <div className="text-[#b85a3a] text-[11px] bg-[#221e1b] border border-[#3a2e2a] rounded-lg px-4 py-2 w-full text-center">
            {error}
          </div>
        )}
        <button
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full bg-[#e8e2d9] hover:bg-[#d5cfc6] disabled:opacity-50 text-[#1c1917] font-semibold py-3 rounded-lg text-[13px] transition-colors cursor-pointer"
        >
          {isLoading ? 'Bezig met inloggen...' : 'Login met Google'}
        </button>
      </div>
    </div>
  )
}
