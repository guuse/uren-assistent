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
      <div className="relative z-10 bg-[#1e1b18] border border-[#2e2a26] rounded-xl p-6 w-80 shadow-xl">
        <h2 id="confirm-dialog-title" className="text-[#e8e2d9] font-semibold text-sm mb-2">{title}</h2>
        <p className="text-[#7a7268] text-xs mb-5">{description}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#2e2a26] text-[#7a7268] hover:text-[#e8e2d9] hover:border-[#4a4540] transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
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
