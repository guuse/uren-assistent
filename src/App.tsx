import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { useAppInit } from './ui/hooks/useAppInit'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
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
      <div className="h-screen flex overflow-hidden bg-[#faf8f4]">
        <Sidebar current={currentPage} onNavigate={setCurrentPage} onSettings={() => setShowSettings(true)} />
        <div className="flex-1 overflow-hidden">
          <SettingsPage onBack={() => setShowSettings(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#faf8f4]">
      <Sidebar current={currentPage} onNavigate={setCurrentPage} onSettings={() => setShowSettings(true)} />
      <div className="flex-1 overflow-hidden">
        {currentPage === 'home' && <HomePage onOpenSettings={() => setShowSettings(true)} />}
        {currentPage === 'import' && <ImportPage />}
      </div>
    </div>
  )
}

export default App
