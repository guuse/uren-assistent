import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { TimeSelect } from '../components/TimeSelect'
import { isRecurringTemplate } from '../../domain/entities/Template'
import type { Template } from '../../domain/entities/Template'

interface Props {
  template: Template
  onClose: () => void
  isQuickBook?: boolean
}

function getMondayOfWeek(offset: number): string {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  today.setDate(today.getDate() + diff + offset * 7)
  return today.toISOString().split('T')[0]!
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

export function BookingModal({ template, onClose, isQuickBook = false }: Props) {
  const booking = useBooking(
    template,
    isQuickBook
      ? { initialDate: todayString(), initialStartTime: '09:00', initialEndTime: '09:30' }
      : {},
  )

  const showTimePickers = isQuickBook || !template.startTime || !template.endTime

  if (booking.status === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#252220] rounded-xl p-6 w-80 text-center flex flex-col gap-4">
          <div className="text-[#5a8a6a] text-4xl">✓</div>
          <div className="text-[#e8e2d9] font-semibold">Uren geboekt!</div>
          <button onClick={onClose} className="bg-[#e8e2d9] text-[#1c1917] py-2 rounded-lg text-sm font-medium hover:bg-[#d5cfc6] transition-colors">
            Sluiten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#252220] rounded-xl p-6 w-96 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="text-[#e8e2d9] font-bold">{template.name}</div>
          <button onClick={onClose} className="text-[#4a4540] hover:text-[#e8e2d9] text-lg">✕</button>
        </div>

        {/* Date + time pickers: shown for quick book or when template has no fixed times */}
        {showTimePickers && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-widest text-[#7a7268]">Datum</label>
              <input
                type="date"
                value={booking.weekStartDate}
                onChange={(e) => booking.setWeekStartDate(e.target.value)}
                className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <TimeSelect
                label="Van"
                value={booking.startTime}
                onChange={(time) => {
                  booking.setStartTime(time)
                  if (booking.endTime <= time) {
                    const [h, m] = time.split(':').map(Number)
                    const next = (h! * 60 + m! + 15)
                    const nh = Math.floor(next / 60).toString().padStart(2, '0')
                    const nm = (next % 60).toString().padStart(2, '0')
                    booking.setEndTime(`${nh}:${nm}`)
                  }
                }}
              />
              <TimeSelect
                label="Tot"
                value={booking.endTime}
                onChange={booking.setEndTime}
                minTime={booking.startTime}
              />
            </div>
          </>
        )}

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

        {/* Week selector for recurring templates (not shown when time pickers are visible) */}
        {!showTimePickers && isRecurringTemplate(template) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-[#7a7268]">Week</label>
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
                        ? 'bg-[#e8e2d9] text-[#1c1917]'
                        : 'bg-[#171512] text-[#7a7268] hover:text-[#e8e2d9]'
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
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Toelichting</label>
          <input
            type="text"
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value)}
            placeholder="Optioneel"
            className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          />
        </div>

        {booking.errorMessage && (
          <div className="bg-[#2e1e1a] text-[#b85a3a] text-xs rounded-lg px-3 py-2">
            {booking.errorMessage}
          </div>
        )}

        <button
          onClick={booking.book}
          disabled={!booking.canBook || booking.status === 'loading'}
          className="bg-[#e8e2d9] hover:bg-[#d5cfc6] disabled:opacity-40 disabled:cursor-not-allowed text-[#1c1917] font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {booking.status === 'loading' ? 'Bezig...' : 'Boeken →'}
        </button>
      </div>
    </div>
  )
}
