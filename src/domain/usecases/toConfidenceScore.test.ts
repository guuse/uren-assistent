import { describe, it, expect } from 'vitest'
import { toConfidenceScore } from './toConfidenceScore'

describe('toConfidenceScore', () => {
  it('geeft 1 terug voor 1', () => {
    expect(toConfidenceScore(1)).toBe(1)
  })
  it('geeft 5 terug voor 5', () => {
    expect(toConfidenceScore(5)).toBe(5)
  })
  it('klampt 0 naar 1', () => {
    expect(toConfidenceScore(0)).toBe(1)
  })
  it('klampt 6 naar 5', () => {
    expect(toConfidenceScore(6)).toBe(5)
  })
  it('rondt 2.7 af naar 3', () => {
    expect(toConfidenceScore(2.7)).toBe(3)
  })
  it('rondt 2.3 af naar 2', () => {
    expect(toConfidenceScore(2.3)).toBe(2)
  })
  it('geeft 1 terug voor NaN', () => {
    expect(toConfidenceScore(NaN)).toBe(1)
  })
  it('geeft 1 terug voor undefined', () => {
    expect(toConfidenceScore(undefined)).toBe(1)
  })
  it('geeft 1 terug voor een string die geen getal is', () => {
    expect(toConfidenceScore('hoog')).toBe(1)
  })
  it('accepteert een string-getal', () => {
    expect(toConfidenceScore('4')).toBe(4)
  })
})
