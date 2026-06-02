import type { HistoryBlock } from './HistoryBlock'
import type { GitHubCommit } from './GitHubCommit'
import type { LinearIssue } from './LinearIssue'

export interface ClassifiedBlock extends HistoryBlock {
  blockName: string
  summary: string
  startTime: string
  endTime: string
  projectId?: string
  serviceId?: string
  hourTypeId?: string
  note?: string
  confidence: 1 | 2 | 3 | 4 | 5
  origin: 'llm' | 'cache' | 'manual' | 'calendar' | 'llm-pattern'
  overlappingMeetings?: import('./CalendarEvent').CalendarEvent[]
  rawTitles?: string[]
  rawUrls?: string[]
  commits?: GitHubCommit[]
  linearIssues?: LinearIssue[]
  // Set when classification found this block but the packer didn't place it on the
  // timeline (see CONTEXT.md "Leftover block"). Such blocks live in the sidebar,
  // not the day. `leftoverReason` records why: 'overflow' (real work that ran past
  // the day) or 'suggestion' (an LLM pattern the day didn't need).
  unplaced?: boolean
  leftoverReason?: 'overflow' | 'suggestion'
}
