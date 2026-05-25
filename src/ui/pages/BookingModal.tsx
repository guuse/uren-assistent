import { useEffect } from 'react'
import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { TimeSelect } from '../components/TimeSelect'
import EvidencePanel from '../components/EvidencePanel'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

const CONFIDENCE_BG: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: '#1a3a1a',
  4: '#203018',
  3: '#332e10',
  2: '#332210',
  1: '#3a1010',
}

const CONFIDENCE_TEXT: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: '#5a8a6a',
  4: '#6a8a50',
  3: '#8a7a40',
  2: '#a06030',
  1: '#8a3a3a',
}

function BookingFormFields({ booking }: { booking: ReturnType<typeof useBooking> }) {
  return (
    <>
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
        renderSuffix={(opt) => (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void booking.toggleStar(opt.id) }}
            className="p-1 text-[#a07848] hover:text-[#c09858] transition-colors"
            aria-label={booking.starredIds.has(opt.id) ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
          >
            {booking.starredIds.has(opt.id) ? '★' : '☆'}
          </button>
        )}
        {...(booking.lastStarredId !== undefined && { groupSeparatorAfter: booking.lastStarredId })}
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
    </>
  )
}

interface Props {
  initialEntry?: Partial<HourEntry>
  title?: string
  evidenceBlock?: ClassifiedBlock
  onClose: () => void
  onBooked?: () => void
}

export function BookingModal({ initialEntry = {}, title = 'Uren boeken', evidenceBlock, onClose, onBooked }: Props) {
  const booking = useBooking(initialEntry)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const modalTitle = evidenceBlock?.blockName ?? title

  const confidenceBadge = evidenceBlock
    ? {
        label: evidenceBlock.origin === 'cache'
          ? 'Cache'
          : `${evidenceBlock.confidence}/5`,
        bg: evidenceBlock.origin === 'cache' ? '#1a3a1a' : CONFIDENCE_BG[evidenceBlock.confidence],
        color: evidenceBlock.origin === 'cache' ? '#5a8a6a' : CONFIDENCE_TEXT[evidenceBlock.confidence],
      }
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
      <div
        className={`bg-[#252220] rounded-xl flex flex-col overflow-hidden ${
          evidenceBlock ? 'w-[720px]' : 'w-[420px]'
        }`}
        style={{ maxHeight: '90vh' }}
      >

        {/* Header */}
        <div className="px-5 pt-[18px] pb-[14px] border-b border-[#2e2a26] flex justify-between items-start">
          <div>
            <div className="text-[#e8e2d9] font-bold text-base mb-[3px]">{modalTitle}</div>
            {evidenceBlock && (
              <div className="text-[#7a7268] text-[0.6875rem] flex items-center gap-2 flex-wrap">
                {dateLabel && <><span>{dateLabel}</span><span className="text-[#4a4540]">·</span></>}
                <span className="text-[#e8e2d9]">{evidenceBlock.startTime}–{evidenceBlock.endTime}</span>
                <span className="text-[#4a4540]">·</span>
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
        {evidenceBlock ? (
          /* Twee-kolommen layout */
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Linkerkolom: formulier */}
            <div className="flex-1 px-5 py-4 flex flex-col gap-4 overflow-y-auto border-r border-[#2e2a26]">
              <BookingFormFields booking={booking} />
            </div>

            {/* Rechterkolom: bewijs */}
            <div className="flex-1 px-5 py-4 overflow-y-auto min-h-0">
              <EvidencePanel
                rawUrls={evidenceBlock.rawUrls}
                rawTitles={evidenceBlock.rawTitles}
                urls={evidenceBlock.urls}
                titles={evidenceBlock.titles}
                summary={evidenceBlock.summary}
                startTime={evidenceBlock.startTime}
                endTime={evidenceBlock.endTime}
                meetings={evidenceBlock.overlappingMeetings}
                commits={evidenceBlock.commits ?? []}
                linearIssues={evidenceBlock.linearIssues ?? []}
              />
            </div>
          </div>
        ) : (
          /* Enkele kolom (geen evidenceBlock) */
          <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
            <BookingFormFields booking={booking} />
          </div>
        )}
      </div>
    </div>
  )
}
