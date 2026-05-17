import type { Template } from '../../domain/entities/Template'

interface Props {
  template: Template
  onClose: () => void
}

export function BookingModal({ template, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#2d2d44] rounded-xl p-6 w-80">
        <div className="text-white font-bold mb-4">{template.name}</div>
        <button onClick={onClose} className="text-gray-400 text-sm">Sluiten</button>
      </div>
    </div>
  )
}
