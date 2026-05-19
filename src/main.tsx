import React from 'react'
import ReactDOM from 'react-dom/client'
import { useAppStore } from './store/appStore'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import { useRestoreSession } from './ui/hooks/useRestoreSession'
import './index.css'

function App() {
  const user = useAppStore((s) => s.user)
  const { restoring } = useRestoreSession()

  if (restoring) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Laden...</div>
      </div>
    )
  }

  return user ? <HomePage /> : <LoginPage />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
