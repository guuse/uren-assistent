import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '../../store/appStore'

interface Props {
  onSettings: () => void
}

export function Sidebar({ onSettings }: Props) {
  const user = useAppStore((s) => s.user)
  const initials = user?.name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="w-[52px] flex-shrink-0 bg-[#171512] border-r border-[#2e2a26] flex flex-col items-center py-3 gap-[6px]">
      {/* Logo mark */}
      <div className="w-[30px] h-[30px] bg-[#e8e2d9] rounded-lg mb-[10px]" />

      <div className="flex-1" />

      <button
        title="Instellingen"
        onClick={onSettings}
        className="w-[34px] h-[34px] rounded-lg flex items-center justify-center hover:bg-[#252220] transition-colors cursor-pointer"
      >
        <Cog6ToothIcon className="w-[15px] h-[15px] stroke-[#4a4540]" strokeWidth={1.5} />
      </button>

      {/* Avatar */}
      <div className="w-[26px] h-[26px] bg-[#2e2a26] rounded-full flex items-center justify-center mt-1">
        <span className="text-[#e8e2d9] text-[10px] font-semibold">{initials}</span>
      </div>
    </div>
  )
}
