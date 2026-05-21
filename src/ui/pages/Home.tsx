import { useState, useEffect } from 'react'
import { useTemplates } from '../hooks/useTemplates'
import { TemplateCard } from '../components/TemplateCard'
import { BookingModal } from './BookingModal'
import { SettingsPage } from './Settings/SettingsPage'
import { useAuth } from '../hooks/useAuth'
import { useSimplicateData } from '../hooks/useSimplicateData'
import { useAppStore } from '../../store/appStore'
import type { Template } from '../../domain/entities/Template'
import type { SingleTemplate } from '../../domain/entities/Template'

const QUICK_BOOK_TEMPLATE: SingleTemplate = {
  id: '__quick__',
  name: 'Vrij boeken',
  type: 'single',
  color: '#6c63ff',
  startTime: '09:00',
  endTime: '09:30',
}

export function HomePage() {
  const { templates, isLoading, reload } = useTemplates()
  const { logout } = useAuth()
  const user = useAppStore((s) => s.user)
  const projects = useAppStore((s) => s.projects)
  const { needsCredentials, isSyncing, syncError, sync } = useSimplicateData()
  const [bookingTemplate, setBookingTemplate] = useState<Template | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'templates' | 'account'>('templates')

  useEffect(() => {
    if (needsCredentials) {
      setSettingsTab('account')
      setShowSettings(true)
    }
  }, [needsCredentials])

  if (showSettings) {
    return (
      <SettingsPage
        initialTab={settingsTab}
        onBack={() => {
          setShowSettings(false)
          setSettingsTab('templates')
          void sync()
          void reload()
        }}
      />
    )
  }

  return (
    <div className="h-full bg-[#1a1a2e] text-white flex flex-col overflow-hidden">
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-widest">Uren schrijven</div>
          <div className="flex items-center gap-3">
            {isSyncing && (
              <div className="text-xs text-gray-500">Synchroniseren...</div>
            )}
            {syncError && !isSyncing && (
              <div className="text-xs text-red-400" title={syncError}>Sync mislukt</div>
            )}
            <button
              onClick={() => setBookingTemplate(QUICK_BOOK_TEMPLATE)}
              className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              + Boeken
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="text-gray-400 text-sm">Laden...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onBook={setBookingTemplate}
                onEdit={() => setShowSettings(true)}
              />
            ))}
            <button
              onClick={() => setShowSettings(true)}
              className="bg-[#2d2d44] border border-dashed border-gray-600 rounded-xl p-4 flex items-center justify-center text-gray-500 hover:text-gray-400 hover:border-gray-500 transition-colors text-sm"
            >
              + Template toevoegen
            </button>
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
        <span>Ingelogd als {user?.name}</span>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => { void sync() }}
            disabled={isSyncing}
            className="hover:text-gray-300 disabled:opacity-40"
            title={`${projects.length} projecten geladen`}
          >
            {isSyncing ? 'Synchroniseren...' : `↻ Sync${projects.length > 0 ? ` (${projects.length})` : ''}`}
          </button>
          <button onClick={() => { setSettingsTab('templates'); setShowSettings(true) }} className="hover:text-gray-300">⚙ Instellingen</button>
          <button onClick={logout} className="hover:text-gray-300">Uitloggen</button>
        </div>
      </div>

      {bookingTemplate && (
        <BookingModal
          template={bookingTemplate}
          onClose={() => setBookingTemplate(null)}
          isQuickBook={bookingTemplate.id === '__quick__'}
        />
      )}
    </div>
  )
}
