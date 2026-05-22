import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { useAppInit } from './ui/hooks/useAppInit'
import { LoginPage } from './ui/pages/LoginPage'
import { WeekPage } from './ui/pages/WeekPage'
import ImportPage from './ui/pages/ImportPage'
import { Sidebar } from './ui/components/Sidebar'
import { SettingsPage } from './ui/pages/Settings/SettingsPage'

type Page = 'home' | 'import'

function App() {
  useAppInit()
  const user = useAppStore((s) => s.user)
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [showSettings, setShowSettings] = useState(false)

  if (!user) return <LoginPage />

  if (showSettings) {
    return (
      <div className="h-screen flex overflow-hidden bg-[#1c1917]">
        <Sidebar current={currentPage} onNavigate={setCurrentPage} onSettings={() => setShowSettings(true)} />
        <div className="flex-1 overflow-hidden">
          <SettingsPage onBack={() => setShowSettings(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#1c1917]">
      <Sidebar current={currentPage} onNavigate={setCurrentPage} onSettings={() => setShowSettings(true)} />
      <div className="flex-1 overflow-hidden">
        {currentPage === 'home' && <WeekPage />}
        {currentPage === 'import' && <ImportPage />}
      </div>
    </div>
  )
}

export default App
