import type { SignalDetector, DetectedSignal } from '../types'
import type { Repo, Signal } from '@/types/workspace'
import { shouldSuppressSignal } from '../context-match'

const DEDUP_DAYS = 30

export const dormantDetector: SignalDetector = {
  type: 'dormant',
  detect(currentRepos, _previousRepos, existingSignals, repoContexts): DetectedSignal[] {
    const signals: DetectedSignal[] = []
    const cutoff = Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000

    for (const repo of currentRepos) {
      if (repo.stars === 0) continue
      if (!repo.lastCommitAt) continue

      const daysSince = Math.floor(
        (Date.now() - new Date(repo.lastCommitAt).getTime()) / (1000 * 60 * 60 * 24),
      )

      if (daysSince < 30) continue
      if (isDuplicate(existingSignals, repo.fullName, cutoff)) continue

      const context = repoContexts.get(repo.fullName)
      if (context && shouldSuppressSignal('dormant', context)) continue

      const severity = daysSince > 60 ? 'critical' : 'warning'
      const contextInfo = getContext(repo)

      signals.push({
        type: 'dormant',
        severity,
        title: `${repo.name} appears dormant`,
        body: `No commits in ${daysSince} days.${contextInfo}`,
        repoFullName: repo.fullName,
        metadata: {
          daysSinceLastCommit: daysSince,
          lastCommitDate: repo.lastCommitAt,
          stars: repo.stars,
          openIssues: repo.openIssues,
          openPRs: repo.openPRs,
        },
      })
    }

    return signals
  },
}

function isDuplicate(signals: Signal[], repoFullName: string, cutoff: number): boolean {
  return signals.some(
    (s) =>
      s.type === 'dormant' &&
      s.repoFullName === repoFullName &&
      new Date(s.detectedAt).getTime() > cutoff,
  )
}

function getContext(repo: Repo): string {
  const parts: string[] = []
  if (repo.openIssues > 0) parts.push(`${repo.openIssues} open issues`)
  if (repo.openPRs > 0) parts.push(`${repo.openPRs} open PRs`)
  if (parts.length > 0) {
    return ` Still has ${parts.join(' and ')} — consider triaging or archiving.`
  }
  return ' Consider adding a maintenance notice or archiving.'
}
