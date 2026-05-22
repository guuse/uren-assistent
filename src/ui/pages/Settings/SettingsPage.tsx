import { AccountSettings } from './AccountSettings'

interface Props {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  return (
    <div className="h-full bg-[#1c1917] text-[#e8e2d9] flex flex-col">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-[#2e2a26]">
        <button
          onClick={onBack}
          className="text-[#7a7268] hover:text-[#e8e2d9] text-[12px] transition-colors cursor-pointer"
        >
          ← Terug
        </button>
        <div className="text-[#e8e2d9] font-bold text-[14px]">Instellingen</div>
      </div>
      <div className="px-6 py-4 flex-1 overflow-y-auto">
        <AccountSettings />
      </div>
    </div>
  )
}
