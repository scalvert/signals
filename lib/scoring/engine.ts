import { ALL_CHECKS } from './checks'
import type { RepoSnapshot, CheckResult } from './types'
import type {
  HealthGrade,
  TriageStatus,
  RepoPillars,
  CheckResultData,
} from '@/types/workspace'
import { gradeFromScore, triageFromGrade } from '@/lib/utils'

type Pillar = 'activity' | 'community' | 'quality' | 'security'

interface ScoreResult {
  score: number
  grade: HealthGrade
  triage: TriageStatus
  pillars: RepoPillars
  results: Record<string, CheckResult>
  checkResults: Record<string, CheckResultData>
}

export function scoreRepo(repo: RepoSnapshot, dismissedChecks?: Set<string>): ScoreResult {
  const results: Record<string, CheckResult> = {}
  const pillarScores: Record<Pillar, { total: number; weight: number }> = {
    activity: { total: 0, weight: 0 },
    community: { total: 0, weight: 0 },
    quality: { total: 0, weight: 0 },
    security: { total: 0, weight: 0 },
  }

  const checkResults: Record<string, CheckResultData> = {}

  for (const check of ALL_CHECKS) {
    if (!check.applies(repo)) continue
    if (dismissedChecks?.has(check.id)) continue

    const result = check.run(repo)
    results[check.id] = result
    checkResults[check.id] = {
      ...result,
      pillar: check.pillar,
      checkName: check.name,
      fixable: check.fixable,
    }

    const pillar = pillarScores[check.pillar]
    pillar.total += result.score * check.weight
    pillar.weight += check.weight
  }

  const pillars: RepoPillars = {
    activity: pillarToScore(pillarScores.activity),
    community: pillarToScore(pillarScores.community),
    quality: pillarToScore(pillarScores.quality),
    security: pillarToScore(pillarScores.security),
  }

  const score = pillars.activity + pillars.community + pillars.quality + pillars.security
  const grade = gradeFromScore(score)
  const triage = triageFromGrade(grade)

  return { score: Math.round(score), grade, triage, pillars, results, checkResults }
}

function pillarToScore(pillar: { total: number; weight: number }): number {
  if (pillar.weight === 0) return 0
  // Each pillar is 0-25, so normalized weighted average * 25
  return Math.round((pillar.total / pillar.weight) * 25)
}
