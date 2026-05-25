import { CalendarDaysIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

interface Props {
  onSettings: () => void
  activeTab?: 'week' | 'settings'
}

export function Sidebar({ onSettings, activeTab = 'week' }: Props) {
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center py-3 gap-1"
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Wordmark */}
      <div className="flex flex-col items-center mb-2" style={{ lineHeight: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          U<span style={{ color: 'var(--accent)' }}>.</span>
        </span>
        <span style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent)', marginTop: 2 }}>
          A
        </span>
      </div>

      {/* Week nav icon */}
      <button
        title="Week"
        onClick={() => {/* week is always active for now */}}
        className="flex items-center justify-center rounded-lg transition-colors"
        style={{
          width: 34, height: 34,
          background: activeTab === 'week' ? 'var(--accent-light)' : 'transparent',
          color: activeTab === 'week' ? 'var(--accent)' : 'var(--text-muted)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <CalendarDaysIcon style={{ width: 17, height: 17 }} strokeWidth={2} />
      </button>

      <div className="flex-1" />

      {/* Settings icon */}
      <button
        title="Instellingen"
        onClick={onSettings}
        className="flex items-center justify-center rounded-lg transition-colors"
        style={{
          width: 34, height: 34,
          background: activeTab === 'settings' ? 'var(--accent-light)' : 'transparent',
          color: activeTab === 'settings' ? 'var(--accent)' : 'var(--text-muted)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Cog6ToothIcon style={{ width: 17, height: 17 }} strokeWidth={2} />
      </button>
    </div>
  )
}
