import { useState, useEffect } from 'react'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { SearchableSelect } from './SearchableSelect'

interface Project { id: string; name: string }
interface Service { id: string; name: string; projectId: string }

interface Props {
  block: ClassifiedBlock
  projects: Project[]
  services: Service[]
  bookingResult?: 'success' | 'error' | string
  onSave: (updates: Partial<ClassifiedBlock>) => void
  onBook: () => void
  onRemove: () => void
  onClose: () => void
}

export default function ImportBlockModal({
  block, projects, services, bookingResult, onSave, onBook, onRemove, onClose,
}: Props) {
  const [projectId, setProjectId] = useState(block.projectId ?? '')
  const [serviceId, setServiceId] = useState(block.serviceId ?? '')
  const [note, setNote] = useState(block.note ?? block.summary ?? '')
  const [startTime, setStartTime] = useState(block.startTime)
  const [endTime, setEndTime] = useState(block.endTime)

  // Reset local state when block changes
  useEffect(() => {
    setProjectId(block.projectId ?? '')
    setServiceId(block.serviceId ?? '')
    setNote(block.note ?? block.summary ?? '')
    setStartTime(block.startTime)
    setEndTime(block.endTime)
  }, [block])

  const projectServices = services.filter(s => s.projectId === projectId)
  const canBook = !!projectId && !!serviceId && bookingResult !== 'success'

  function handleProjectChange(id: string) {
    setProjectId(id)
    setServiceId('')
    onSave({ projectId: id })
  }

  function handleServiceChange(id: string) {
    setServiceId(id)
    onSave({ serviceId: id })
  }

  function handleNoteChange(val: string) {
    setNote(val)
    onSave({ note: val })
  }

  function handleStartTimeChange(val: string) {
    setStartTime(val)
    onSave({ startTime: val })
  }

  function handleEndTimeChange(val: string) {
    setEndTime(val)
    onSave({ endTime: val })
  }

  const statusBorderColor =
    bookingResult === 'success' ? '#43b89c' :
    !projectId || !serviceId ? '#ff6584' :
    block.origin === 'cache' ? '#43b89c' :
    block.confidence < 0.6 ? '#f59e0b' : '#6c63ff'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="rounded-xl p-5 w-[380px] flex flex-col gap-4 text-sm shadow-2xl"
        style={{ background: '#2d2d44' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-white font-bold text-base leading-tight">{block.blockName}</div>
            <div className="text-gray-400 text-xs mt-1">
              {block.date} &middot; {block.origin === 'cache' ? 'cache' : block.origin === 'manual' ? 'handmatig' : 'Copilot'}
            </div>
          </div>
          <button className="text-gray-500 hover:text-white text-lg leading-none" onClick={onClose}>✕</button>
        </div>

        {/* LLM summary */}
        {block.summary && (
          <div
            className="rounded-lg p-3"
            style={{ background: '#1a1a2e', borderLeft: `3px solid ${statusBorderColor}` }}
          >
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Samenvatting</div>
            <div className="text-gray-300 text-xs leading-relaxed">{block.summary}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {block.urls.slice(0, 4).map(u => (
                <span key={u} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#252540', color: '#888' }}>{u}</span>
              ))}
            </div>
          </div>
        )}

        {/* Times */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Van</div>
            <input
              type="time"
              value={startTime}
              onChange={e => handleStartTimeChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-white text-sm border"
              style={{ background: '#1a1a2e', borderColor: '#444' }}
            />
          </div>
          <div className="flex-1">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Tot</div>
            <input
              type="time"
              value={endTime}
              onChange={e => handleEndTimeChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-white text-sm border"
              style={{ background: '#1a1a2e', borderColor: '#444' }}
            />
          </div>
          <div className="flex-none w-16">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Uren</div>
            <div
              className="rounded-lg px-3 py-2 text-center font-bold text-sm"
              style={{ background: '#1a1a2e', color: '#6c63ff', border: '1px solid #444' }}
            >
              {block.hours}u
            </div>
          </div>
        </div>

        {/* Project */}
        <SearchableSelect
          label={`Project${!projectId ? ' *' : ''}`}
          options={projects.map(p => ({ id: p.id, label: p.name }))}
          value={projectId}
          onChange={handleProjectChange}
          placeholder="Selecteer project..."
        />

        {/* Service */}
        <div style={{ opacity: projectId ? 1 : 0.4 }}>
          <SearchableSelect
            label={`Dienst${!serviceId ? ' *' : ''}`}
            options={projectServices.map(s => ({ id: s.id, label: s.name }))}
            value={serviceId}
            onChange={handleServiceChange}
            placeholder={projectId ? 'Selecteer dienst...' : 'Kies eerst een project'}
            disabled={!projectId}
          />
        </div>

        {/* Note */}
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Toelichting</div>
          <input
            type="text"
            value={note}
            onChange={e => handleNoteChange(e.target.value)}
            placeholder="Korte omschrijving..."
            className="w-full rounded-lg px-3 py-2 text-white text-sm border"
            style={{ background: '#1a1a2e', borderColor: '#444' }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onRemove}
            className="flex-none px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: '#1a1a2e', color: '#888', border: '1px solid #333' }}
          >
            Verwijderen
          </button>
          <button
            onClick={onBook}
            disabled={!canBook}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: bookingResult === 'success' ? '#43b89c' : canBook ? '#6c63ff' : '#3d3d5c',
              color: canBook || bookingResult === 'success' ? '#fff' : '#666',
              cursor: canBook ? 'pointer' : 'not-allowed',
            }}
          >
            {bookingResult === 'success' ? '✓ Geboekt' : bookingResult ? `Fout: ${bookingResult}` : 'Boeken →'}
          </button>
        </div>
      </div>
    </div>
  )
}
