import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { DragOverlay } from './DragOverlay'

// totalHeight 800px = 10h, dayStart 480 (08:00), snap 30, minDuration 30
const props = {
  totalHeightPx: 800,
  dayStartMinutes: 480,
  snapMinutes: 30,
  minDurationMinutes: 30,
}

function renderOverlay(onDragComplete = vi.fn()) {
  const { container } = render(<DragOverlay {...props} onDragComplete={onDragComplete} />)
  const root = container.firstChild as HTMLElement
  // jsdom returns 0 for getBoundingClientRect; force a known rect.
  root.getBoundingClientRect = () =>
    ({ top: 0, left: 0, width: 100, height: 800, bottom: 800, right: 100, x: 0, y: 0, toJSON: () => {} }) as DOMRect
  return { container, root, onDragComplete }
}

describe('DragOverlay component', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders an empty overlay with no preview initially', () => {
    const { root } = renderOverlay()
    expect(root.querySelector('div')).toBeNull()
  })

  it('ignores non-left-button mousedown', () => {
    const { root } = renderOverlay()
    fireEvent.mouseDown(root, { button: 2, clientY: 80 })
    expect(root.querySelector('div')).toBeNull()
  })

  it('shows a preview block on mousedown then mousemove', () => {
    const { root } = renderOverlay()
    fireEvent.mouseDown(root, { button: 0, clientY: 80 }) // ~09:00
    fireEvent.mouseMove(document, { clientY: 240 })        // drag down ~11:00
    const preview = root.querySelector('div')
    expect(preview).not.toBeNull()
    expect(preview!.textContent).toContain('–')
  })

  it('shows duration sub-label when preview tall enough (>36px)', () => {
    const { root } = renderOverlay()
    fireEvent.mouseDown(root, { button: 0, clientY: 80 })
    fireEvent.mouseMove(document, { clientY: 400 })
    expect(root.textContent).toContain('loslaten om te boeken')
  })

  it('completes drag and reports start/end times on mouseup', () => {
    const { root, onDragComplete } = renderOverlay()
    fireEvent.mouseDown(root, { button: 0, clientY: 80 })   // 09:00
    fireEvent.mouseMove(document, { clientY: 240 })          // 11:00
    fireEvent.mouseUp(document, { clientY: 240 })
    expect(onDragComplete).toHaveBeenCalledOnce()
    const [start, end] = onDragComplete.mock.calls[0]!
    expect(start < end).toBe(true)
  })

  it('does not complete when drag is shorter than minDuration', () => {
    const onDragComplete = vi.fn()
    const { root } = renderOverlay(onDragComplete)
    fireEvent.mouseDown(root, { button: 0, clientY: 80 })
    fireEvent.mouseMove(document, { clientY: 80 }) // no movement
    fireEvent.mouseUp(document, { clientY: 80 })
    expect(onDragComplete).not.toHaveBeenCalled()
  })

  it('swaps start/end when dragging upward', () => {
    const { root, onDragComplete } = renderOverlay()
    fireEvent.mouseDown(root, { button: 0, clientY: 240 }) // 11:00
    fireEvent.mouseMove(document, { clientY: 80 })          // up to 09:00
    fireEvent.mouseUp(document, { clientY: 80 })
    const [start, end] = onDragComplete.mock.calls[0]!
    expect(start < end).toBe(true)
  })

  it('cancels the drag on Escape', () => {
    const { root, onDragComplete } = renderOverlay()
    fireEvent.mouseDown(root, { button: 0, clientY: 80 })
    fireEvent.mouseMove(document, { clientY: 240 })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(root.querySelector('div')).toBeNull()
    // After escape, mouseup should not fire onDragComplete
    fireEvent.mouseUp(document, { clientY: 240 })
    expect(onDragComplete).not.toHaveBeenCalled()
  })

  it('ignores Escape when not dragging', () => {
    const { root } = renderOverlay()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(root.querySelector('div')).toBeNull()
  })

  it('ignores a mousemove and mouseup when no drag is in progress', () => {
    const { root, onDragComplete } = renderOverlay()
    // No mousedown — handlers should early-return.
    fireEvent.mouseMove(document, { clientY: 200 })
    fireEvent.mouseUp(document, { clientY: 200 })
    expect(root.querySelector('div')).toBeNull()
    expect(onDragComplete).not.toHaveBeenCalled()
  })

  it('clamps clientY beyond container bounds', () => {
    const { root, onDragComplete } = renderOverlay()
    fireEvent.mouseDown(root, { button: 0, clientY: -50 }) // clamps to 0 -> 08:00
    fireEvent.mouseMove(document, { clientY: 5000 })        // clamps to 800 -> 18:00
    fireEvent.mouseUp(document, { clientY: 5000 })
    expect(onDragComplete).toHaveBeenCalledWith('08:00', '18:00')
  })
})
