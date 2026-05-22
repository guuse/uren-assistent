import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { TimeSelect } from '../components/TimeSelect'
import type { HourEntry } from '../../domain/entities/HourEntry'

interface Props {
  initialEntry?: Partial<HourEntry>
  title?: string
  onClose: () => void
  onBooked?: () => void
}

export function BookingModal({ initialEntry = {}, title = 'Uren boeken', onClose, onBooked }: Props) {
  const booking = useBooking(initialEntry)

  if (booking.status === 'success') {
    onBooked?.()
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#252220] rounded-xl p-6 w-80 text-center flex flex-col gap-4">
          <div className="text-[#5a8a6a] text-4xl">✓</div>
          <div className="text-[#e8e2d9] font-semibold">Uren geboekt!</div>
          <button
            onClick={onClose}
            className="bg-[#e8e2d9] text-[#1c1917] py-2 rounded-lg text-sm font-medium hover:bg-[#d5cfc6] transition-colors"
          >
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
          <div className="text-[#e8e2d9] font-bold">{title}</div>
          <button onClick={onClose} className="text-[#4a4540] hover:text-[#e8e2d9] text-lg">✕</button>
        </div>

        {/* Datum */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Datum</label>
          <input
            type="date"
            value={booking.date}
            onChange={(e) => booking.setDate(e.target.value)}
            className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          />
        </div>

        {/* Tijden */}
        <div className="flex gap-3">
          <TimeSelect label="Van" value={booking.startTime} onChange={(time) => {
            booking.setStartTime(time)
            if (booking.endTime <= time) {
              const [h, m] = time.split(':').map(Number)
              const next = h! * 60 + m! + 30
              booking.setEndTime(
                `${Math.floor(next / 60).toString().padStart(2, '0')}:${(next % 60).toString().padStart(2, '0')}`
              )
            }
          }} />
          <TimeSelect label="Tot" value={booking.endTime} onChange={booking.setEndTime} />
        </div>

        {/* Project / dienst / urensoort */}
        <FieldSelector
          label="Project"
          value={booking.projectId}
          options={booking.projects.map((p) => ({ id: p.id, label: `${p.organizationName} — ${p.name}` }))}
          onChange={booking.setProjectId}
        />
        {booking.projectId && (
          <FieldSelector
            label="Dienst"
            value={booking.serviceId}
            options={booking.services.map((s) => ({ id: s.id, label: s.name }))}
            onChange={booking.setServiceId}
          />
        )}
        {booking.serviceId && (
          <FieldSelector
            label="Urensoort"
            value={booking.hourTypeId}
            options={booking.hourTypes.map((ht) => ({ id: ht.id, label: ht.label }))}
            onChange={booking.setHourTypeId}
          />
        )}

        {/* Notitie */}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-[#7a7268]">Toelichting</label>
          <input
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value)}
            placeholder="Optioneel"
            className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#2e2a26] focus:border-[#5a5248] focus:outline-none"
          />
        </div>

        {booking.status === 'error' && (
          <div className="text-red-400 text-sm">{booking.errorMessage}</div>
        )}

        <button
          onClick={booking.book}
          disabled={!booking.canBook || booking.status === 'loading'}
          className="bg-[#e8e2d9] text-[#1c1917] py-2 rounded-lg text-sm font-medium hover:bg-[#d5cfc6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {booking.status === 'loading' ? 'Bezig...' : 'Boeken →'}
        </button>
      </div>
    </div>
  )
}
