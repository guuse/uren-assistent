import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { TimeSelect } from '../components/TimeSelect'
import EvidencePanel from '../components/EvidencePanel'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

interface Props {
  initialEntry?: Partial<HourEntry>
  title?: string
  evidenceBlock?: ClassifiedBlock
  onClose: () => void
  onBooked?: () => void
}

export function BookingModal({ initialEntry = {}, title = 'Uren boeken', evidenceBlock, onClose, onBooked }: Props) {
  const booking = useBooking(initialEntry)

  const modalTitle = evidenceBlock?.blockName ?? title

  const confidenceBadge = evidenceBlock
    ? evidenceBlock.origin === 'cache'
      ? { label: 'Cache', bg: '#1a3a1a', color: '#5a8a6a' }
      : { label: `${Math.round(evidenceBlock.confidence * 100)}% zeker`, bg: '#1a3a1a', color: '#5a8a6a' }
    : null

  const dateLabel = evidenceBlock
    ? new Date(evidenceBlock.date + 'T12:00:00').toLocaleDateString('nl-NL', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

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
      <div className="bg-[#252220] rounded-xl w-[420px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-[18px] pb-[14px] border-b border-[#2e2a26] flex justify-between items-start">
          <div>
            <div className="text-[#e8e2d9] font-bold text-base mb-[3px]">{modalTitle}</div>
            {evidenceBlock && (
              <div className="text-[#7a7268] text-[0.6875rem] flex items-center gap-2 flex-wrap">
                {dateLabel && <span>{dateLabel}</span>}
                <span className="text-[#2e2a26]">·</span>
                <span className="text-[#e8e2d9]">{evidenceBlock.startTime}–{evidenceBlock.endTime}</span>
                <span className="text-[#2e2a26]">·</span>
                <span>{evidenceBlock.hours}u</span>
                {confidenceBadge && (
                  <span
                    className="text-[0.5625rem] px-[7px] py-[2px] rounded-full font-semibold"
                    style={{ background: confidenceBadge.bg, color: confidenceBadge.color }}
                  >
                    {confidenceBadge.label}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-[#4a4540] hover:text-[#e8e2d9] text-lg mt-[2px]">✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>

          {evidenceBlock && (
            <EvidencePanel
              rawUrls={evidenceBlock.rawUrls}
              rawTitles={evidenceBlock.rawTitles}
              urls={evidenceBlock.urls}
              titles={evidenceBlock.titles}
              summary={evidenceBlock.summary}
              startTime={evidenceBlock.startTime}
              endTime={evidenceBlock.endTime}
            />
          )}

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
            highlight={!booking.projectId}
          />
          {booking.projectId && (
            <FieldSelector
              label="Dienst"
              value={booking.serviceId}
              options={booking.services.map((s) => ({ id: s.id, label: s.name }))}
              onChange={booking.setServiceId}
              highlight={!booking.serviceId}
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

          {/* Toelichting */}
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-[#7a7268]">Toelichting</label>
            <input
              value={booking.note}
              onChange={(e) => booking.setNote(e.target.value)}
              placeholder="Optioneel"
              className="bg-[#171512] text-[#e8e2d9] text-sm rounded-lg px-3 py-2 border border-[#3e3a36] focus:border-[#5a5248] focus:outline-none"
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
    </div>
  )
}
