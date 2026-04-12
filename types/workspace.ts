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

export interface WorkspaceSource {
  type: 'org' | 'repo'
  value: string
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
  score: number
  grade: HealthGrade
  triage: TriageStatus
  pillars: RepoPillars
  workspaceId: number
  syncedAt: string
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
}

export interface Workspace {
  id: number
  name: string
  slug: string
  sources: WorkspaceSource[]
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
