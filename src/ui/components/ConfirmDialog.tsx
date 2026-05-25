interface Props {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Verwijderen',
  cancelLabel = 'Annuleren',
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />
      <div className="relative z-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-80 shadow-xl">
        <h2 id="confirm-dialog-title" className="text-[var(--text-primary)] font-semibold text-sm mb-2">{title}</h2>
        <p className="text-[var(--text-muted)] text-xs mb-5">{description}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {isLoading ? 'Bezig...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
