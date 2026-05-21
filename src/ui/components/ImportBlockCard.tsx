import { useState, useEffect, useCallback } from 'react'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { SearchableSelect } from './SearchableSelect'
import EvidencePanel from './EvidencePanel'

interface Project { id: string; name: string }
interface Service { id: string; name: string }

interface Props {
  block: ClassifiedBlock
  blockIndex: number
  totalBlocks: number
  projects: Project[]
  fetchServices: (projectId: string) => Promise<Service[]>
  bookingResult?: 'success' | 'error' | string
  onSave: (updates: Partial<ClassifiedBlock>) => void
  onPrevious: () => void
  onSkip: () => void
  onConfirm: () => void
}

function formatBlockTime(block: ClassifiedBlock): string {
  return `${block.date ? new Date(block.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' : ''}${block.startTime} – ${block.endTime}`
}

function formatDuration(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh! * 60 + em!) - (sh! * 60 + sm!)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? ` · ${h}u${m}` : ` · ${h}u`) : ` · ${m}m`
}

export default function ImportBlockCard({
  block, blockIndex, projects, fetchServices,
  bookingResult, onSave, onPrevious, onSkip, onConfirm,
}: Props) {
  const [projectId, setProjectId] = useState(block.projectId ?? '')
  const [serviceId, setServiceId] = useState(block.serviceId ?? '')
  const [projectServices, setProjectServices] = useState<Service[]>([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectId(block.projectId ?? '')
    setServiceId(block.serviceId ?? '')
  }, [block])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!projectId) { setProjectServices([]); return }
    void fetchServices(projectId).then(setProjectServices)
  }, [projectId, fetchServices])

  function handleProjectChange(id: string) {
    setProjectId(id)
    setServiceId('')
    onSave({ projectId: id })
  }

  function handleServiceChange(id: string) {
    setServiceId(id)
    onSave({ serviceId: id })
  }

  const canConfirm = !!projectId && !!serviceId && bookingResult !== 'success'

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') onPrevious()
    if (e.key === 'ArrowRight' && canConfirm) onConfirm()
  }, [onPrevious, onConfirm, canConfirm])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const confidencePct = Math.round((block.confidence ?? 0) * 100)
  const blockTitle = block.summary || block.blockName || 'Onbekend blok'

  return (
    <div className="bg-white border border-[#e8e2d9] rounded-[12px] p-[18px] flex flex-col gap-3 flex-1 min-h-0">
      {/* Block header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[#3a3530] text-[14px] font-bold tracking-tight leading-snug truncate">
            {blockTitle}
          </div>
          <div className="text-[#a09890] text-[11px] mt-1">
            {formatBlockTime(block)}{formatDuration(block.startTime, block.endTime)}
          </div>
        </div>
        {confidencePct > 0 && (
          <div className="bg-[#f2ede6] text-[#a09890] rounded text-[10px] px-[9px] py-[3px] whitespace-nowrap flex-shrink-0">
            {confidencePct}% zeker
          </div>
        )}
      </div>

      {/* Evidence panel */}
      <EvidencePanel rawTitles={block.rawTitles} rawUrls={block.rawUrls} />

      {/* Project / service selectors */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <SearchableSelect
            label="Project"
            options={projects.map(p => ({ id: p.id, label: p.name }))}
            value={projectId}
            onChange={handleProjectChange}
            placeholder="Selecteer..."
          />
        </div>
        <div>
          <SearchableSelect
            label="Dienst"
            options={projectServices.map(s => ({ id: s.id, label: s.name }))}
            value={serviceId}
            onChange={handleServiceChange}
            placeholder="Selecteer..."
            disabled={!projectId}
          />
        </div>
      </div>

      {bookingResult === 'success' && (
        <div className="text-[#6a9e80] text-[11px]">Geboekt</div>
      )}
      {bookingResult === 'error' && (
        <div className="text-[#d97757] text-[11px]">Boeken mislukt — probeer opnieuw</div>
      )}

      {/* Spacer to push actions to bottom */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPrevious}
          disabled={blockIndex === 0}
          className="bg-[#faf8f4] border border-[#e8e2d9] text-[#a09890] rounded-[7px] px-[14px] py-[8px] text-[11px] disabled:opacity-40 hover:border-[#d0c9c0] transition-colors cursor-pointer"
        >
          ← Vorige
        </button>
        <button
          onClick={onSkip}
          className="bg-[#faf8f4] border border-[#e8e2d9] text-[#a09890] rounded-[7px] px-[14px] py-[8px] text-[11px] hover:border-[#d0c9c0] transition-colors cursor-pointer"
        >
          Overslaan
        </button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-1 bg-[#3a3530] text-[#faf8f4] rounded-[7px] py-[8px] text-[11px] font-semibold disabled:opacity-40 hover:bg-[#2e2b26] transition-colors cursor-pointer"
        >
          Bevestig →
        </button>
      </div>
    </div>
  )
}
