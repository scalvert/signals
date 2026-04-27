import type { SignalSeverity, PullRequest, Repo, Signal } from '@/types/workspace'
import type { Octokit } from 'octokit'

export interface RepoSnapshot {
  name: string
  fullName: string
  stars: number
  forks: number
  openIssues: number
  openPRs: number
  lastCommitAt: string | null
  lastReleaseAt: string | null
  hasCI: boolean
  hasLicense: boolean
  hasContributing: boolean
  language: string | null
}

export type SignalCategory = 'activity' | 'community' | 'quality' | 'security'
export type SignalMode = 'metric' | 'event'

export interface SignalDocs {
  summary: string
  url?: string
}

export interface AgentNeeds {
  repoAccess: 'none' | 'read' | 'write'
  github?: ('issues' | 'pulls' | 'comments')[]
}

export type ExpectedOutcome = 'pr-created' | 'pr-merged' | 'comment-posted' | 'issue-updated' | 'report'

export interface FixActionContext {
  repo: { owner: string; name: string; fullName: string }
  metadata: Record<string, unknown>
  octokit: InstanceType<typeof Octokit>
}

export interface FixResult {
  success: boolean
  resultRef?: string
  statusLine?: string
  error?: string
}

export type SignalFixInfo =
  | { description: string }
  | {
      description: string
      dispatch: 'auto'
      action: (ctx: FixActionContext) => Promise<FixResult>
    }
  | {
      description: string
      dispatch: 'llm'
      objective: string
      prompt: string
      needs: AgentNeeds
      expectedOutcome: ExpectedOutcome
    }
  | {
      description: string
      dispatch: 'agent'
      objective: string
      prompt: string
      needs: AgentNeeds
      expectedOutcome: ExpectedOutcome
    }

export interface SignalMeta {
  id: string
  name: string
  category: SignalCategory
  rationale: string
  docs: SignalDocs
  mode: SignalMode
  weight?: number
  fixable: boolean
  fixInfo?: SignalFixInfo
  suppressionKeywords?: string[]
  dedupDays?: number
}

export interface MetricSignalResult {
  mode: 'metric'
  score: number
  label: string
  evidence: string[]
  actionable?: string
}

export interface EventSignalResult {
  mode: 'event'
  detected: boolean
  severity: SignalSeverity
  title: string
  body: string
  metadata: Record<string, unknown>
}

export type SignalResult = MetricSignalResult | EventSignalResult

export interface SignalContext {
  repo: Repo
  previousRepo?: Repo
  pullRequests: PullRequest[]
  existingSignals: Signal[]
  repoContext?: string
}

export interface SignalDefinition {
  meta: SignalMeta
  applies: (repo: Repo) => boolean
  evaluate: (context: SignalContext) => SignalResult | SignalResult[] | null
}
