export function toConfidenceScore(raw: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(Number(raw))
  const clamped = isNaN(n) ? 1 : Math.min(5, Math.max(1, n))
  return clamped as 1 | 2 | 3 | 4 | 5
}
