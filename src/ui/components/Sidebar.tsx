import { HomeIcon, ArrowDownTrayIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '../../store/appStore'

type Page = 'home' | 'import'

interface Props {
  current: Page
  onNavigate: (page: Page) => void
  onSettings: () => void
}

export function Sidebar({ current, onNavigate, onSettings }: Props) {
  const user = useAppStore((s) => s.user)
  const initials = user?.name?.charAt(0).toUpperCase() ?? '?'

  function navItem(page: Page, Icon: React.ElementType, label: string) {
    const active = current === page
    return (
      <button
        title={label}
        onClick={() => onNavigate(page)}
        className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
          active ? 'bg-[#3a353012]' : 'hover:bg-[#3a35300a]'
        }`}
      >
        <Icon
          className={`w-[15px] h-[15px] ${active ? 'stroke-[#3a3530]' : 'stroke-[#c8c0b8]'}`}
          strokeWidth={active ? 2 : 1.5}
        />
      </button>
    )
  }

  return (
    <div className="w-[52px] flex-shrink-0 bg-[#f2ede6] border-r border-[#e8e2d9] flex flex-col items-center py-3 gap-[6px]">
      {/* Logo mark */}
      <div className="w-[30px] h-[30px] bg-[#3a3530] rounded-lg mb-[10px]" />

      {navItem('home', HomeIcon, 'Home')}
      {navItem('import', ArrowDownTrayIcon, 'Importeer')}

      <div className="flex-1" />

      <button
        title="Instellingen"
        onClick={onSettings}
        className="w-[34px] h-[34px] rounded-lg flex items-center justify-center hover:bg-[#3a35300a] transition-colors cursor-pointer"
      >
        <Cog6ToothIcon className="w-[15px] h-[15px] stroke-[#c8c0b8]" strokeWidth={1.5} />
      </button>

      {/* Avatar */}
      <div className="w-[26px] h-[26px] bg-[#e8e2d9] rounded-full flex items-center justify-center mt-1">
        <span className="text-[#3a3530] text-[10px] font-semibold">{initials}</span>
      </div>
    </div>
  )
}
