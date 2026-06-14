import { registry } from './registry'
import './definitions'
import type {
  SignalCategory,
  SignalContext,
  SignalDefinition,
} from './types'
import type { RepoSnapshot } from './types'
import type {
  HealthGrade,
  TriageStatus,
  RepoPillars,
  CheckResultData,
  PullRequest,
  Repo,
  Signal,
} from '@/types/workspace'
import { gradeFromScore, triageFromGrade } from '@/lib/utils'

interface ScoreResult {
  score: number
  grade: HealthGrade
  triage: TriageStatus
  pillars: RepoPillars
  checkResults: Record<string, CheckResultData>
}

export interface DetectedSignal {
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body: string
  repoFullName: string
  metadata: Record<string, unknown>
}

export function scoreRepo(
  snapshot: RepoSnapshot,
  pullRequests: PullRequest[],
  dismissedChecks?: Set<string>,
): ScoreResult {
  const metricSignals = registry.getByMode('metric')
  const repo = snapshotToRepo(snapshot)
  const pillarScores: Record<SignalCategory, { total: number; weight: number }> = {
    activity: { total: 0, weight: 0 },
    community: { total: 0, weight: 0 },
    quality: { total: 0, weight: 0 },
    security: { total: 0, weight: 0 },
  }
  const checkResults: Record<string, CheckResultData> = {}

  for (const signal of metricSignals) {
    if (dismissedChecks?.has(signal.meta.id)) continue
    if (!signal.applies(repo)) continue

    const context: SignalContext = {
      repo,
      pullRequests: pullRequests.filter((pr) => pr.repoFullName === snapshot.fullName),
      existingSignals: [],
    }

    const result = signal.evaluate(context)
    if (!result || Array.isArray(result)) continue
    if (result.mode !== 'metric') continue

    const weight = signal.meta.weight ?? 1
    const pillar = pillarScores[signal.meta.category]
    pillar.total += result.score * weight
    pillar.weight += weight

    checkResults[signal.meta.id] = {
      score: result.score,
      label: result.label,
      evidence: result.evidence,
      actionable: result.actionable,
      pillar: signal.meta.category,
      checkName: signal.meta.name,
      fixable: signal.meta.fixable,
    }
  }

  const pillars = scalePillars(pillarScores)
  const score = Math.round(
    pillars.activity + pillars.community + pillars.quality + pillars.security,
  )
  const grade = gradeFromScore(score)
  const triage = triageFromGrade(grade)

  return { score, grade, triage, pillars, checkResults }
}

function scalePillars(
  raw: Record<SignalCategory, { total: number; weight: number }>,
): RepoPillars {
  const categories: SignalCategory[] = ['activity', 'community', 'quality', 'security']
  const active = categories.filter((c) => raw[c].weight > 0)

  if (active.length === 0) {
    return { activity: 0, community: 0, quality: 0, security: 0 }
  }

  const maxPerPillar = 100 / active.length

  const pillars: RepoPillars = { activity: 0, community: 0, quality: 0, security: 0 }
  for (const cat of active) {
    const { total, weight } = raw[cat]
    pillars[cat] = Math.round((total / weight) * maxPerPillar)
  }

  return pillars
}

export function detectEvents(
  repo: Repo,
  previousRepo: Repo | undefined,
  pullRequests: PullRequest[],
  existingSignals: Signal[],
  repoContext?: string,
): DetectedSignal[] {
  const eventSignals = registry.getByMode('event')
  const detected: DetectedSignal[] = []

  const repoPRs = pullRequests.filter((pr) => pr.repoFullName === repo.fullName)

  for (const signal of eventSignals) {
    if (!signal.applies(repo)) continue

    if (repoContext && shouldSuppress(signal, repoContext)) continue

    const context: SignalContext = {
      repo,
      previousRepo,
      pullRequests: repoPRs,
      existingSignals,
      repoContext,
    }

    const result = signal.evaluate(context)
    if (!result) continue

    const results = Array.isArray(result) ? result : [result]
    for (const r of results) {
      if (r.mode !== 'event' || !r.detected) continue
      if (isDuplicate(signal, repo.fullName, existingSignals)) continue

      detected.push({
        type: signal.meta.id,
        severity: r.severity,
        title: r.title,
        body: r.body,
        repoFullName: repo.fullName,
        metadata: r.metadata,
      })
    }
  }

  return detected
}

function shouldSuppress(signal: SignalDefinition, context: string): boolean {
  const keywords = signal.meta.suppressionKeywords
  if (!keywords || keywords.length === 0) return false
  const lower = context.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

function isDuplicate(
  signal: SignalDefinition,
  repoFullName: string,
  existingSignals: Signal[],
): boolean {
  const dedupDays = signal.meta.dedupDays
  if (!dedupDays) return false

  const cutoff = Date.now() - dedupDays * 24 * 60 * 60 * 1000
  return existingSignals.some(
    (s) =>
      s.type === signal.meta.id &&
      s.repoFullName === repoFullName &&
      new Date(s.detectedAt).getTime() > cutoff,
  )
}

function snapshotToRepo(snapshot: RepoSnapshot): Repo {
  return {
    id: 0,
    name: snapshot.name,
    fullName: snapshot.fullName,
    description: null,
    url: '',
    language: snapshot.language,
    stars: snapshot.stars,
    forks: snapshot.forks,
    openIssues: snapshot.openIssues,
    openPRs: snapshot.openPRs,
    lastCommitAt: snapshot.lastCommitAt,
    lastReleaseAt: snapshot.lastReleaseAt,
    hasCI: snapshot.hasCI,
    hasLicense: snapshot.hasLicense,
    hasContributing: snapshot.hasContributing,
    isPrivate: false,
    isFork: false,
    score: 0,
    grade: 'F',
    triage: 'critical',
    pillars: { activity: 0, community: 0, quality: 0, security: 0 },
    checkResults: {},
    workspaceId: 0,
    syncedAt: new Date().toISOString(),
  }
}
