// src/ui/components/NoHistoryWarningModal.tsx

interface Props {
  scope: 'week' | 'day'
  label: string  // bijv. "week 21" of "maandag 19 mei"
  onConfirm: () => void
  onUpload: () => void
  onCancel: () => void
}

export function NoHistoryWarningModal({ scope: _scope, label, onConfirm, onUpload, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
        <div className="text-xl">⚠️</div>
        <div>
          <div className="text-[var(--text-primary)] font-bold text-[0.875rem] mb-1">
            Geen browsergeschiedenis beschikbaar
          </div>
          <p className="text-[var(--text-muted)] text-[0.75rem] leading-relaxed">
            Er is geen browsergeschiedenis voor <strong className="text-[var(--text-secondary)]">{label}</strong>.
            Voorstellen worden gegenereerd op basis van GitHub, Linear en je agenda — maar zijn mogelijk minder nauwkeurig.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full bg-[#6366f1] hover:bg-[#5558dd] text-white text-[0.75rem] font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Toch verwerken
          </button>
          <button
            onClick={onUpload}
            className="w-full bg-[var(--bg)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] text-[0.75rem] py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            📂 Upload geschiedenis eerst
          </button>
          <button
            onClick={onCancel}
            className="w-full text-[var(--text-faint)] hover:text-[var(--text-muted)] text-[0.6875rem] py-1.5 transition-colors cursor-pointer bg-transparent border-none"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  )
}
