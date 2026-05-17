import React from 'react'
import ReactDOM from 'react-dom/client'
import { useAppStore } from './store/appStore'
import { LoginPage } from './ui/pages/LoginPage'
import { HomePage } from './ui/pages/Home'
import './index.css'

function App() {
  const user = useAppStore((s) => s.user)
  return user ? <HomePage /> : <LoginPage />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
