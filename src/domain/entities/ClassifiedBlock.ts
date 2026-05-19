import type { HistoryBlock } from './HistoryBlock'

export interface ClassifiedBlock extends HistoryBlock {
  blockName: string        // human-readable name from LLM (e.g. "Eindhoven Doet — development")
  summary: string          // short summary from LLM (e.g. "PR reviews en lokale dev")
  startTime: string        // HH:mm (editable, initially = firstVisitTime)
  endTime: string          // HH:mm (editable, initially = lastVisitTime)
  projectId?: string
  serviceId?: string
  note?: string
  confidence: number       // 0–1
  origin: 'llm' | 'cache' | 'manual'
}
