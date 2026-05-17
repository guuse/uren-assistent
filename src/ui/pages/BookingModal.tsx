import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { isRecurringTemplate } from '../../domain/entities/Template'
import type { Template } from '../../domain/entities/Template'

interface Props {
  template: Template
  onClose: () => void
}

function getMondayOfWeek(offset: number): string {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  today.setDate(today.getDate() + diff + offset * 7)
  return today.toISOString().split('T')[0]!
}

export function BookingModal({ template, onClose }: Props) {
  const booking = useBooking(template)

  if (booking.status === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#2d2d44] rounded-xl p-6 w-80 text-center flex flex-col gap-4">
          <div className="text-green-400 text-4xl">✓</div>
          <div className="text-white font-semibold">Uren geboekt!</div>
          <button onClick={onClose} className="bg-[#6c63ff] text-white py-2 rounded-lg text-sm font-medium">
            Sluiten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#2d2d44] rounded-xl p-6 w-96 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="text-white font-bold">{template.name}</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
        </div>

        {/* Missing fields */}
        {!template.projectId && (
          <FieldSelector
            label="Project"
            required
            options={booking.projects.map((p) => ({ id: p.id, label: `${p.organizationName} · ${p.name}` }))}
            value={booking.projectId}
            onChange={booking.setProjectId}
          />
        )}
        {!template.serviceId && (
          <FieldSelector
            label="Dienst"
            required
            options={booking.services.map((s) => ({ id: s.id, label: s.name }))}
            value={booking.serviceId}
            onChange={booking.setServiceId}
            disabled={!booking.projectId}
          />
        )}
        {!template.hourTypeId && (
          <FieldSelector
            label="Urensoort"
            required
            options={booking.hourTypes.map((h) => ({ id: h.id, label: h.label }))}
            value={booking.hourTypeId}
            onChange={booking.setHourTypeId}
          />
        )}

        {/* Week selector for recurring templates */}
        {isRecurringTemplate(template) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-gray-400">Week</label>
            <div className="flex gap-2">
              {[0, -1].map((offset) => {
                const monday = getMondayOfWeek(offset)
                const label = offset === 0 ? 'Deze week' : 'Vorige week'
                return (
                  <button
                    key={offset}
                    onClick={() => booking.setWeekStartDate(monday)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      booking.weekStartDate === monday
                        ? 'bg-[#6c63ff] text-white'
                        : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Note */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Toelichting</label>
          <input
            type="text"
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value)}
            placeholder="Optioneel"
            className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
          />
        </div>

        {booking.errorMessage && (
          <div className="bg-red-900/40 text-red-300 text-xs rounded-lg px-3 py-2">
            {booking.errorMessage}
          </div>
        )}

        <button
          onClick={booking.book}
          disabled={!booking.canBook || booking.status === 'loading'}
          className="bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {booking.status === 'loading' ? 'Bezig...' : `Boeken →`}
        </button>
      </div>
    </div>
  )
}
