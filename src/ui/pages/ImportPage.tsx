import { useRef, useState, useMemo } from 'react'
import { useImport } from '../hooks/useImport'
import { useAppStore } from '../../store/appStore'
import ImportBlockModal from '../components/ImportBlockModal'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function blockStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return '#ff6584'
  if (block.origin === 'cache') return '#43b89c'
  if (block.confidence < 0.6) return '#f59e0b'
  return '#43b89c'
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projects = useAppStore(s => s.projects)
  const {
    status, error, blocks, minVisits, setMinVisits,
    analyseFile, updateBlock, removeBlock, bookAll, bookingResults,
    selectedBlockIndex, openBlock, closeBlock, fetchServices,
  } = useImport()

  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  async function handleFile(file: File) {
    const text = await file.text()
    await analyseFile(text)
    setSelectedDay(null)
  }

  const isLoading = status === 'parsing' || status === 'classifying' || status === 'booking'

  // Group blocks by day
  const dayMap = useMemo(() => {
    const map = new Map<string, number[]>()
    blocks.forEach((b, i) => {
      if (!map.has(b.date)) map.set(b.date, [])
      map.get(b.date)!.push(i)
    })
    return map
  }, [blocks])

  const days = useMemo(() => [...dayMap.keys()].sort(), [dayMap])

  // Auto-select first day when blocks load
  const activeDay = selectedDay && dayMap.has(selectedDay) ? selectedDay : days[0] ?? null

  const dayBlocks = activeDay ? (dayMap.get(activeDay) ?? []).map(i => ({ i, block: blocks[i]! })) : []

  const selectedBlock = selectedBlockIndex !== null ? blocks[selectedBlockIndex] ?? null : null

  const totalReady = blocks.filter(b => b.projectId && b.serviceId).length

  return (
    <div className="flex flex-col h-screen" style={{ background: '#12121e', color: '#ccc' }}>
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: '#2d2d44' }}>
        <h1 className="text-lg font-bold text-white">Importeer browsergeschiedenis</h1>

        <div
          className="flex-1 border-2 border-dashed rounded-lg px-4 py-2 text-center cursor-pointer text-sm transition-colors"
          style={{ borderColor: '#3d3d5c', color: '#888' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          Sleep Chrome history CSV hiernaartoe of klik
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: '#888' }}>Min. bezoeken:</label>
          <input
            type="number"
            min={1}
            value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-14 rounded px-2 py-1 text-sm text-white border"
            style={{ background: '#1a1a2e', borderColor: '#3d3d5c' }}
          />
        </div>

        {blocks.length > 0 && (
          <button
            onClick={bookAll}
            disabled={totalReady === 0 || isLoading || status === 'done'}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: totalReady > 0 && !isLoading ? '#6c63ff' : '#2d2d44',
              color: totalReady > 0 && !isLoading ? '#fff' : '#555',
              cursor: totalReady > 0 && !isLoading ? 'pointer' : 'not-allowed',
            }}
          >
            Boek {totalReady} klaar
          </button>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-sm" style={{ background: '#2a1a1e', color: '#ff6584', border: '1px solid #4a2a2e' }}>
          {error}
        </div>
      )}
      {isLoading && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-sm" style={{ background: '#1a1a2e', color: '#6c63ff' }}>
          {status === 'parsing' && 'Bezig met analyseren...'}
          {status === 'classifying' && 'Bezig met classificeren via Copilot...'}
          {status === 'booking' && 'Bezig met boeken...'}
        </div>
      )}

      {/* Main content: sidebar + blocks */}
      {blocks.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          {/* Day sidebar */}
          <div className="w-40 flex-none overflow-y-auto p-3 border-r" style={{ borderColor: '#2d2d44' }}>
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: '#555' }}>Dagen</div>
            {days.map(day => {
              const indices = dayMap.get(day) ?? []
              const dayBlks = indices.map(i => blocks[i]!)
              const allBooked = dayBlks.every((_, idx) => bookingResults[indices[idx]!] === 'success')
              const hasUnready = dayBlks.some(b => !b.projectId || !b.serviceId)
              const dotColor = allBooked ? '#43b89c' : hasUnready ? '#ff6584' : '#6c63ff'
              const isActive = day === activeDay
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className="w-full text-left rounded-lg px-3 py-2 mb-1 text-xs transition-colors"
                  style={{
                    background: isActive ? '#6c63ff' : '#1a1a2e',
                    color: isActive ? '#fff' : '#888',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: dotColor }} />
                    <span className="font-medium">{day.slice(5)}</span>
                  </div>
                  <div className="mt-0.5 pl-3" style={{ color: isActive ? '#ccc' : '#555' }}>
                    {indices.length} {indices.length === 1 ? 'blok' : 'blokken'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Blocks for selected day */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeDay && (
              <>
                <div className="text-xs uppercase tracking-wider mb-4" style={{ color: '#555' }}>
                  {activeDay} — {dayBlocks.length} {dayBlocks.length === 1 ? 'blok' : 'blokken'}
                </div>
                <div className="flex flex-col gap-3">
                  {dayBlocks.map(({ i, block }) => {
                    const statusColor = blockStatusColor(block)
                    const result = bookingResults[i]
                    return (
                      <button
                        key={i}
                        onClick={() => openBlock(i)}
                        className="text-left rounded-lg p-4 w-full"
                        style={{ background: '#1e1e32', borderLeft: `3px solid ${statusColor}` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm truncate">{block.blockName}</div>
                            {block.summary && (
                              <div className="text-xs mt-0.5 truncate" style={{ color: '#888' }}>{block.summary}</div>
                            )}
                          </div>
                          <div className="flex-none text-right">
                            <div className="text-xs font-mono" style={{ color: '#6c63ff' }}>{block.hours}u</div>
                            <div className="text-xs" style={{ color: '#555' }}>{block.startTime}–{block.endTime}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {block.projectId
                            ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#252540', color: '#6c63ff' }}>
                                {projects.find(p => p.id === block.projectId)?.name ?? block.projectId}
                              </span>
                            : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2a1a1e', color: '#ff6584' }}>Geen project</span>
                          }
                          {result === 'success' && (
                            <span className="text-xs" style={{ color: '#43b89c' }}>✓ Geboekt</span>
                          )}
                          {result && result !== 'success' && (
                            <span className="text-xs" style={{ color: '#ff6584' }}>✗ Fout</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {blocks.length === 0 && status === 'ready' && (
        <div className="p-6 text-sm" style={{ color: '#555' }}>
          Geen bruikbare blokken gevonden. Probeer een lagere minimum bezoeken drempel.
        </div>
      )}

      {/* Modal — key={selectedBlockIndex} ensures remount when switching blocks */}
      {selectedBlock !== null && selectedBlockIndex !== null && (
        <ImportBlockModal
          key={selectedBlockIndex}
          block={selectedBlock}
          projects={projects}
          fetchServices={fetchServices}
          {...(bookingResults[selectedBlockIndex] !== undefined ? { bookingResult: bookingResults[selectedBlockIndex] } : {})}
          onSave={updates => updateBlock(selectedBlockIndex, updates)}
          onBook={() => void bookAll()}
          onRemove={() => { removeBlock(selectedBlockIndex); closeBlock() }}
          onClose={closeBlock}
        />
      )}
    </div>
  )
}
