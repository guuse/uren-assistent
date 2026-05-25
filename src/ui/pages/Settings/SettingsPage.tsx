import { AccountSettings } from './AccountSettings'

interface Props {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  return (
    <div style={{ background: 'var(--bg-app)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={onBack}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}
        >
          ← Terug
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Instellingen</h1>
      </div>
      <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
        <AccountSettings />
      </div>
    </div>
  )
}
