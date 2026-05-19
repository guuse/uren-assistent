// src/domain/entities/HistoryBlock.ts
export interface HistoryBlock {
  date: string           // YYYY-MM-DD
  urlPattern: string     // normalised, e.g. "github.com/Harborn-digital/eindhoven-doet"
  titles: string[]       // unique page titles seen for this pattern on this day
  visitCount: number
  firstVisitTime: string // HH:mm
  hours: number          // rounded to 0.25, minimum 0.25
}
