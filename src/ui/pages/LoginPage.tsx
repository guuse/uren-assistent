import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../../store/appStore'

export function LoginPage() {
  const { loginWithGoogle } = useAuth()
  const isLoading = useAppStore((s) => s.isLoading)
  const error = useAppStore((s) => s.error)

  return (
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center">
      <div className="bg-white border border-[#e8e2d9] rounded-2xl p-10 flex flex-col items-center gap-5 w-80">
        <div className="w-10 h-10 bg-[#3a3530] rounded-xl" />
        <div>
          <div className="text-[#3a3530] text-[17px] font-bold text-center">Uren schrijven</div>
          <div className="text-[#a09890] text-[12px] text-center mt-1.5 leading-relaxed">
            Log in met je Google account om uren te schrijven naar Simplicate.
          </div>
        </div>
        {error && (
          <div className="text-[#d97757] text-[11px] bg-[#fff8f5] border border-[#f0ddd5] rounded-lg px-4 py-2 w-full text-center">
            {error}
          </div>
        )}
        <button
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full bg-[#3a3530] hover:bg-[#2e2b26] disabled:opacity-50 text-[#faf8f4] font-semibold py-3 rounded-lg text-[13px] transition-colors cursor-pointer"
        >
          {isLoading ? 'Bezig met inloggen...' : 'Login met Google'}
        </button>
      </div>
    </div>
  )
}
