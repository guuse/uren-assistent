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
      <div className="bg-[#1e1b18] border border-[#3e3a36] rounded-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
        <div className="text-xl">⚠️</div>
        <div>
          <div className="text-[#e8e2d9] font-bold text-[0.875rem] mb-1">
            Geen browsergeschiedenis beschikbaar
          </div>
          <p className="text-[#7a7268] text-[0.75rem] leading-relaxed">
            Er is geen browsergeschiedenis voor <strong className="text-[#a8a29e]">{label}</strong>.
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
            className="w-full bg-[#252220] hover:bg-[#2e2a26] border border-[#3e3a36] text-[#a8a29e] text-[0.75rem] py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            📂 Upload geschiedenis eerst
          </button>
          <button
            onClick={onCancel}
            className="w-full text-[#4a4540] hover:text-[#7a7268] text-[0.6875rem] py-1.5 transition-colors cursor-pointer bg-transparent border-none"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  )
}
