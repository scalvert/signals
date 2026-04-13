import type { SignalDetector, DetectedSignal } from '../types'
import type { Signal } from '@/types/workspace'

const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

export const milestoneDetector: SignalDetector = {
  type: 'milestone',
  detect(currentRepos, previousRepos, existingSignals): DetectedSignal[] {
    const signals: DetectedSignal[] = []
    const prevMap = new Map(previousRepos.map((r) => [r.fullName, r]))

    for (const repo of currentRepos) {
      const prev = prevMap.get(repo.fullName)
      const prevStars = prev?.stars ?? 0

      const crossed = MILESTONES.filter(
        (m) => repo.stars >= m && prevStars < m,
      )

      if (crossed.length === 0) continue

      const milestone = crossed[crossed.length - 1]

      if (isDuplicate(existingSignals, repo.fullName, milestone)) continue

      signals.push({
        type: 'milestone',
        severity: 'info',
        title: `${repo.name} reached ${formatMilestone(milestone)} stars`,
        body: `${repo.name} crossed ${formatMilestone(milestone)} stars (now at ${repo.stars}).`,
        repoFullName: repo.fullName,
        metadata: { milestone, currentStars: repo.stars },
      })
    }

    return signals
  },
}

function isDuplicate(signals: Signal[], repoFullName: string, milestone: number): boolean {
  return signals.some(
    (s) =>
      s.type === 'milestone' &&
      s.repoFullName === repoFullName &&
      (s.metadata as Record<string, unknown>).milestone === milestone,
  )
}

function formatMilestone(n: number): string {
  if (n >= 1000) return `${n / 1000}k`
  return String(n)
}
