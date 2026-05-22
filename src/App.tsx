import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { useAppInit } from './ui/hooks/useAppInit'
import { useSimplicateData } from './ui/hooks/useSimplicateData'
import { LoginPage } from './ui/pages/LoginPage'
import { WeekPage } from './ui/pages/WeekPage'
import { Sidebar } from './ui/components/Sidebar'
import { SettingsPage } from './ui/pages/Settings/SettingsPage'

function App() {
  useAppInit()
  useSimplicateData()
  const user = useAppStore((s) => s.user)
  const [showSettings, setShowSettings] = useState(false)

  if (!user) return <LoginPage />

  if (showSettings) {
    return (
      <div className="h-screen flex overflow-hidden bg-[#1c1917]">
        <Sidebar onSettings={() => setShowSettings(true)} />
        <div className="flex-1 overflow-hidden">
          <SettingsPage onBack={() => setShowSettings(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#1c1917]">
      <Sidebar onSettings={() => setShowSettings(true)} />
      <div className="flex-1 overflow-hidden">
        <WeekPage />
      </div>
    </div>
  )
}

export default App
