import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Pure helpers (geëxporteerd voor tests) ───────────────────────────────────

const TOTAL_MINUTES = 600 // 08:00–18:00 = 10 hours

export function pixelToMinutes(
  pixelY: number,
  totalHeightPx: number,
  dayStartMinutes: number,
): number {
  return dayStartMinutes + (pixelY / totalHeightPx) * TOTAL_MINUTES
}

export function snapToInterval(minutes: number, snapMinutes: number): number {
  return Math.round(minutes / snapMinutes) * snapMinutes
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function swapIfNeeded(
  start: number,
  end: number,
): { start: number; end: number } {
  return start <= end ? { start, end } : { start: end, end: start }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DragState {
  startMin: number
  endMin: number
}

interface Props {
  totalHeightPx: number
  dayStartMinutes: number
  snapMinutes: number
  minDurationMinutes: number
  onDragComplete: (startTime: string, endTime: string) => void
}

export function DragOverlay({
  totalHeightPx,
  dayStartMinutes,
  snapMinutes,
  minDurationMinutes,
  onDragComplete,
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const getMinutes = useCallback((e: MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const y = Math.max(0, Math.min(e.clientY - rect.top, totalHeightPx))
    return snapToInterval(pixelToMinutes(y, totalHeightPx, dayStartMinutes), snapMinutes)
  }, [totalHeightPx, dayStartMinutes, snapMinutes])

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    const startMin = getMinutes(e.nativeEvent)
    isDragging.current = true
    setDrag({ startMin, endMin: startMin })
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current || !drag) return
      const endMin = getMinutes(e)
      setDrag((prev) => prev ? { ...prev, endMin } : prev)
    }

    function handleMouseUp(_e: MouseEvent) {
      if (!isDragging.current || !drag) return
      isDragging.current = false
      const { start, end } = swapIfNeeded(drag.startMin, drag.endMin)
      setDrag(null)
      if (end - start >= minDurationMinutes) {
        onDragComplete(minutesToTime(start), minutesToTime(end))
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isDragging.current) {
        isDragging.current = false
        setDrag(null)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [drag, minDurationMinutes, onDragComplete, getMinutes])

  // Preview-blok berekening
  let preview: { top: number; height: number; startTime: string; endTime: string } | null = null
  if (drag) {
    const { start, end } = swapIfNeeded(drag.startMin, drag.endMin)
    const topFraction = (start - dayStartMinutes) / TOTAL_MINUTES
    const endFraction = (end - dayStartMinutes) / TOTAL_MINUTES
    preview = {
      top: topFraction * totalHeightPx,
      height: Math.max(1, (endFraction - topFraction) * totalHeightPx),
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
    }
  }

  const durationMins = drag
    ? Math.abs(drag.endMin - drag.startMin)
    : 0
  const durationLabel =
    durationMins >= 60
      ? `${durationMins / 60}u`
      : `${durationMins}m`

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        cursor: drag ? 'ns-resize' : 'crosshair',
        userSelect: 'none',
      }}
    >
      {preview && (
        <div
          style={{
            position: 'absolute',
            top: preview.top,
            left: 0,
            right: 0,
            height: preview.height,
            background: 'rgba(90,138,106,0.2)',
            border: '2px dashed #5a8a6a',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 8px',
            overflow: 'hidden',
          }}
        >
          <div style={{ color: '#5a8a6a', fontSize: '0.6875rem', fontWeight: 600 }}>
            {preview.startTime} – {preview.endTime}
          </div>
          {preview.height > 36 && (
            <div style={{ color: '#5a8a6a', fontSize: '0.5625rem', opacity: 0.8 }}>
              {durationLabel} · loslaten om te boeken
            </div>
          )}
        </div>
      )}
    </div>
  )
}
