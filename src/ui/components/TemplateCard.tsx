import type { Template } from '../../domain/entities/Template'
import { isRecurringTemplate, isWeeklyBlockTemplate } from '../../domain/entities/Template'

interface Props {
  template: Template
  onBook: (template: Template) => void
  onEdit: () => void
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
      className="bg-white border border-[#e8e2d9] rounded-[10px] p-[14px] flex flex-col gap-2 cursor-pointer group hover:border-[#d0c9c0] transition-colors"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: template.color }}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="text-[#c8c0b8] hover:text-[#a09890] opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
          title="Bewerken"
        >
          ✏
        </button>
      </div>
      <div className="text-[#3a3530] text-[12px] font-semibold leading-tight">{template.name}</div>
      <div className="text-[#a09890] text-[11px]">{templateSubtitle(template)}</div>
      {!(template.projectId ?? template.serviceId) && (
        <div className="text-[#c4956a] text-[10px]">Velden ontbreken</div>
      )}
      <button
        onClick={() => onBook(template)}
        className="mt-1 text-[#faf8f4] text-[10px] font-semibold py-[5px] px-[10px] rounded-md self-start transition-opacity hover:opacity-80 cursor-pointer"
        style={{ backgroundColor: template.color }}
      >
        {actionLabel(template)}
      </button>
    </div>
  )
}
