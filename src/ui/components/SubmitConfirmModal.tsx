// Confirmation / warning dialog for submitting ("indienen") a week or a single day to
// Simplicate. One dialog covers three cases, decided from the counts:
//   - unbooked concept blocks remain → warn they fall outside the submission
//   - zero booked hours → warn the period is empty
//   - otherwise → plain confirmation
// In all cases submitting locks the period (it can be withdrawn again via "intrekken").

interface Props {
  scope: 'week' | 'day'
  label: string // e.g. "week 22" or "maandag 25 mei"
  unbookedCount: number
  bookedHours: number
  isSubmitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function SubmitConfirmModal({
  scope,
  label,
  unbookedCount,
  bookedHours,
  isSubmitting,
  onConfirm,
  onCancel,
}: Props) {
  const hasUnbooked = unbookedCount > 0
  const isEmpty = !hasUnbooked && bookedHours === 0
  const isWarning = hasUnbooked || isEmpty
  const noun = scope === 'week' ? 'week' : 'dag'

  const confirmLabel = isWarning ? 'Toch indienen' : 'Indienen'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
        <div className="text-xl">{isWarning ? '⚠️' : '📤'}</div>
        <div>
          <div className="text-[var(--text-primary)] font-bold text-[0.875rem] mb-1">
            {label} indienen
          </div>
          {hasUnbooked ? (
            <p className="text-[var(--text-muted)] text-[0.75rem] leading-relaxed">
              Er {unbookedCount === 1 ? 'staat nog' : 'staan nog'}{' '}
              <strong className="text-[var(--text-secondary)]">
                {unbookedCount} ongeboekt{unbookedCount === 1 ? ' blok' : 'e blokken'}
              </strong>{' '}
              in deze {noun}. Alleen geboekte uren worden ingediend — ongeboekte blokken vallen
              erbuiten en kun je daarna niet meer boeken.
            </p>
          ) : isEmpty ? (
            <p className="text-[var(--text-muted)] text-[0.75rem] leading-relaxed">
              Er {scope === 'week' ? 'staan' : 'staat'}{' '}
              <strong className="text-[var(--text-secondary)]">0 uur</strong> geboekt deze {noun}.
              Weet je zeker dat je een lege {noun} wilt indienen?
            </p>
          ) : (
            <p className="text-[var(--text-muted)] text-[0.75rem] leading-relaxed">
              Je dient <strong className="text-[var(--text-secondary)]">
                {bookedHours.toFixed(1).replace('.', ',')} uur
              </strong>{' '}
              in. Daarna staat deze {noun} op slot.
            </p>
          )}
          <p className="text-[var(--text-faint)] text-[0.6875rem] leading-relaxed mt-1.5">
            Je kunt de indiening later weer intrekken om te wijzigen.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full bg-[#6366f1] hover:bg-[#5558dd] text-white text-[0.75rem] font-semibold py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
          >
            {isSubmitting ? 'Bezig…' : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full text-[var(--text-faint)] hover:text-[var(--text-muted)] text-[0.6875rem] py-1.5 transition-colors cursor-pointer bg-transparent border-none disabled:opacity-60"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  )
}
