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

export interface CheckResult {
  score: number
  label: string
  evidence: string[]
  actionable?: string
}

export interface HealthCheck {
  id: string
  name: string
  description: string
  pillar: 'activity' | 'community' | 'quality' | 'security'
  weight: number
  fixable: boolean
  applies: (repo: RepoSnapshot) => boolean
  run: (repo: RepoSnapshot) => CheckResult
}
