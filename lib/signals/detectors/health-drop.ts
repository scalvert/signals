import type { SignalDetector, DetectedSignal } from '../types'
import type { Repo, Signal } from '@/types/workspace'
import { shouldSuppressSignal } from '../context-match'

const DEDUP_DAYS = 7

export const healthDropDetector: SignalDetector = {
  type: 'health-drop',
  detect(currentRepos, previousRepos, existingSignals, repoContexts): DetectedSignal[] {
    const signals: DetectedSignal[] = []
    const prevMap = new Map(previousRepos.map((r) => [r.fullName, r]))
    const cutoff = Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000

    for (const repo of currentRepos) {
      const prev = prevMap.get(repo.fullName)
      if (!prev) continue

      const drop = prev.score - repo.score
      if (drop < 4) continue

      if (isDuplicate(existingSignals, repo.fullName, cutoff)) continue

      const context = repoContexts.get(repo.fullName)
      if (context && shouldSuppressSignal('health-drop', context)) continue

      const severity = drop > 8 ? 'critical' : 'warning'

      signals.push({
        type: 'health-drop',
        severity,
        title: `Health score dropped on ${repo.name}`,
        body: `Score fell from ${prev.score} to ${repo.score} (−${drop} points). ${getDropContext(repo, prev)}`,
        repoFullName: repo.fullName,
        metadata: {
          scoreBefore: prev.score,
          scoreAfter: repo.score,
          drop,
          pillarsBefore: prev.pillars,
          pillarsAfter: repo.pillars,
        },
      })
    }

    return signals
  },
}

function isDuplicate(signals: Signal[], repoFullName: string, cutoff: number): boolean {
  return signals.some(
    (s) =>
      s.type === 'health-drop' &&
      s.repoFullName === repoFullName &&
      new Date(s.detectedAt).getTime() > cutoff,
  )
}

function getDropContext(current: Repo, prev: Repo): string {
  const changes: string[] = []
  const pillars = ['activity', 'community', 'quality', 'security'] as const
  for (const p of pillars) {
    const diff = current.pillars[p] - prev.pillars[p]
    if (diff < -2) changes.push(`${p} −${Math.abs(diff)}`)
  }
  return changes.length > 0
    ? `Declining pillars: ${changes.join(', ')}.`
    : 'Check individual health checks for details.'
}
