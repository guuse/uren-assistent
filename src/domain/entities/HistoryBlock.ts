export interface HistoryBlock {
  date: string            // YYYY-MM-DD
  urlPattern: string      // primary URL pattern (hostname + up to 3 path segments)
  urls: string[]          // all unique normalised URL patterns in this block
  titles: string[]        // unique page titles seen in this block
  visitCount: number
  firstVisitTime: string  // HH:mm, rounded to 30 min
  lastVisitTime: string   // HH:mm, rounded to 30 min
  hours: number           // rounded to 0.5, minimum 0.5
}
