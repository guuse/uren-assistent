import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { useAppStore } from './store/appStore'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import { SettingsPage } from './ui/pages/Settings/SettingsPage'
import { useRestoreSession } from './ui/hooks/useRestoreSession'
import { useSimplicateData } from './ui/hooks/useSimplicateData'
import { useTemplates } from './ui/hooks/useTemplates'
import './index.css'

type Page = 'home' | 'settings'

function App() {
  const user = useAppStore((s) => s.user)
  const { restoring } = useRestoreSession()
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const { sync } = useSimplicateData()
  const { reload } = useTemplates()

  if (restoring) {
    return (
      <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center">
        <div className="text-[#a09890] text-sm">Laden...</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (currentPage === 'settings') {
    return (
      <SettingsPage
        initialTab="templates"
        onBack={() => {
          setCurrentPage('home')
          void sync()
          void reload()
        }}
      />
    )
  }

  return <HomePage onOpenSettings={() => setCurrentPage('settings')} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
