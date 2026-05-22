import { useRef, useState, useMemo } from 'react'
import { useImport } from '../hooks/useImport'
import { useAppStore } from '../../store/appStore'
import ImportBlockCard from '../components/ImportBlockCard'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function blockStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return '#a07848'
  if (block.origin === 'cache') return '#5a8a6a'
  if (block.confidence < 0.6) return '#a07848'
  return '#5a8a6a'
}

const MAX_DOTS = 9

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projects = useAppStore(s => s.projects)
  const {
    status, error, blocks, minVisits, setMinVisits,
    analyseFile, updateBlock, bookAll, bookingResults,
    fetchServices,
  } = useImport()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set())

  const isLoading = status === 'parsing' || status === 'classifying' || status === 'booking'
  const isDone = blocks.length > 0 && (confirmed.size + skipped.size) >= blocks.length

  async function handleFile(file: File) {
    const text = await file.text()
    setCurrentIndex(0)
    setSkipped(new Set())
    setConfirmed(new Set())
    await analyseFile(text)
  }

  function handlePrevious() {
    setCurrentIndex(i => Math.max(0, i - 1))
  }

  function handleSkip() {
    setSkipped(s => new Set(s).add(currentIndex))
    setCurrentIndex(i => Math.min(blocks.length - 1, i + 1))
  }

  function handleConfirm() {
    setConfirmed(s => new Set(s).add(currentIndex))
    if (currentIndex < blocks.length - 1) {
      setCurrentIndex(i => i + 1)
    }
  }

  // Dot progress: sliding window of MAX_DOTS centered on current
  const dotIndices = useMemo(() => {
    if (blocks.length <= MAX_DOTS) return blocks.map((_, i) => i)
    const half = Math.floor(MAX_DOTS / 2)
    let start = Math.max(0, currentIndex - half)
    const end = Math.min(blocks.length - 1, start + MAX_DOTS - 1)
    start = Math.max(0, end - MAX_DOTS + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [blocks, currentIndex])

  const currentBlock = blocks[currentIndex] ?? null
  const totalReady = [...confirmed].filter(i => {
    const b = blocks[i]
    return b?.projectId && b.serviceId
  }).length

  return (
    <div className="h-full bg-[#1c1917] flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#2e2a26] flex-shrink-0">
        <div className="text-[#e8e2d9] text-[13px] font-bold">Browsergeschiedenis importeren</div>

        {blocks.length > 0 && (
          <>
            <div className="flex-1 h-[3px] bg-[#2e2a26] rounded overflow-hidden">
              <div
                className="h-full bg-[#e8e2d9] rounded transition-all duration-300"
                style={{ width: `${((confirmed.size + skipped.size) / blocks.length) * 100}%` }}
              />
            </div>
            <div className="text-[#7a7268] text-[10px] whitespace-nowrap">
              {confirmed.size + skipped.size} / {blocks.length}
            </div>
          </>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-[#252220] border border-[#2e2a26] text-[#7a7268] rounded px-[10px] py-[4px] text-[10px] hover:border-[#3e3a36] transition-colors cursor-pointer flex-shrink-0"
        >
          + CSV
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
          />
        </button>

        <div className="flex items-center gap-1.5">
          <label className="text-[#4a4540] text-[10px]">Min. bezoeken:</label>
          <input
            type="number"
            min={1}
            value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-12 rounded px-2 py-1 text-[11px] text-[#e8e2d9] border border-[#2e2a26] bg-[#1e1b18] focus:outline-none focus:border-[#5a5248]"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-[11px] text-[#b85a3a] bg-[#221e1b] border border-[#3a2e2a] flex-shrink-0">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-3">

        {/* Empty state */}
        {blocks.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="w-full max-w-sm border-2 border-dashed border-[#2e2a26] rounded-xl px-8 py-10 flex flex-col items-center gap-3 cursor-pointer hover:border-[#3e3a36] transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) void handleFile(file)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-[#4a4540] text-[12px] text-center leading-relaxed">
                Sleep Chrome history CSV hiernaartoe<br />of klik om te kiezen
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[#7a7268] text-[12px]">
              {status === 'parsing' && 'Bezig met analyseren...'}
              {status === 'classifying' && 'Bezig met classificeren...'}
              {status === 'booking' && 'Bezig met boeken...'}
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="text-[#e8e2d9] text-[14px] font-semibold">Klaar</div>
            <div className="text-[#7a7268] text-[12px]">
              {confirmed.size} bevestigd, {skipped.size} overgeslagen
            </div>
            {totalReady > 0 && (
              <button
                onClick={() => void bookAll()}
                className="bg-[#e8e2d9] text-[#1c1917] rounded-lg px-6 py-2.5 text-[12px] font-semibold hover:bg-[#d5cfc6] transition-colors cursor-pointer"
              >
                Boek {totalReady} blokken
              </button>
            )}
          </div>
        )}

        {/* Review state: focused card */}
        {blocks.length > 0 && !isDone && !isLoading && currentBlock && (
          <ImportBlockCard
            block={currentBlock}
            blockIndex={currentIndex}
            totalBlocks={blocks.length}
            projects={projects}
            fetchServices={fetchServices}
            bookingResult={bookingResults[currentIndex] ?? ''}
            onSave={updates => updateBlock(currentIndex, updates)}
            onPrevious={handlePrevious}
            onSkip={handleSkip}
            onConfirm={handleConfirm}
          />
        )}
      </div>

      {/* Dot progress */}
      {blocks.length > 0 && !isDone && !isLoading && (
        <div className="flex justify-center items-center gap-1.5 pb-4 flex-shrink-0">
          {dotIndices.map(i => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className="rounded-full transition-all cursor-pointer"
              style={{
                width: i === currentIndex ? 7 : 5,
                height: i === currentIndex ? 7 : 5,
                backgroundColor: confirmed.has(i) ? '#5a8a6a' : skipped.has(i) ? '#3e3a36' : blockStatusColor(blocks[i]!),
                opacity: i === currentIndex ? 1 : 0.5,
              }}
              title={`Blok ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
