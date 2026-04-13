import type { SignalDetector, DetectedSignal } from '../types'
import type { Signal } from '@/types/workspace'

const DEDUP_HOURS = 24
const MIN_DELTA = 5
const SPIKE_RATIO = 3.0

export const starSpikeDetector: SignalDetector = {
  type: 'star-spike',
  detect(currentRepos, previousRepos, existingSignals): DetectedSignal[] {
    const signals: DetectedSignal[] = []
    const prevMap = new Map(previousRepos.map((r) => [r.fullName, r]))
    const cutoff = Date.now() - DEDUP_HOURS * 60 * 60 * 1000

    for (const repo of currentRepos) {
      const prev = prevMap.get(repo.fullName)
      if (!prev) continue

      const delta = repo.stars - prev.stars
      if (delta < MIN_DELTA) continue

      const ratio = prev.stars > 0 ? delta / prev.stars : delta
      if (ratio < SPIKE_RATIO && delta < 20) continue

      if (isDuplicate(existingSignals, repo.fullName, cutoff)) continue

      signals.push({
        type: 'star-spike',
        severity: delta >= 20 ? 'warning' : 'info',
        title: `Star spike on ${repo.name}`,
        body: `+${delta} stars detected (${prev.stars} → ${repo.stars}). Possible source: HN, Reddit, or newsletter mention.`,
        repoFullName: repo.fullName,
        metadata: { delta, previous: prev.stars, current: repo.stars, ratio },
      })
    }

    return signals
  },
}

function isDuplicate(signals: Signal[], repoFullName: string, cutoff: number): boolean {
  return signals.some(
    (s) =>
      s.type === 'star-spike' &&
      s.repoFullName === repoFullName &&
      new Date(s.detectedAt).getTime() > cutoff,
  )
}
