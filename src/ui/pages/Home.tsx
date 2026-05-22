import { useState } from 'react'
import { useTemplates } from '../hooks/useTemplates'
import { TemplateCard } from '../components/TemplateCard'
import { BookingModal } from './BookingModal'
import { useAuth } from '../hooks/useAuth'
import { useSimplicateData } from '../hooks/useSimplicateData'
import { useAppStore } from '../../store/appStore'
import type { Template } from '../../domain/entities/Template'
import type { SingleTemplate } from '../../domain/entities/Template'

const QUICK_BOOK_TEMPLATE: SingleTemplate = {
  id: '__quick__',
  name: 'Vrij boeken',
  type: 'single',
  color: '#e8e2d9',
  startTime: '09:00',
  endTime: '09:30',
}

interface Props {
  onOpenSettings: () => void
}

export function HomePage({ onOpenSettings }: Props) {
  const { templates, isLoading } = useTemplates()
  const { logout } = useAuth()
  const user = useAppStore((s) => s.user)
  const projects = useAppStore((s) => s.projects)
  const { isSyncing, syncError, sync } = useSimplicateData()
  const [bookingTemplate, setBookingTemplate] = useState<Template | null>(null)

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="h-full bg-[#1c1917] flex flex-col overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex-1 overflow-y-auto flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[#e8e2d9] text-[15px] font-bold tracking-tight">Uren schrijven</div>
            <div className="text-[#7a7268] text-[11px] mt-0.5 capitalize">{today}</div>
          </div>
          <button
            onClick={() => setBookingTemplate(QUICK_BOOK_TEMPLATE)}
            className="bg-[#e8e2d9] text-[#1c1917] rounded-md px-[14px] py-[7px] text-[11px] font-semibold hover:bg-[#d5cfc6] transition-colors cursor-pointer"
          >
            + Boeken
          </button>
        </div>

        {/* Sync/error messages */}
        {syncError && !isSyncing && (
          <div className="text-[11px] text-[#b85a3a] bg-[#221e1b] border border-[#3a2e2a] rounded-lg px-3 py-2">
            Sync mislukt — {syncError}
          </div>
        )}

        {/* Template grid */}
        {isLoading ? (
          <div className="text-[#7a7268] text-[11px]">Laden...</div>
        ) : (
          <div className="grid grid-cols-2 gap-[10px]">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onBook={setBookingTemplate}
                onEdit={onOpenSettings}
              />
            ))}
            <button
              onClick={onOpenSettings}
              className="border border-dashed border-[#2e2a26] rounded-[10px] p-[14px] flex items-center justify-center text-[#4a4540] text-[11px] hover:border-[#3e3a36] hover:text-[#7a7268] transition-colors cursor-pointer"
            >
              + Template toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-6 py-[10px] border-t border-[#2e2a26] flex items-center justify-between">
        <span className="text-[#4a4540] text-[10px]">Ingelogd als {user?.name}</span>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => { void sync() }}
            disabled={isSyncing}
            className="text-[#4a4540] text-[10px] hover:text-[#7a7268] disabled:opacity-40 cursor-pointer transition-colors"
          >
            {isSyncing ? 'Synchroniseren...' : `↻ Sync${projects.length > 0 ? ` (${projects.length})` : ''}`}
          </button>
          <button onClick={logout} className="text-[#4a4540] text-[10px] hover:text-[#7a7268] cursor-pointer transition-colors">
            Uitloggen
          </button>
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
