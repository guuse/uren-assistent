import { useState } from 'react'
import { useAppStore } from './store/appStore'
import { useAppInit } from './ui/hooks/useAppInit'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import ImportPage from './ui/pages/ImportPage'

type Page = 'home' | 'import'

function App() {
  useAppInit()
  const user = useAppStore((s) => s.user)
  const [currentPage, setCurrentPage] = useState<Page>('home')

  if (!user) {
    return <LoginPage />
  }

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

export default App
