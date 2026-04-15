import type { SignalDetector, DetectedSignal } from '../types'
import type { Repo, Signal } from '@/types/workspace'

const DEDUP_DAYS = 7
const MIN_NEW_ISSUES = 5
const FLOOD_RATIO = 1.5

export const issueFloodDetector: SignalDetector = {
  type: 'issue-flood',
  detect(currentRepos, previousRepos, existingSignals, _repoContexts): DetectedSignal[] {
    const signals: DetectedSignal[] = []
    const prevMap = new Map(previousRepos.map((r) => [r.fullName, r]))
    const cutoff = Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000

    for (const repo of currentRepos) {
      const prev = prevMap.get(repo.fullName)
      if (!prev) continue

      const newIssues = repo.openIssues - prev.openIssues
      if (newIssues < MIN_NEW_ISSUES) continue

      const ratio = prev.openIssues > 0 ? repo.openIssues / prev.openIssues : newIssues
      if (ratio < FLOOD_RATIO) continue

      if (isDuplicate(existingSignals, repo.fullName, cutoff)) continue

      signals.push({
        type: 'issue-flood',
        severity: 'warning',
        title: `Issue spike on ${repo.name}`,
        body: `${newIssues} new issues opened (${prev.openIssues} → ${repo.openIssues}). Check for a breaking release or external attention.`,
        repoFullName: repo.fullName,
        metadata: {
          newCount: newIssues,
          previousTotal: prev.openIssues,
          currentTotal: repo.openIssues,
          ratio: Math.round(ratio * 100) / 100,
        },
      })
    }

    return signals
  },
}

function isDuplicate(signals: Signal[], repoFullName: string, cutoff: number): boolean {
  return signals.some(
    (s) =>
      s.type === 'issue-flood' &&
      s.repoFullName === repoFullName &&
      new Date(s.detectedAt).getTime() > cutoff,
  )
}
