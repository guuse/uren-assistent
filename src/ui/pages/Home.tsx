import { useState } from 'react'
import { useTemplates } from '../hooks/useTemplates'
import { TemplateCard } from '../components/TemplateCard'
import { BookingModal } from './BookingModal'
import { SettingsPage } from './Settings/SettingsPage'
import { useAuth } from '../hooks/useAuth'
import { useSimplicateData } from '../hooks/useSimplicateData'
import { useAppStore } from '../../store/appStore'
import type { Template } from '../../domain/entities/Template'

export function HomePage() {
  const { templates, isLoading } = useTemplates()
  const { logout } = useAuth()
  const user = useAppStore((s) => s.user)
  useSimplicateData()
  const [bookingTemplate, setBookingTemplate] = useState<Template | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  if (showSettings) {
    return <SettingsPage onBack={() => setShowSettings(false)} />
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col">
      <div className="p-6 flex-1">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-6">Uren schrijven</div>
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
        <div className="flex gap-4">
          <button onClick={() => setShowSettings(true)} className="hover:text-gray-300">⚙ Instellingen</button>
          <button onClick={logout} className="hover:text-gray-300">Uitloggen</button>
        </div>
      </div>

      {bookingTemplate && (
        <BookingModal
          template={bookingTemplate}
          onClose={() => setBookingTemplate(null)}
        />
      )}
    </div>
  )
}
