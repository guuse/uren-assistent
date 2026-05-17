import type { Template } from '../../domain/entities/Template'
import { isRecurringTemplate, isWeeklyBlockTemplate } from '../../domain/entities/Template'

interface Props {
  template: Template
  onBook: (template: Template) => void
  onEdit: (template: Template) => void
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Ma', tue: 'Di', wed: 'Wo', thu: 'Do', fri: 'Vr', sat: 'Za', sun: 'Zo',
}

function templateSubtitle(template: Template): string {
  if (isRecurringTemplate(template)) {
    return `${template.days.map((d) => DAY_LABELS[d] ?? d).join('–')} · ${template.startTime}–${template.endTime}`
  }
  if (isWeeklyBlockTemplate(template)) {
    return `Elke ${DAY_LABELS[template.day] ?? template.day} · ${template.startTime}–${template.endTime}`
  }
  return `${template.startTime}–${template.endTime}`
}

function actionLabel(template: Template): string {
  if (isRecurringTemplate(template)) return 'Week invullen'
  if (isWeeklyBlockTemplate(template)) return 'Vandaag boeken'
  return 'Nu boeken'
}

export function TemplateCard({ template, onBook, onEdit }: Props) {
  return (
    <div
      className="bg-[#2d2d44] rounded-xl p-4 flex flex-col gap-2 cursor-pointer group hover:bg-[#35355a] transition-colors"
      style={{ borderLeft: `3px solid ${template.color}` }}
    >
      <div className="flex items-start justify-between">
        <div className="text-white font-semibold text-sm">{template.name}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(template) }}
          className="text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
        >
          ✏
        </button>
      </div>
      <div className="text-gray-400 text-xs">{templateSubtitle(template)}</div>
      {(template.projectId ?? template.serviceId) ? (
        <div className="text-gray-500 text-xs">
          {template.projectId ?? '—'} · {template.serviceId ?? '—'}
        </div>
      ) : (
        <div className="text-amber-400 text-xs">⚠ Velden ontbreken</div>
      )}
      <button
        onClick={() => onBook(template)}
        className="mt-1 text-white text-xs font-medium py-1.5 px-3 rounded-md self-start transition-colors"
        style={{ backgroundColor: template.color }}
      >
        {actionLabel(template)}
      </button>
    </div>
  )
}
