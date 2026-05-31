import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { useAppInit } from './ui/hooks/useAppInit'
import { useSimplicateData } from './ui/hooks/useSimplicateData'
import { LoginPage } from './ui/pages/LoginPage'
import { WeekPage } from './ui/pages/WeekPage'
import { Sidebar } from './ui/components/Sidebar'
import { SettingsPage } from './ui/pages/Settings/SettingsPage'
import ConnectionBanner from './ui/components/ConnectionBanner'

function App() {
  useAppInit()
  useSimplicateData()
  const user = useAppStore((s) => s.user)
  const [showSettings, setShowSettings] = useState(false)

  if (!user) return <LoginPage />

  if (showSettings) {
    return (
      <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-app)' }}>
        <ConnectionBanner />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar onSettings={() => setShowSettings(true)} activeTab="settings" />
          <div className="flex-1 overflow-hidden">
            <SettingsPage onBack={() => setShowSettings(false)} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-app)' }}>
      <ConnectionBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onSettings={() => setShowSettings(true)} activeTab="week" />
        <div className="flex-1 overflow-hidden">
          <WeekPage />
        </div>
      </div>
    </div>
  )
}

export default App
