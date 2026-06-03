import { useEffect, useState, useRef } from 'react'
import { useBooking } from '../hooks/useBooking'
import { FieldSelector } from '../components/FieldSelector'
import { TimeSelect } from '../components/TimeSelect'
import EvidencePanel from '../components/EvidencePanel'
import type { HourEntry } from '../../domain/entities/HourEntry'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 3 }}>Toelichting</label>
        <input
          value={booking.note}
          onChange={(e) => booking.setNote(e.target.value)}
          placeholder="Optioneel"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>

      {booking.status === 'error' && (
        <div className="text-red-400 text-sm">{booking.errorMessage}</div>
      )}

      <button
        onClick={booking.book}
        disabled={!booking.canBook || booking.status === 'loading'}
        style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: booking.canBook ? 'pointer' : 'not-allowed', opacity: booking.canBook ? 1 : 0.4 }}
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
  onDeleted?: () => void
}

export function BookingModal({ initialEntry = {}, title = 'Uren boeken', evidenceBlock, onClose, onBooked, onDeleted }: Props) {
  const booking = useBooking(initialEntry)

  type DeleteState = 'idle' | 'confirm'
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDeleteActionRef = useRef(false)

  function handleDeleteClick() {
    if (deleteState === 'idle') {
      setDeleteState('confirm')
      deleteTimeoutRef.current = setTimeout(() => setDeleteState('idle'), 3000)
    } else {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
      isDeleteActionRef.current = true
      void booking.deleteEntry(initialEntry.id!)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
      isDeleteActionRef.current = false
    }
  }, [])

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
      }
    : null

  const dateLabel = evidenceBlock
    ? new Date(evidenceBlock.date + 'T12:00:00').toLocaleDateString('nl-NL', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  if (booking.status === 'success') {
    if (isDeleteActionRef.current) {
      onDeleted?.()
    } else {
      onBooked?.()
    }
    return (
      <div data-testid="booking-success" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(1px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: 24, width: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: 'var(--success)', fontSize: 36 }}>✓</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {isDeleteActionRef.current
              ? 'Boeking verwijderd!'
              : initialEntry.id
                ? 'Uren bijgewerkt!'
                : 'Uren geboekt!'}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            Sluiten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="booking-modal" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(1px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          width: evidenceBlock ? 660 : 420,
          maxHeight: 520,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >

        {/* Header */}
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 3 }}>{modalTitle}</h3>
            {evidenceBlock && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {dateLabel && <><span>{dateLabel}</span><span>·</span></>}
                <span style={{ color: 'var(--text-primary)' }}>{evidenceBlock.startTime}–{evidenceBlock.endTime}</span>
                <span>·</span>
                <span>{evidenceBlock.hours}u</span>
                {confidenceBadge && (
                  <span
                    style={{ background: 'var(--success-light)', color: 'var(--success)', borderRadius: 100, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}
                  >
                    {confidenceBadge.label}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', marginTop: 2, padding: 0 }}>✕</button>
        </div>

        {/* Body */}
        {evidenceBlock ? (
          /* Twee-kolommen layout */
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {/* Linkerkolom: formulier */}
            <div style={{ width: 264, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
              <BookingFormFields booking={booking} />
            </div>

            {/* Rechterkolom: bewijs */}
            <div style={{ flex: 1, background: 'var(--bg)', overflowY: 'auto', minHeight: 0 }}>
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
          <div style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', minHeight: 360 }}>
            <BookingFormFields booking={booking} />
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={onClose}
              style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              Annuleren
            </button>
            {initialEntry.id && (
              <button
                onClick={handleDeleteClick}
                disabled={booking.status === 'loading'}
                style={{
                  background: deleteState === 'confirm' ? '#b45309' : 'transparent',
                  color: deleteState === 'confirm' ? 'white' : '#ef4444',
                  border: `1px solid ${deleteState === 'confirm' ? '#b45309' : '#ef4444'}`,
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: booking.status === 'loading' ? 'not-allowed' : 'pointer',
                  opacity: booking.status === 'loading' ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {booking.status === 'loading' && deleteState === 'confirm'
                  ? 'Bezig...'
                  : deleteState === 'confirm'
                    ? 'Zeker weten?'
                    : 'Verwijderen'}
              </button>
            )}
          </div>
          <button
            onClick={booking.book}
            disabled={!booking.canBook || booking.status === 'loading'}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: booking.canBook ? 'pointer' : 'not-allowed', opacity: booking.canBook ? 1 : 0.4 }}
          >
            {booking.status === 'loading' ? 'Bezig...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}
