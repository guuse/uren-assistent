import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { useAppStore } from './store/appStore'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import ImportPage from './ui/pages/ImportPage'
import { useRestoreSession } from './ui/hooks/useRestoreSession'
import './index.css'

type Page = 'home' | 'import'

function App() {
  const user = useAppStore((s) => s.user)
  const { restoring } = useRestoreSession()
  const [currentPage, setCurrentPage] = useState<Page>('home')

  if (restoring) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Laden...</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => setCurrentPage('home')}
          className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
            currentPage === 'home'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Home
        </button>
        <button
          onClick={() => setCurrentPage('import')}
          className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
            currentPage === 'import'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Importeer
        </button>
      </nav>
      {currentPage === 'home' && <HomePage />}
      {currentPage === 'import' && <ImportPage />}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
