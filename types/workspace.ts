export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type TriageStatus = 'healthy' | 'watch' | 'critical'
export type SignalSeverity = 'info' | 'warning' | 'critical'
export type SignalType =
  | 'star-spike'
  | 'new-contributor'
  | 'health-drop'
  | 'issue-flood'
  | 'pr-stale'
  | 'milestone'
  | 'dormant'

export interface SourceRepoSelection {
  mode: 'all' | 'selected'
  selected: string[]
  excludeForks?: boolean
  visibility?: 'all' | 'public' | 'private'
}

export interface WorkspaceSource {
  type: 'org' | 'user' | 'repo'
  value: string
  repos?: SourceRepoSelection
}

export interface RepoPillars {
  activity: number
  community: number
  quality: number
  security: number
}

export interface Repo {
  id: number
  name: string
  fullName: string
  description: string | null
  url: string
  language: string | null
  stars: number
  forks: number
  openIssues: number
  openPRs: number
  lastCommitAt: string | null
  lastReleaseAt: string | null
  hasCI: boolean
  hasLicense: boolean
  hasContributing: boolean
  isPrivate: boolean
  isFork: boolean
  score: number
  grade: HealthGrade
  triage: TriageStatus
  pillars: RepoPillars
  checkResults: Record<string, CheckResultData>
  workspaceId: number
  syncedAt: string
}

export interface CheckResultData {
  score: number
  label: string
  evidence: string[]
  actionable?: string
  pillar: string
  checkName: string
}

export interface PullRequest {
  id: number
  number: number
  title: string
  url: string
  authorLogin: string
  authorAssociation: string
  repoFullName: string
  isDraft: boolean
  ciState: 'passing' | 'failing' | 'pending' | 'unknown'
  createdAt: string
  updatedAt: string
  daysSinceUpdate: number
  isExternal: boolean
  isStale: boolean
  workspaceId: number
}

export interface Signal {
  id: number
  type: SignalType
  severity: SignalSeverity
  title: string
  body: string
  repoFullName: string
  metadata: Record<string, unknown>
  detectedAt: string
  workspaceId: number
  status: 'active' | 'dismissed'
  dismissedReason: string | null
  enrichedBody: string | null
}

export interface RepoContext {
  id: number
  workspaceId: number
  repoFullName: string
  context: string
  dismissedChecks: string[]
  updatedAt: string
}

export type TaskStatus = 'pending' | 'dispatched' | 'completed' | 'verified' | 'failed'

export interface TaskNote {
  text: string
  timestamp: string
  source: 'agent' | 'system'
}

export interface Task {
  id: number
  workspaceId: number
  repoFullName: string
  title: string
  description: string
  sourceType: 'signal' | 'check'
  sourceId: string
  status: TaskStatus
  provider: string | null
  providerRef: string | null
  notes: TaskNote[]
  createdAt: string
  dispatchedAt: string | null
  completedAt: string | null
}

export interface Workspace {
  id: number
  name: string
  slug: string
  sources: WorkspaceSource[]
  excludedRepos: string[]
  createdAt: string
}

export interface WorkspaceStats {
  totalRepos: number
  openPRs: number
  avgHealthScore: number
  starsLast30d: number
}

export interface SyncStatus {
  id: number
  status: 'running' | 'success' | 'error'
  startedAt: string
  completedAt: string | null
  repoCount: number | null
  error: string | null
}
