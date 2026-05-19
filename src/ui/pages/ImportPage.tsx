// src/ui/pages/ImportPage.tsx
import { useRef } from 'react'
import { useImport } from '../hooks/useImport'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'
import { useAppStore } from '../../store/appStore'

function rowStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return 'border-l-4 border-red-500'
  if (block.origin === 'cache') return 'border-l-4 border-green-500'
  if (block.confidence < 0.6) return 'border-l-4 border-orange-400'
  return 'border-l-4 border-green-400'
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projects = useAppStore(s => s.projects)
  const services = useAppStore(s => s.services)
  const {
    status, error, blocks, minVisits, setMinVisits,
    analyseFile, updateBlock, removeBlock, bookAll, bookingResults,
  } = useImport()

  async function handleFile(file: File) {
    const text = await file.text()
    await analyseFile(text)
  }

  const hasUnclassified = blocks.some(b => !b.projectId || !b.serviceId)
  const isLoading = status === 'parsing' || status === 'classifying' || status === 'booking'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Importeer uit browsergeschiedenis</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-gray-500">Sleep een Chrome history CSV hiernaartoe, of klik om te selecteren</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-gray-600">Minimum aantal bezoeken:</label>
          <input
            type="number"
            min={1}
            value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="mt-4 text-sm text-blue-600">
            {status === 'parsing' && 'Bezig met analyseren...'}
            {status === 'classifying' && 'Bezig met classificeren via Copilot...'}
            {status === 'booking' && 'Bezig met boeken...'}
          </div>
        )}
      </div>

      {blocks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Datum</th>
                  <th className="text-left p-3 font-medium text-gray-600">Tijdblok</th>
                  <th className="text-left p-3 font-medium text-gray-600">Uren</th>
                  <th className="text-left p-3 font-medium text-gray-600">URL-patroon</th>
                  <th className="text-left p-3 font-medium text-gray-600">Project</th>
                  <th className="text-left p-3 font-medium text-gray-600">Dienst</th>
                  <th className="text-left p-3 font-medium text-gray-600">Notitie</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block, i) => {
                  const projectServices = services.filter(s => s.projectId === block.projectId)
                  const bookResult = bookingResults[i]
                  return (
                    <tr key={i} className={`border-b border-gray-100 ${rowStatusColor(block)}`}>
                      <td className="p-3 font-mono text-xs text-gray-600">{block.date}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={block.startTime}
                            onChange={e => updateBlock(i, { startTime: e.target.value })}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                          />
                          <span className="text-gray-400">–</span>
                          <input
                            type="time"
                            value={block.endTime}
                            onChange={e => updateBlock(i, { endTime: e.target.value })}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-gray-600">{block.hours}u</td>
                      <td className="p-3 font-mono text-xs text-gray-500 max-w-[200px] truncate" title={block.urlPattern}>
                        {block.urlPattern}
                      </td>
                      <td className="p-3">
                        <select
                          value={block.projectId ?? ''}
                          onChange={e => {
                            updateBlock(i, { projectId: e.target.value })
                            updateBlock(i, { serviceId: undefined } as unknown as Partial<ClassifiedBlock>)
                          }}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-full"
                        >
                          <option value="">Selecteer project</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          value={block.serviceId ?? ''}
                          onChange={e => updateBlock(i, { serviceId: e.target.value })}
                          disabled={!block.projectId}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-full disabled:opacity-50"
                        >
                          <option value="">Selecteer dienst</option>
                          {projectServices.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={block.note ?? ''}
                          onChange={e => updateBlock(i, { note: e.target.value })}
                          placeholder="Notitie..."
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-full"
                        />
                      </td>
                      <td className="p-3">
                        {bookResult === 'success' ? (
                          <span className="text-green-600 text-xs">&#10003;</span>
                        ) : bookResult ? (
                          <span className="text-red-600 text-xs" title={bookResult}>&#10007;</span>
                        ) : (
                          <button
                            onClick={() => removeBlock(i)}
                            className="text-gray-400 hover:text-red-500 text-xs"
                          >
                            &#x2715;
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {blocks.length} blokken &mdash; {blocks.filter(b => b.projectId && b.serviceId).length} klaar om te boeken
            </p>
            <button
              onClick={bookAll}
              disabled={hasUnclassified || isLoading || status === 'done'}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Boek alle
            </button>
          </div>
        </div>
      )}

      {blocks.length === 0 && status === 'ready' && (
        <p className="text-gray-500 text-sm">Geen bruikbare data gevonden. Probeer een lagere minimum bezoeken drempel.</p>
      )}
    </div>
  )
}
