import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useTemplates } from '../../hooks/useTemplates'
import { useAppStore } from '../../../store/appStore'
import { DayPicker } from '../../components/DayPicker'
import { FieldSelector } from '../../components/FieldSelector'
import type { Template, TemplateType, Day } from '../../../domain/entities/Template'

const COLORS = ['#6c63ff', '#63c5ff', '#63ffb4', '#f59e0b', '#f87171', '#a78bfa']
const TYPE_LABELS: Record<TemplateType, string> = {
  recurring: 'Herhalend (ma–vr)',
  single: 'Los (vandaag)',
  'weekly-block': 'Wekelijks blok',
}

interface Props {
  initial?: Template
  onDone: () => void
}

export function TemplateForm({ initial, onDone }: Props) {
  const { save } = useTemplates()
  const projects = useAppStore((s) => s.projects)
  const hourTypes = useAppStore((s) => s.hourTypes)

  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<TemplateType>(initial?.type ?? 'recurring')
  const [color, setColor] = useState(initial?.color ?? COLORS[0]!)
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '09:30')
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? '')
  const [hourTypeId, setHourTypeId] = useState(initial?.hourTypeId ?? '')
  const [defaultNote, setDefaultNote] = useState(initial?.defaultNote ?? '')
  const [days, setDays] = useState<Day[]>(
    initial?.type === 'recurring' ? initial.days : ['mon', 'tue', 'wed', 'thu', 'fri'],
  )
  const [day, setDay] = useState<Day>(
    initial?.type === 'weekly-block' ? initial.day : 'mon',
  )
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    try {
      const base = {
        id: initial?.id ?? uuidv4(),
        name,
        color,
        startTime,
        endTime,
        ...(projectId ? { projectId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(hourTypeId ? { hourTypeId } : {}),
        ...(defaultNote ? { defaultNote } : {}),
      }
      let template: Template
      if (type === 'recurring') template = { ...base, type: 'recurring', days }
      else if (type === 'single') template = { ...base, type: 'single' }
      else template = { ...base, type: 'weekly-block', day }
      await save(template)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-gray-400">Naam</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Dagelijkse standup"
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-widest text-gray-400">Type</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TYPE_LABELS) as TemplateType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                type === t ? 'bg-[#6c63ff] text-white' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {type === 'recurring' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Dagen</label>
          <DayPicker selected={days} onChange={setDays} />
        </div>
      )}

      {type === 'weekly-block' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Dag</label>
          <DayPicker selected={[day]} onChange={(d) => { if (d[0]) setDay(d[0]) }} />
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Starttijd</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
            className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none" />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs uppercase tracking-widest text-gray-400">Eindtijd</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
            className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none" />
        </div>
      </div>

      <FieldSelector
        label="Project (optioneel)"
        options={projects.map((p) => ({ id: p.id, label: `${p.organizationName} · ${p.name}` }))}
        value={projectId || undefined}
        onChange={setProjectId}
      />
      <FieldSelector
        label="Dienst (optioneel)"
        options={[]}
        value={serviceId || undefined}
        onChange={setServiceId}
        disabled={!projectId}
      />
      <FieldSelector
        label="Urensoort (optioneel)"
        options={hourTypes.map((h) => ({ id: h.id, label: h.label }))}
        value={hourTypeId || undefined}
        onChange={setHourTypeId}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-gray-400">Standaard toelichting</label>
        <input type="text" value={defaultNote} onChange={(e) => setDefaultNote(e.target.value)}
          placeholder="Optioneel"
          className="bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-[#6c63ff] focus:outline-none" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-widest text-gray-400">Kleur</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-[#2d2d44]' : ''}`}
            />
          ))}
        </div>
      </div>

      {error && <div className="bg-red-900/40 text-red-300 text-xs rounded-lg px-3 py-2">{error}</div>}

      <button onClick={handleSave}
        className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
        {initial ? 'Opslaan' : 'Template aanmaken'}
      </button>
    </div>
  )
}
