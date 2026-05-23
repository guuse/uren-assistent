import { describe, it, expect } from 'vitest'
import { pixelToMinutes, snapToInterval, minutesToTime, swapIfNeeded } from './DragOverlay'

describe('pixelToMinutes', () => {
  // totalHeight = 800px (10 uur × 80px), dayStartMinutes = 480 (08:00)
  it('converteert 0px naar 480 min (08:00)', () => {
    expect(pixelToMinutes(0, 800, 480)).toBe(480)
  })
  it('converteert 800px naar 1080 min (18:00)', () => {
    expect(pixelToMinutes(800, 800, 480)).toBe(1080)
  })
  it('converteert 400px naar 780 min (13:00)', () => {
    expect(pixelToMinutes(400, 800, 480)).toBe(780)
  })
})

describe('snapToInterval', () => {
  it('snapt 492 min naar 480 (08:00 bij 30-min interval)', () => {
    expect(snapToInterval(492, 30)).toBe(480)
  })
  it('snapt 510 min naar 510 (08:30)', () => {
    expect(snapToInterval(510, 30)).toBe(510)
  })
  it('snapt 525 min naar 540 (09:00)', () => {
    expect(snapToInterval(525, 30)).toBe(540)
  })
})

describe('minutesToTime', () => {
  it('converteert 480 naar "08:00"', () => {
    expect(minutesToTime(480)).toBe('08:00')
  })
  it('converteert 570 naar "09:30"', () => {
    expect(minutesToTime(570)).toBe('09:30')
  })
  it('converteert 780 naar "13:00"', () => {
    expect(minutesToTime(780)).toBe('13:00')
  })
})

describe('swapIfNeeded', () => {
  it('swappt als end < start', () => {
    expect(swapIfNeeded(600, 540)).toEqual({ start: 540, end: 600 })
  })
  it('laat ongewijzigd als start < end', () => {
    expect(swapIfNeeded(540, 600)).toEqual({ start: 540, end: 600 })
  })
  it('laat ongewijzigd als start === end', () => {
    expect(swapIfNeeded(540, 540)).toEqual({ start: 540, end: 540 })
  })
})
