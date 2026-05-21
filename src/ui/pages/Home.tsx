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
  color: '#3a3530',
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
    <div className="h-full bg-[#faf8f4] flex flex-col overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex-1 overflow-y-auto flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[#3a3530] text-[15px] font-bold tracking-tight">Uren schrijven</div>
            <div className="text-[#a09890] text-[11px] mt-0.5 capitalize">{today}</div>
          </div>
          <button
            onClick={() => setBookingTemplate(QUICK_BOOK_TEMPLATE)}
            className="bg-[#3a3530] text-[#faf8f4] rounded-md px-[14px] py-[7px] text-[11px] font-semibold hover:bg-[#2e2b26] transition-colors cursor-pointer"
          >
            + Boeken
          </button>
        </div>

        {/* Sync/error messages */}
        {syncError && !isSyncing && (
          <div className="text-[11px] text-[#d97757] bg-[#fff8f5] border border-[#f0ddd5] rounded-lg px-3 py-2">
            Sync mislukt — {syncError}
          </div>
        )}

        {/* Template grid */}
        {isLoading ? (
          <div className="text-[#a09890] text-[11px]">Laden...</div>
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
              className="border border-dashed border-[#e0d9d0] rounded-[10px] p-[14px] flex items-center justify-center text-[#c8c0b8] text-[11px] hover:border-[#d0c9c0] hover:text-[#b0a898] transition-colors cursor-pointer"
            >
              + Template toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-6 py-[10px] border-t border-[#e8e2d9] flex items-center justify-between">
        <span className="text-[#c0b8b0] text-[10px]">Ingelogd als {user?.name}</span>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => { void sync() }}
            disabled={isSyncing}
            className="text-[#c0b8b0] text-[10px] hover:text-[#a09890] disabled:opacity-40 cursor-pointer transition-colors"
          >
            {isSyncing ? 'Synchroniseren...' : `↻ Sync${projects.length > 0 ? ` (${projects.length})` : ''}`}
          </button>
          <button onClick={logout} className="text-[#c0b8b0] text-[10px] hover:text-[#a09890] cursor-pointer transition-colors">
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
