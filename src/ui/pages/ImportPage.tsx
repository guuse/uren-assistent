import { useRef, useState, useMemo } from 'react'
import { useImport } from '../hooks/useImport'
import { useAppStore } from '../../store/appStore'
import ImportBlockCard from '../components/ImportBlockCard'
import type { ClassifiedBlock } from '../../domain/entities/ClassifiedBlock'

function blockStatusColor(block: ClassifiedBlock): string {
  if (!block.projectId || !block.serviceId) return '#c4956a'
  if (block.origin === 'cache') return '#6a9e80'
  if (block.confidence < 0.6) return '#c4956a'
  return '#6a9e80'
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
  }, [blocks.length, currentIndex])

  const currentBlock = blocks[currentIndex] ?? null
  const totalReady = [...confirmed].filter(i => {
    const b = blocks[i]
    return b?.projectId && b.serviceId
  }).length

  return (
    <div className="h-full bg-[#faf8f4] flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#e8e2d9] flex-shrink-0">
        <div className="text-[#3a3530] text-[13px] font-bold">Browsergeschiedenis importeren</div>

        {blocks.length > 0 && (
          <>
            <div className="flex-1 h-[3px] bg-[#e8e2d9] rounded overflow-hidden">
              <div
                className="h-full bg-[#3a3530] rounded transition-all duration-300"
                style={{ width: `${((confirmed.size + skipped.size) / blocks.length) * 100}%` }}
              />
            </div>
            <div className="text-[#a09890] text-[10px] whitespace-nowrap">
              {confirmed.size + skipped.size} / {blocks.length}
            </div>
          </>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-white border border-[#e8e2d9] text-[#a09890] rounded px-[10px] py-[4px] text-[10px] hover:border-[#d0c9c0] transition-colors cursor-pointer flex-shrink-0"
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
          <label className="text-[#c0b8b0] text-[10px]">Min. bezoeken:</label>
          <input
            type="number"
            min={1}
            value={minVisits}
            onChange={e => setMinVisits(Number(e.target.value))}
            className="w-12 rounded px-2 py-1 text-[11px] text-[#3a3530] border border-[#e8e2d9] bg-white focus:outline-none focus:border-[#a09890]"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg text-[11px] text-[#d97757] bg-[#fff8f5] border border-[#f0ddd5] flex-shrink-0">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-3">

        {/* Empty state */}
        {blocks.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="w-full max-w-sm border-2 border-dashed border-[#e0d9d0] rounded-xl px-8 py-10 flex flex-col items-center gap-3 cursor-pointer hover:border-[#d0c9c0] transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) void handleFile(file)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-[#c0b8b0] text-[12px] text-center leading-relaxed">
                Sleep Chrome history CSV hiernaartoe<br />of klik om te kiezen
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[#a09890] text-[12px]">
              {status === 'parsing' && 'Bezig met analyseren...'}
              {status === 'classifying' && 'Bezig met classificeren...'}
              {status === 'booking' && 'Bezig met boeken...'}
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="text-[#3a3530] text-[14px] font-semibold">Klaar</div>
            <div className="text-[#a09890] text-[12px]">
              {confirmed.size} bevestigd, {skipped.size} overgeslagen
            </div>
            {totalReady > 0 && (
              <button
                onClick={() => void bookAll()}
                className="bg-[#3a3530] text-[#faf8f4] rounded-lg px-6 py-2.5 text-[12px] font-semibold hover:bg-[#2e2b26] transition-colors cursor-pointer"
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
                backgroundColor: confirmed.has(i) ? '#6a9e80' : skipped.has(i) ? '#c0b8b0' : blockStatusColor(blocks[i]!),
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
