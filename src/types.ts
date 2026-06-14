import type { SignalCategory, ExpectedOutcome, AgentNeeds } from '@/lib/signals/types'

export type Severity = 'info' | 'warning' | 'critical'
export type Effort = 'low' | 'medium' | 'high'
export type DispatchStatus = 'dispatched' | 'pr-open' | 'merged' | 'failed'

/** What an agent would need to act on an item, plus any dispatch tracking refs. */
export interface DispatchInfo {
  available: boolean
  expectedOutcome?: ExpectedOutcome
  needs?: AgentNeeds
  /** Interpolated, ready-to-hand-to-an-agent prompt. */
  prompt: string
  /** Filled in at dispatch time (Phase 1/2). */
  agent?: string
  targetIssueUrl?: string
  prUrl?: string
  status?: DispatchStatus
}

/** One ranked thing worth a maintainer's attention. The unit the whole product operates on. */
export interface AttentionItem {
  /** Stable across runs so reconciliation can match: `${repo}#${type}`. */
  id: string
  repo: string
  repoUrl: string
  stars: number
  type: string
  category: SignalCategory
  severity: Severity
  title: string
  /** Why this matters — the signal's rationale. */
  rationale: string
  /** Concrete detail / evidence for this specific repo. */
  detail: string
  fixable: boolean
  dispatch: DispatchInfo | null
  /** Higher = more worth your time now. */
  rank: number
  /** Rough 0–100 sense of how much this matters. */
  impact: number
  effort: Effort
  detectedAt: string
  resolvedAt?: string | null
}

/** The structured source of truth, committed to the repo by the Action and read by every surface. */
export interface SignalsState {
  generatedAt: string
  repoCount: number
  items: AttentionItem[]
}
